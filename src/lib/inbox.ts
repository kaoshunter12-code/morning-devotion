import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { db, getMeta, mergeEntry, setMeta, type Entry } from './db'
import { fingerprint, generateInboxKeys, importPublicKey, openWith, sealFor, type Letter } from './crypto'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const inboxConfigured = Boolean(url && anon)
export const supabase: SupabaseClient | null = inboxConfigured ? createClient(url!, anon!) : null

function need(): SupabaseClient {
  if (!supabase) throw new Error('우편함(Supabase)이 아직 설정되지 않았어요.')
  return supabase
}

export async function currentUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

export async function signIn(email: string, password: string) {
  const { error } = await need().auth.signInWithPassword({ email, password })
  if (error) throw new Error('로그인에 실패했어요: ' + error.message)
}

export async function signOut() {
  await supabase?.auth.signOut()
}

// ───────────── 아이폰 쪽 ─────────────

interface StoredKeys {
  keys: CryptoKeyPair
  publicJwk: JsonWebKey
}

/** 아이폰에 열쇠가 없으면 만들고, 자물쇠(공개키)를 서버에 올려 둡니다. */
export async function setupPhoneInbox(): Promise<string> {
  const user = await currentUser()
  if (!user) throw new Error('먼저 로그인해 주세요.')
  let stored = await getMeta<StoredKeys>('inboxKeys')
  if (!stored) {
    stored = await generateInboxKeys()
    await setMeta('inboxKeys', stored) // 비추출형 CryptoKey는 IndexedDB에 그대로 보관됩니다
  }
  const { error } = await need()
    .from('inbox_keys')
    .upsert({ user_id: user.id, public_key: stored.publicJwk, updated_at: new Date().toISOString() })
  if (error) throw new Error('자물쇠 등록 실패: ' + error.message)
  return fingerprint(stored.publicJwk)
}

export async function phoneFingerprint(): Promise<string | null> {
  const stored = await getMeta<StoredKeys>('inboxKeys')
  return stored ? fingerprint(stored.publicJwk) : null
}

interface InboxRow extends Letter {
  id: string
}

let receiving: Promise<number> | null = null

/** 우편함의 편지를 꺼내 열고, 아이폰에 보관한 뒤 서버에서 지웁니다. */
export function receiveInbox(): Promise<number> {
  receiving ??= doReceive().finally(() => (receiving = null))
  return receiving
}

async function doReceive(): Promise<number> {
  const sb = need()
  const stored = await getMeta<StoredKeys>('inboxKeys')
  if (!stored) throw new Error('아이폰 우편함이 아직 준비되지 않았어요.')
  const { data, error } = await sb.from('inbox').select('id,wrapped_key,iv,data').order('created_at').limit(200)
  if (error) throw new Error('편지 받기 실패: ' + error.message)
  let n = 0
  const done: string[] = []
  for (const row of (data ?? []) as InboxRow[]) {
    try {
      const entry = await openWith<Entry>(stored.keys.privateKey, row)
      if (await mergeEntry(entry)) n++
      done.push(row.id)
    } catch (e) {
      // 다른 자물쇠로 잠긴 편지(예: 아이폰 앱을 새로 설치하기 전 것)는 열 수 없습니다.
      console.warn('열 수 없는 편지', row.id, e)
    }
  }
  if (done.length) {
    const { error: delErr } = await sb.from('inbox').delete().in('id', done)
    if (delErr) console.warn('서버 편지 삭제 실패', delErr)
  }
  await setMeta('lastReceiveAt', Date.now())
  return n
}

/** 화면에서 부르기 쉬운 형태: 준비가 안 됐으면 조용히 건너뜁니다. */
export async function tryReceive(): Promise<number> {
  try {
    if (!supabase || !navigator.onLine || !(await currentUser()) || !(await getMeta('inboxKeys'))) return 0
    return await receiveInbox()
  } catch (e) {
    console.warn('receive failed', e)
    return 0
  }
}

// ───────────── 학교 PC 쪽 ─────────────

export async function fetchPhoneLock(): Promise<{ key: CryptoKey; fingerprint: string } | null> {
  const { data, error } = await need().from('inbox_keys').select('public_key').maybeSingle()
  if (error) throw new Error('자물쇠 가져오기 실패: ' + error.message)
  if (!data) return null
  const jwk = data.public_key as JsonWebKey
  return { key: await importPublicKey(jwk), fingerprint: await fingerprint(jwk) }
}

/** 오늘 쓴 글을 아이폰 자물쇠로 잠가 우편함에 넣습니다. 이 PC에는 아무것도 저장하지 않습니다. */
export async function sendToPhone(entry: Entry): Promise<void> {
  const user = await currentUser()
  if (!user) throw new Error('로그인이 필요해요.')
  const lock = await fetchPhoneLock()
  if (!lock) throw new Error('아이폰에서 먼저 우편함을 준비해 주세요.')
  const letter = await sealFor(lock.key, entry)
  const { error } = await need().from('inbox').insert({ user_id: user.id, ...letter })
  if (error) throw new Error('보내기 실패: ' + error.message)
}

/** 학교 PC를 떠날 때: 로그인과 이 앱이 남긴 모든 것을 지웁니다. */
export async function wipeThisDevice(): Promise<void> {
  await signOut()
  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    /* noop */
  }
  db.close()
  await indexedDB.deleteDatabase('morning-devotion')
}

