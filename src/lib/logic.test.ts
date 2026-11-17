import { describe, expect, it } from 'vitest'
import { fingerprint, generateInboxKeys, importPublicKey, openWith, sealFor } from './crypto'
import { contentFor } from './today'
import { addDays, dayNumber } from './date'
import { VERSES, THEMES } from '../data/verses'
import { QUESTIONS } from '../data/questions'

describe('data', () => {
  it('has 20 verses and 10 questions per theme, no duplicate refs', () => {
    for (const t of THEMES) {
      expect(VERSES.filter((v) => v.theme === t)).toHaveLength(20)
      expect(QUESTIONS[t]).toHaveLength(10)
    }
    expect(new Set(VERSES.map((v) => v.ref)).size).toBe(60)
  })
  it('has clean 개역한글 text for every verse', () => {
    for (const v of VERSES) {
      expect(v.text.length, v.ref).toBeGreaterThan(10)
      expect(v.text, v.ref).not.toMatch(/[\[\]]/)
      const half = v.text.slice(0, v.text.length / 2).trim()
      expect(v.text, v.ref).not.toBe(`${half} ${half}`)
    }
    expect(VERSES.find((v) => v.ref === '요한복음 15:5')?.text).toContain('나는 포도나무요')
  })
})

describe('daily content', () => {
  it('rotates themes day by day and matches verse theme', () => {
    const start = '2026-11-17'
    const themes = [0, 1, 2, 3].map((i) => contentFor(addDays(start, i)).theme)
    expect(new Set(themes.slice(0, 3)).size).toBe(3)
    expect(themes[3]).toBe(themes[0])
    for (let i = 0; i < 400; i++) {
      const c = contentFor(addDays(start, i))
      expect(c.verse.theme).toBe(c.theme)
      expect(QUESTIONS[c.theme]).toContain(c.question)
    }
  })
  it('shows all 60 verses within 60 days', () => {
    const refs = new Set(Array.from({ length: 60 }, (_, i) => contentFor(addDays('2026-11-17', i)).verse.ref))
    expect(refs.size).toBe(60)
  })
  it('counts days across DST/month/year boundaries', () => {
    expect(dayNumber('2020-01-01')).toBe(0)
    expect(dayNumber(addDays('2026-12-31', 1))).toBe(dayNumber('2026-12-31') + 1)
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28')
  })
})

describe('mailbox crypto', () => {
  it('school PC can lock with the public key, only the phone can open', async () => {
    const phone = await generateInboxKeys()
    // 학교 PC는 공개키(JWK)만 받습니다.
    const lock = await importPublicKey(phone.publicJwk)
    const entry = { date: '2026-11-18', prayer: '주님 감사합니다', updatedAt: 1 }
    const letter = await sealFor(lock, entry)
    expect(JSON.stringify(letter)).not.toContain('감사')
    expect(await openWith(phone.keys.privateKey, letter)).toEqual(entry)

    // 다른 열쇠로는 열 수 없습니다.
    const other = await generateInboxKeys()
    await expect(openWith(other.keys.privateKey, letter)).rejects.toThrow()

    // 개인키는 밖으로 꺼낼 수 없습니다.
    await expect(crypto.subtle.exportKey('jwk', phone.keys.privateKey)).rejects.toThrow()
    // 공개키(자물쇠)로는 복호화할 수 없습니다.
    expect(lock.usages).toEqual(['encrypt'])
  }, 30_000)

  it('gives the same fingerprint for the same lock on both devices', async () => {
    const { publicJwk } = await generateInboxKeys()
    const copy = JSON.parse(JSON.stringify(publicJwk))
    expect(await fingerprint(copy)).toBe(await fingerprint(publicJwk))
    expect(await fingerprint(publicJwk)).toMatch(/^([0-9A-F]{2} ){5}[0-9A-F]{2}$/)
  }, 30_000)
})
