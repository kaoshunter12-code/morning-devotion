import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db, saveEntry, saveVerseText } from '../lib/db'
import { dateKey } from '../lib/date'
import { contentFor } from '../lib/today'
import { trySync } from '../lib/sync'

interface Draft {
  answer: string
  gratitude: string
  resolution: string
  prayer: string
}
const EMPTY: Draft = { answer: '', gratitude: '', resolution: '', prayer: '' }
const draftKey = (d: string) => `draft:${d}`

function loadDraft(d: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(d))
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

export function Flow({ go }: { go: (s: Screen) => void }) {
  const today = dateKey()
  const content = contentFor(today)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => loadDraft(today) ?? EMPTY)
  const [loaded, setLoaded] = useState(false)
  // undefined = 불러오는 중, null = 아직 본문을 적지 않음
  const verseText = useLiveQuery(async () => (await db.verseTexts.get(content.verse.ref)) ?? null, [content.verse.ref])
  const [editingVerse, setEditingVerse] = useState(false)
  const [verseInput, setVerseInput] = useState('')

  // 이미 저장한 날이면 그 내용을 불러옵니다.
  useEffect(() => {
    db.entries.get(today).then((e) => {
      if (e && !loadDraft(today)) setDraft({ answer: e.answer, gratitude: e.gratitude, resolution: e.resolution, prayer: e.prayer })
      setLoaded(true)
    })
  }, [today])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(draftKey(today), JSON.stringify(draft))
    } catch {
      /* 임시 저장이 안 돼도 흐름은 계속됩니다 */
    }
  }, [draft, loaded, today])

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))

  async function saveVerse() {
    const t = verseInput.trim()
    // 비우거나 개역한글과 같으면 내 본문 대신 개역한글을 씁니다(동기화되도록 빈 값으로 저장).
    await saveVerseText(content.verse.ref, t === content.verse.text ? '' : t)
    setEditingVerse(false)
    trySync()
  }

  async function finish() {
    await saveEntry({
      date: today,
      theme: content.theme,
      verseRef: content.verse.ref,
      question: content.question,
      ...draft,
    })
    try {
      localStorage.removeItem(draftKey(today))
    } catch {
      /* noop */
    }
    setStep(3)
    trySync()
  }

  // 직접 고쳐 적은 본문이 있으면 그것을, 없으면 개역한글 본문을 보여줍니다.
  const shownText = verseText?.text || content.verse.text

  return (
    <>
      <header className="top">
        <button className="ghost" onClick={() => (step > 0 && step < 3 ? setStep(step - 1) : go('home'))}>
          {step > 0 && step < 3 ? '← 이전' : '← 처음으로'}
        </button>
        <div className="progress" aria-label={`${Math.min(step + 1, 4)} / 4단계`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`dot${i <= step ? ' on' : ''}`} />
          ))}
        </div>
      </header>

      {step === 0 && (
        <section className="step">
          <p className="eyebrow">오늘의 말씀 · {content.theme}</p>
          {verseText === undefined ? null : editingVerse ? (
            <>
              <h1 className="serif ref">{content.verse.ref}</h1>
              <label className="field">
                <span>다른 번역으로 바꿔 적을 수 있어요. 비워 두고 저장하면 개역한글로 돌아가요.</span>
                <textarea
                  rows={5}
                  value={verseInput}
                  onChange={(e) => setVerseInput(e.target.value)}
                  placeholder="말씀을 천천히 옮겨 적는 것도 묵상이에요."
                />
              </label>
              <div className="row">
                <button className="secondary" onClick={saveVerse}>본문 저장</button>
                <button className="ghost" onClick={() => setEditingVerse(false)}>취소</button>
              </div>
            </>
          ) : (
            <>
              <blockquote className="verse serif">{shownText}</blockquote>
              <p className="ref-line">
                {content.verse.ref}
                {!verseText?.text && <span className="small"> · 개역한글</span>}
              </p>
              <p className="muted small">천천히 두 번 읽어 보세요.</p>
              <button
                className="link"
                onClick={() => {
                  setVerseInput(shownText)
                  setEditingVerse(true)
                }}
              >
                본문 고치기
              </button>
            </>
          )}
          <button className="primary wide" onClick={() => setStep(1)}>다음</button>
        </section>
      )}

      {step === 1 && (
        <section className="step">
          <p className="eyebrow">묵상 · {content.theme}</p>
          <h1 className="serif question">{content.question}</h1>
          <textarea rows={6} value={draft.answer} onChange={set('answer')} placeholder="떠오르는 대로 적어 보세요." autoFocus />
          <button className="primary wide" onClick={() => setStep(2)}>다음</button>
        </section>
      )}

      {step === 2 && (
        <section className="step">
          <p className="eyebrow">하루를 시작하는 글</p>
          <label className="field">
            <span>감사 한 가지</span>
            <input value={draft.gratitude} onChange={set('gratitude')} placeholder="오늘 아침 감사한 것" autoFocus />
          </label>
          <label className="field">
            <span>오늘의 다짐 (한 줄)</span>
            <input value={draft.resolution} onChange={set('resolution')} placeholder="하루 동안 첫 화면에 보여요" maxLength={80} />
          </label>
          <label className="field">
            <span>짧은 기도</span>
            <textarea rows={4} value={draft.prayer} onChange={set('prayer')} placeholder="주님, 오늘..." />
          </label>
          <button className="primary wide" onClick={finish}>아멘, 저장</button>
        </section>
      )}

      {step === 3 && (
        <section className="step done">
          <p className="serif big">오늘도 주님과 함께.</p>
          {draft.resolution && <p className="serif">“{draft.resolution}”</p>}
          <p className="muted">다짐은 첫 화면에 하루 종일 있어요.</p>
          <div className="row">
            <button className="secondary" onClick={() => go('history')}>기록 보기</button>
            <button className="primary" onClick={() => go('home')}>닫기</button>
          </div>
        </section>
      )}
    </>
  )
}
