import { describe, expect, it } from 'vitest'
import { deriveKey, open, seal } from './crypto'
import { newerSide } from './merge'
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

describe('merge', () => {
  it('keeps the newer side', () => {
    expect(newerSide(undefined, 5)).toBe('remote')
    expect(newerSide(9, 5)).toBe('local')
    expect(newerSide(5, 5)).toBe('same')
    expect(newerSide(5, undefined)).toBe('local')
  })
})

describe('crypto', () => {
  it('round-trips and rejects a wrong passphrase', async () => {
    const k = await deriveKey('하나님은 사랑이시라', 'user-1')
    const sealed = await seal(k, { prayer: '주님 감사합니다' })
    expect(sealed.data).not.toContain('감사')
    expect(await open(k, sealed)).toEqual({ prayer: '주님 감사합니다' })
    const sameOnOtherDevice = await deriveKey('하나님은 사랑이시라', 'user-1')
    expect(await open(sameOnOtherDevice, sealed)).toEqual({ prayer: '주님 감사합니다' })
    const wrong = await deriveKey('다른 문구입니다', 'user-1')
    await expect(open(wrong, sealed)).rejects.toThrow()
  })
})
