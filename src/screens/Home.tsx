import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db } from '../lib/db'
import { addDays, dateKey, formatKorean, parseKey } from '../lib/date'
import { contentFor } from '../lib/today'

const THEME_MARK = { 순종: '🕊', 감사: '🙏', 겸손: '🌱' } as const

export function Home({ go }: { go: (s: Screen) => void }) {
  const today = dateKey()
  const { theme, verse } = contentFor(today)
  const entry = useLiveQuery(() => db.entries.get(today), [today])
  const recentDates = useLiveQuery(
    () => db.entries.where('date').aboveOrEqual(addDays(today, -27)).primaryKeys(),
    [today],
  )
  const week = useLiveQuery(async () => {
    const d = parseKey(today)
    const monday = addDays(today, -((d.getDay() + 6) % 7))
    return db.entries.where('date').between(monday, today, true, true).toArray()
  }, [today])

  const done = new Set(recentDates ?? [])
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27))
  const weekday = parseKey(today).getDay()
  const showWeek = (weekday === 5 || weekday === 6 || weekday === 0) && (week?.some((e) => e.gratitude.trim()) ?? false)

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">{formatKorean(today)}</p>
          <p className="theme-line">
            {THEME_MARK[theme]} 오늘의 주제 · <strong>{theme}</strong>
          </p>
        </div>
        <nav className="icons">
          <button className="ghost" onClick={() => go('history')}>기록</button>
          <button className="ghost" onClick={() => go('settings')}>설정</button>
        </nav>
      </header>

      {entry ? (
        <section className="card resolution">
          <p className="label">오늘의 다짐</p>
          <p className="serif big">“{entry.resolution || '주님과 함께하는 하루'}”</p>
          <p className="muted small">{entry.verseRef}</p>
          <button className="link" onClick={() => go('flow')}>오늘 묵상 다시 보기</button>
        </section>
      ) : (
        <section className="card hero">
          <p className="serif big">오늘도 말씀 앞에<br />잠시 머물러요.</p>
          <p className="muted">{verse.ref}</p>
          <button className="primary wide" onClick={() => go('flow')}>오늘 묵상 시작</button>
          <p className="muted small">약 5분이면 충분해요</p>
        </section>
      )}

      {showWeek && (
        <section className="card">
          <p className="label">이번 주 감사</p>
          <ul className="gratitude">
            {week!.filter((e) => e.gratitude.trim()).map((e) => (
              <li key={e.date}>
                <span className="muted small">{formatKorean(e.date).split(' ').slice(0, 2).join(' ')}</span>
                <span>{e.gratitude}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <p className="label">함께한 날 · 최근 4주</p>
        <div className="dots" role="img" aria-label={`최근 4주 중 ${done.size}일 묵상`}>
          {days.map((d) => (
            <span key={d} className={`dot${done.has(d) ? ' on' : ''}${d === today ? ' today' : ''}`} title={d} />
          ))}
        </div>
        <p className="muted small">빠진 날이 있어도 괜찮아요. 다시 오는 날이 은혜예요.</p>
      </section>
    </>
  )
}
