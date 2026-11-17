import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { db, getMeta, setMeta, type Entry, type VerseText } from './db'
import { deriveKey, open, seal } from './crypto'
import { newerSide } from './merge'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const syncConfigured = Boolean(url && anon)
export const supabase: SupabaseClient | null = syncConfigured ? createClient(url!, anon!) : null

type Kind = 'entry' | 'verse' | 'check'
interface RemoteRow {
  kind: Kind
  key: string
  iv: string
  data: string
  updated_at: number
}

const CHECK_PLAINTEXT = 'morning-devotion-ok'
let memKey: CryptoKey | null = null

export async function getKey(): Promise<CryptoKey | null> {
  if (memKey) return memKey
  // 비추출형 CryptoKey는 IndexedDB에 그대로 보관할 수 있습니다(값 자체는 꺼낼 수 없음).
  memKey = (await getMeta<CryptoKey>('cryptoKey')) ?? null
  return memKey
}

export async function currentUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error('동기화가 설정되지 않았어요.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('로그인에 실패했어요: ' + error.message)
}

export async function signOut() {
  await supabase?.auth.signOut()
  memKey = null
  await db.meta.delete('cryptoKey')
  await db.meta.delete('lastSyncAt')
}

/** 비밀문구로 키를 만들고, 서버의 확인용 기록과 맞는지 검사합니다. */
export async function unlockWithPassphrase(passphrase: string): Promise<void> {
  if (!supabase) throw new Error('동기화가 설정되지 않았어요.')
  const user = await currentUser()
  if (!user) throw new Error('먼저 로그인해 주세요.')
  if (passphrase.length < 8) throw new Error('비밀문구는 8자 이상으로 정해 주세요.')
  const key = await deriveKey(passphrase, user.id)

  const { data, error } = await supabase.from('records').select('iv,data').eq('kind', 'check').eq('key', 'passphrase').maybeSingle()
  if (error) throw new Error('서버 확인 실패: ' + error.message)
  if (data) {
    try {
      const v = await open<string>(key, data)
      if (v !== CHECK_PLAINTEXT) throw new Error()
    } catch {
      throw new Error('다른 기기에서 정한 비밀문구와 달라요. 다시 확인해 주세요.')
    }
  } else {
    const s = await seal(key, CHECK_PLAINTEXT)
    const { error: e2 } = await supabase.from('records').upsert({ user_id: user.id, kind: 'check', key: 'passphrase', ...s, updated_at: Date.now() })
    if (e2) throw new Error('서버 저장 실패: ' + e2.message)
  }
  memKey = key
  await setMeta('cryptoKey', key)
}

async function fetchAll(): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = []
  const page = 500
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase!
      .from('records')
      .select('kind,key,iv,data,updated_at')
      .in('kind', ['entry', 'verse'])
      .order('key')
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as RemoteRow[]))
    if (!data || data.length < page) return rows
  }
}

export interface SyncResult {
  pulled: number
  pushed: number
}

let running: Promise<SyncResult> | null = null

/** 서버에서 받아오고(pull), 기기에서 바뀐 것을 올립니다(push). 동시에 두 번 돌지 않습니다. */
export function syncNow(): Promise<SyncResult> {
  running ??= doSync().finally(() => (running = null))
  return running
}

async function doSync(): Promise<SyncResult> {
  if (!supabase) throw new Error('동기화가 설정되지 않았어요.')
  const user = await currentUser()
  if (!user) throw new Error('로그인이 필요해요.')
  const key = await getKey()
  if (!key) throw new Error('비밀문구를 입력해 주세요.')
  if (!navigator.onLine) throw new Error('오프라인이에요. 연결되면 다시 시도할게요.')

  let pulled = 0
  for (const row of await fetchAll()) {
    if (row.kind === 'entry') {
      const local = await db.entries.get(row.key)
      if (newerSide(local?.updatedAt, row.updated_at) !== 'remote') continue
      const e = await open<Omit<Entry, 'dirty'>>(key, row)
      await db.entries.put({ ...e, dirty: 0 })
      pulled++
    } else {
      const local = await db.verseTexts.get(row.key)
      if (newerSide(local?.updatedAt, row.updated_at) !== 'remote') continue
      const v = await open<Omit<VerseText, 'dirty'>>(key, row)
      await db.verseTexts.put({ ...v, dirty: 0 })
      pulled++
    }
  }

  const dirtyEntries = await db.entries.where('dirty').equals(1).toArray()
  const dirtyVerses = await db.verseTexts.where('dirty').equals(1).toArray()
  const upserts: (RemoteRow & { user_id: string })[] = []
  for (const { dirty: _d, ...e } of dirtyEntries) upserts.push({ user_id: user.id, kind: 'entry', key: e.date, ...(await seal(key, e)), updated_at: e.updatedAt })
  for (const { dirty: _d, ...v } of dirtyVerses) upserts.push({ user_id: user.id, kind: 'verse', key: v.ref, ...(await seal(key, v)), updated_at: v.updatedAt })

  if (upserts.length) {
    const { error } = await supabase.from('records').upsert(upserts)
    if (error) throw new Error('올리기 실패: ' + error.message)
    // 올리는 사이에 다시 고친 항목은 dirty 표시를 남겨 둡니다.
    await db.transaction('rw', db.entries, db.verseTexts, async () => {
      for (const e of dirtyEntries) await db.entries.where({ date: e.date }).and((x) => x.updatedAt === e.updatedAt).modify({ dirty: 0 })
      for (const v of dirtyVerses) await db.verseTexts.where({ ref: v.ref }).and((x) => x.updatedAt === v.updatedAt).modify({ dirty: 0 })
    })
  }
  await setMeta('lastSyncAt', Date.now())
  return { pulled, pushed: upserts.length }
}

/** 화면에서 부르기 쉬운 형태: 준비가 안 됐으면 조용히 건너뜁니다. */
export async function trySync(): Promise<SyncResult | null> {
  try {
    if (!supabase || !(await currentUser()) || !(await getKey()) || !navigator.onLine) return null
    return await syncNow()
  } catch (e) {
    console.warn('sync failed', e)
    return null
  }
}
