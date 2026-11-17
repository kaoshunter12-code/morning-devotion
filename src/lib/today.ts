import { QUESTIONS } from '../data/questions'
import { THEMES, VERSES, type Theme, type Verse } from '../data/verses'
import { dayNumber } from './date'

export interface DailyContent {
  theme: Theme
  verse: Verse
  question: string
}

/** 순종 → 감사 → 겸손을 하루씩 번갈아 가며, 주제 안에서 말씀과 질문을 순서대로 고릅니다. */
export function contentFor(key: string): DailyContent {
  const n = dayNumber(key)
  const theme = THEMES[((n % 3) + 3) % 3]
  const round = Math.floor(n / 3)
  const verses = VERSES.filter((v) => v.theme === theme)
  const questions = QUESTIONS[theme]
  return {
    theme,
    verse: verses[round % verses.length],
    question: questions[round % questions.length],
  }
}
