import Dexie, { type Table } from 'dexie'
import type { Theme } from '../data/verses'

export interface Entry {
  date: string // 'YYYY-MM-DD'
  theme: Theme
  verseRef: string
  question: string
  answer: string
  gratitude: string
  resolution: string
  prayer: string
  createdAt: number
  updatedAt: number
}

export interface VerseText {
  ref: string
  text: string
  updatedAt: number
}

export interface Meta {
  key: string
  value: unknown
}

class DevotionDB extends Dexie {
  entries!: Table<Entry, string>
  verseTexts!: Table<VerseText, string>
  meta!: Table<Meta, string>

  constructor() {
    super('morning-devotion')
    this.version(1).stores({
      entries: 'date, updatedAt',
      verseTexts: 'ref',
      meta: 'key',
    })
  }
}

export const db = new DevotionDB()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export type EntryInput = Omit<Entry, 'createdAt' | 'updatedAt'>

export function makeEntry(e: EntryInput, prev?: Entry): Entry {
  const now = Date.now()
  return { ...e, createdAt: prev?.createdAt ?? now, updatedAt: now }
}

export async function saveEntry(e: EntryInput): Promise<Entry> {
  const entry = makeEntry(e, await db.entries.get(e.date))
  await db.entries.put(entry)
  return entry
}

/** 더 최근에 고친 쪽을 남깁니다. 받아서 바꿨으면 true */
export async function mergeEntry(e: Entry): Promise<boolean> {
  const cur = await db.entries.get(e.date)
  if (cur && cur.updatedAt >= e.updatedAt) return false
  await db.entries.put(e)
  return true
}

export async function saveVerseText(ref: string, text: string): Promise<void> {
  await db.verseTexts.put({ ref, text, updatedAt: Date.now() })
}

export interface Backup {
  app: 'morning-devotion'
  version: 1
  exportedAt: string
  entries: Entry[]
  verseTexts: VerseText[]
}

export async function exportBackup(): Promise<Backup> {
  return {
    app: 'morning-devotion',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: await db.entries.toArray(),
    verseTexts: await db.verseTexts.toArray(),
  }
}

/** 백업을 합칩니다. 같은 날짜가 있으면 더 최근에 수정된 쪽을 남깁니다. */
export async function importBackup(b: Backup): Promise<number> {
  if (b?.app !== 'morning-devotion') throw new Error('이 앱의 백업 파일이 아니에요.')
  let n = 0
  await db.transaction('rw', db.entries, db.verseTexts, async () => {
    for (const e of b.entries ?? []) if (await mergeEntry(e)) n++
    for (const v of b.verseTexts ?? []) {
      const cur = await db.verseTexts.get(v.ref)
      if (!cur || cur.updatedAt < v.updatedAt) await db.verseTexts.put(v)
    }
  })
  return n
}
