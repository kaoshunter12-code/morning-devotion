// 날짜 키는 기기의 현지 시각 기준 'YYYY-MM-DD'.
export function dateKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 2020-01-01부터 며칠째인지 (시간대와 무관하게 날짜만으로 계산). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2020, 0, 1)) / 86_400_000)
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export function formatKorean(key: string): string {
  const d = parseKey(key)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}
