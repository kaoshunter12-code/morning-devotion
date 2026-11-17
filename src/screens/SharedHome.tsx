import type { Screen } from '../App'
import { dateKey, formatKorean } from '../lib/date'
import { contentFor } from '../lib/today'

const THEME_MARK = { 순종: '🕊', 감사: '🙏', 겸손: '🌱' } as const

export function SharedHome({ go, sentResolution }: { go: (s: Screen) => void; sentResolution: string | null }) {
  const today = dateKey()
  const { theme, verse } = contentFor(today)

  return (
    <>
      <header className="top">
        <div>
          <p className="eyebrow">{formatKorean(today)} · 🏫 학교 PC</p>
          <p className="theme-line">
            {THEME_MARK[theme]} 오늘의 주제 · <strong>{theme}</strong>
          </p>
        </div>
        <nav className="icons">
          <button className="ghost" onClick={() => go('settings')}>설정</button>
        </nav>
      </header>

      {sentResolution !== null ? (
        <section className="card resolution">
          <p className="label">오늘의 다짐</p>
          <p className="serif big">“{sentResolution || '주님과 함께하는 하루'}”</p>
          <p className="muted small">아이폰으로 보냈어요. 이 창을 닫으면 이 PC에서는 사라져요.</p>
        </section>
      ) : (
        <section className="card hero">
          <p className="serif big">오늘도 말씀 앞에<br />잠시 머물러요.</p>
          <p className="muted">{verse.ref}</p>
          <button className="primary wide" onClick={() => go('flow')}>오늘 묵상 시작</button>
          <p className="muted small">쓴 글은 아이폰으로만 보내지고, 이 PC에는 남지 않아요.</p>
        </section>
      )}
    </>
  )
}
