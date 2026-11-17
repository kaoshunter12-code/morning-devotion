import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db } from '../lib/db'
import { addDays, dateKey, formatKorean } from '../lib/date'

export function History({ go }: { go: (s: Screen) => void }) {
  const entries = useLiveQuery(() => db.entries.orderBy('date').reverse().toArray(), [])
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const yearAgo = addDays(dateKey(), -365)
  const lastYear = entries?.find((e) => e.date === yearAgo)

  const term = q.trim()
  const list = (entries ?? []).filter(
    (e) => !term || [e.verseRef, e.answer, e.gratitude, e.resolution, e.prayer].some((t) => t.includes(term)),
  )

  return (
    <>
      <header className="top">
        <button className="ghost" onClick={() => go('home')}>← 처음으로</button>
        <p className="eyebrow">지난 기록 · {entries?.length ?? 0}일</p>
      </header>

      {lastYear && (
        <section className="card">
          <p className="label">1년 전 오늘</p>
          <p className="serif">“{lastYear.resolution}”</p>
          <p className="muted small">{lastYear.verseRef}</p>
        </section>
      )}

      <input className="search" type="search" placeholder="말씀이나 글로 찾기" value={q} onChange={(e) => setQ(e.target.value)} />

      {entries && entries.length === 0 && <p className="muted center-text">아직 기록이 없어요. 내일 아침에 만나요.</p>}

      <ul className="history">
        {list.map((e) => (
          <li key={e.date} className="card">
            <button className="history-head" onClick={() => setOpen(open === e.date ? null : e.date)} aria-expanded={open === e.date}>
              <span className="muted small">{formatKorean(e.date)} · {e.theme}</span>
              <span className="serif">{e.resolution || e.verseRef}</span>
            </button>
            {open === e.date && (
              <dl className="detail">
                <dt>말씀</dt>
                <dd>{e.verseRef}</dd>
                <dt>{e.question}</dt>
                <dd>{e.answer || '—'}</dd>
                <dt>감사</dt>
                <dd>{e.gratitude || '—'}</dd>
                <dt>다짐</dt>
                <dd>{e.resolution || '—'}</dd>
                <dt>기도</dt>
                <dd>{e.prayer || '—'}</dd>
              </dl>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
