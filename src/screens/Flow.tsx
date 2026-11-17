import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db, makeEntry, saveEntry, saveVerseText } from '../lib/db'
import { dateKey } from '../lib/date'
import type { DeviceMode } from '../lib/device'
import { sendToPhone } from '../lib/inbox'
import { contentFor } from '../lib/today'

interface Draft {
  answer: string
  gratitude: string
  resolution: string
  prayer: string
}
const EMPTY: Draft = { answer: '', gratitude: '', resolution: '', prayer: '' }
const draftKey = (d: string) => `draft:${d}`

// 아이폰에서만 임시 저장합니다. 학교 PC는 메모리에만 두어 흔적을 남기지 않습니다.
function loadDraft(d: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(d))
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null
  } catch {
    return null
  }
}

interface Props {
  go: (s: Screen) => void
  mode: DeviceMode
  onSent: (resolution: string) => void
}

export function Flow({ go, mode, onSent }: Props) {
  const phone = mode === 'phone'
  const today = dateKey()
  const content = contentFor(today)
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(() => (phone ? loadDraft(today) : null) ?? EMPTY)
  const [loaded, setLoaded] = useState(!phone)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  // undefined = 불러오는 중, null = 직접 고친 본문 없음. 학교 PC는 기기 저장소를 아예 열지 않습니다.
  const verseText = useLiveQuery(
    async () => (phone ? ((await db.verseTexts.get(content.verse.ref)) ?? null) : null),
    [content.verse.ref, phone],
  )
  const [editingVerse, setEditingVerse] = useState(false)
  const [verseInput, setVerseInput] = useState('')
  const shownText = verseText?.text || content.verse.text

  // 아이폰: 이미 저장한 날이면 그 내용을 불러옵니다.
  useEffect(() => {
    if (!phone) return
    db.entries.get(today).then((e) => {
      if (e && !loadDraft(today)) setDraft({ answer: e.answer, gratitude: e.gratitude, resolution: e.resolution, prayer: e.prayer })
      setLoaded(true)
    })
  }, [today, phone])

  useEffect(() => {
    if (!phone || !loaded) return
    try {
      localStorage.setItem(draftKey(today), JSON.stringify(draft))
    } catch {
      /* 임시 저장이 안 돼도 흐름은 계속됩니다 */
    }
  }, [draft, loaded, today, phone])

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))

  async function saveVerse() {
    const t = verseInput.trim()
    await saveVerseText(content.verse.ref, t === content.verse.text ? '' : t)
    setEditingVerse(false)
  }

  async function finish() {
    const input = { date: today, theme: content.theme, verseRef: content.verse.ref, question: content.question, ...draft }
    setErr('')
    if (phone) {
      await saveEntry(input)
      try {
        localStorage.removeItem(draftKey(today))
      } catch {
        /* noop */
      }
      setStep(3)
      return
    }
    setSending(true)
    try {
      await sendToPhone(makeEntry(input))
      onSent(draft.resolution)
      setStep(3)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  // 학교 PC에서는 브라우저가 입력값을 자동완성 기록으로 남기지 않게 합니다.
  const noTrace = { autoComplete: 'off', autoCorrect: 'off', spellCheck: false } as const

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
                <textarea rows={5} value={verseInput} onChange={(e) => setVerseInput(e.target.value)} />
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
              {phone && (
                <button
                  className="link"
                  onClick={() => {
                    setVerseInput(shownText)
                    setEditingVerse(true)
                  }}
                >
                  본문 고치기
                </button>
              )}
            </>
          )}
          <button className="primary wide" onClick={() => setStep(1)}>다음</button>
        </section>
      )}

      {step === 1 && (
        <section className="step">
          <p className="eyebrow">묵상 · {content.theme}</p>
          <h1 className="serif question">{content.question}</h1>
          <textarea rows={6} value={draft.answer} onChange={set('answer')} placeholder="떠오르는 대로 적어 보세요." autoFocus {...noTrace} />
          <button className="primary wide" onClick={() => setStep(2)}>다음</button>
        </section>
      )}

      {step === 2 && (
        <section className="step">
          <p className="eyebrow">하루를 시작하는 글</p>
          <label className="field">
            <span>감사 한 가지</span>
            <input value={draft.gratitude} onChange={set('gratitude')} placeholder="오늘 아침 감사한 것" autoFocus {...noTrace} />
          </label>
          <label className="field">
            <span>오늘의 다짐 (한 줄)</span>
            <input value={draft.resolution} onChange={set('resolution')} placeholder="하루 동안 첫 화면에 보여요" maxLength={80} {...noTrace} />
          </label>
          <label className="field">
            <span>짧은 기도</span>
            <textarea rows={4} value={draft.prayer} onChange={set('prayer')} placeholder="주님, 오늘..." {...noTrace} />
          </label>
          {err && <p className="error banner" role="alert">{err} 글은 아직 이 화면에 있으니 다시 시도해 주세요.</p>}
          <button className="primary wide" onClick={finish} disabled={sending}>
            {phone ? '아멘, 저장' : sending ? '아이폰으로 보내는 중…' : '아멘, 아이폰으로 보내기'}
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="step done">
          <p className="serif big">오늘도 주님과 함께.</p>
          {draft.resolution && <p className="serif">“{draft.resolution}”</p>}
          <p className="muted">
            {phone ? '다짐은 첫 화면에 하루 종일 있어요.' : '아이폰으로 보냈어요. 이 PC에는 저장되지 않았어요.'}
          </p>
          <div className="row">
            {phone && <button className="secondary" onClick={() => go('history')}>기록 보기</button>}
            <button className="primary" onClick={() => go('home')}>닫기</button>
          </div>
        </section>
      )}
    </>
  )
}
