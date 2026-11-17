import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db, exportBackup, importBackup, type Backup } from '../lib/db'
import { dateKey } from '../lib/date'
import type { DeviceMode } from '../lib/device'
import {
  currentUser,
  fetchPhoneLock,
  inboxConfigured,
  phoneFingerprint,
  receiveInbox,
  setupPhoneInbox,
  signIn,
  signOut,
  wipeThisDevice,
} from '../lib/inbox'

type Run = (fn: () => Promise<string | void>) => Promise<void>

interface Props {
  go: (s: Screen) => void
  mode: DeviceMode
  onChangeMode: (m: DeviceMode | null) => void
}

export function Settings({ go, mode, onChangeMode }: Props) {
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const run: Run = async (fn) => {
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const m = await fn()
      if (m) setMsg(m)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="top">
        <button className="ghost" onClick={() => go('home')}>← 처음으로</button>
        <p className="eyebrow">설정 · {mode === 'phone' ? '📱 내 아이폰' : '🏫 학교 PC'}</p>
      </header>
      {(msg || err) && <p className={err ? 'error banner' : 'ok banner'} role="status">{err || msg}</p>}
      {mode === 'phone' ? (
        <>
          <PhoneInbox run={run} busy={busy} />
          <BackupSection run={run} busy={busy} />
        </>
      ) : (
        <SharedInbox run={run} busy={busy} onWiped={() => onChangeMode(null)} />
      )}
      <ReminderSection />
      <section className="card">
        <p className="label">이 기기의 역할</p>
        <button className="ghost" onClick={() => onChangeMode(null)}>역할 다시 고르기</button>
      </section>
    </>
  )
}

function LoginForm({ run, busy, onDone }: { run: Run; busy: boolean; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          await signIn(email, pw)
          setPw('')
          onDone()
        })
      }}
    >
      <input type="email" autoComplete="username" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" autoComplete="current-password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} required />
      <button className="primary" disabled={busy}>로그인</button>
    </form>
  )
}

function NotConfigured() {
  return (
    <p className="muted small">
      아직 우편함(Supabase)이 설정되지 않았어요. README의 “우편함 켜기” 순서대로 설정하고 다시 배포하면 이 칸이 열려요.
    </p>
  )
}

function PhoneInbox({ run, busy }: { run: Run; busy: boolean }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [fp, setFp] = useState<string | null>(null)
  const lastReceive = useLiveQuery(async () => (await db.meta.get('lastReceiveAt'))?.value as number | undefined, [])

  const refresh = async () => {
    setLoggedIn(Boolean(await currentUser()))
    setFp(await phoneFingerprint())
  }
  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="card">
      <p className="label">학교 PC에서 보낸 글 받기</p>
      {!inboxConfigured ? (
        <NotConfigured />
      ) : loggedIn === false ? (
        <LoginForm run={run} busy={busy} onDone={refresh} />
      ) : loggedIn && !fp ? (
        <div className="stack">
          <p className="muted small">
            아이폰만 열 수 있는 자물쇠와 열쇠를 만들어요. 자물쇠는 학교 PC에 나눠 주고, 열쇠는 이 아이폰 밖으로 나가지 않아요.
          </p>
          <button className="primary" disabled={busy} onClick={() => run(async () => { await setupPhoneInbox(); await refresh(); return '우편함을 준비했어요.' })}>
            우편함 준비하기
          </button>
        </div>
      ) : loggedIn && fp ? (
        <div className="stack">
          <p className="small">
            🔒 자물쇠 지문 <code>{fp}</code>
            <br />
            <span className="muted">학교 PC 설정에 보이는 지문과 같으면 안전하게 연결된 거예요.</span>
          </p>
          <p className="small muted">마지막으로 받은 시각 {lastReceive ? new Date(lastReceive).toLocaleString('ko-KR') : '—'}</p>
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => run(async () => { await setupPhoneInbox(); const n = await receiveInbox(); return n ? `새 글 ${n}개를 받았어요.` : '새로 온 글이 없어요.' })}>
              지금 받기
            </button>
            <button className="ghost" disabled={busy} onClick={() => run(async () => { await signOut(); await refresh(); return '로그아웃했어요. 이 아이폰의 기록은 그대로 있어요.' })}>
              로그아웃
            </button>
          </div>
        </div>
      ) : null}
      <p className="muted small">
        기록은 이 아이폰에만 보관돼요. 아이폰을 바꾸거나 Safari 데이터를 지우면 사라지니, 가끔 아래 “내보내기”로 백업해 두세요.
      </p>
    </section>
  )
}

function SharedInbox({ run, busy, onWiped }: { run: Run; busy: boolean; onWiped: () => void }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [fp, setFp] = useState<string | null | undefined>(undefined)

  const refresh = async () => {
    const ok = Boolean(await currentUser())
    setLoggedIn(ok)
    if (ok) {
      try {
        setFp((await fetchPhoneLock())?.fingerprint ?? null)
      } catch {
        setFp(undefined)
      }
    }
  }
  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="card">
      <p className="label">아이폰으로 보내기</p>
      {!inboxConfigured ? (
        <NotConfigured />
      ) : loggedIn === false ? (
        <>
          <p className="muted small">아이폰과 같은 계정으로 로그인하세요. 브라우저가 비밀번호 저장을 물으면 “저장 안 함”을 고르세요.</p>
          <LoginForm run={run} busy={busy} onDone={refresh} />
        </>
      ) : loggedIn ? (
        <div className="stack">
          {fp ? (
            <p className="small">
              🔒 아이폰 자물쇠 지문 <code>{fp}</code>
              <br />
              <span className="muted">아이폰 설정의 지문과 같은지 한 번 확인해 주세요.</span>
            </p>
          ) : (
            <p className="small error">아이폰에서 먼저 “우편함 준비하기”를 눌러 주세요.</p>
          )}
          <p className="muted small">
            이 PC에는 글이 저장되지 않아요. 로그인 정보만 남아 있고, 그것으로는 이미 보낸 글을 열 수 없어요.
          </p>
        </div>
      ) : null}
      <button
        className="secondary"
        disabled={busy}
        onClick={() => run(async () => { await wipeThisDevice(); onWiped() })}
      >
        이 PC에서 로그아웃하고 모두 지우기
      </button>
    </section>
  )
}

function BackupSection({ run, busy }: { run: Run; busy: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () =>
    run(async () => {
      const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `아침묵상-백업-${dateKey()}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      return '백업 파일을 만들었어요. 암호화되지 않은 파일이니 iCloud Drive 같은 개인 공간에 보관하세요.'
    })

  const upload = (f: File) =>
    run(async () => {
      const n = await importBackup(JSON.parse(await f.text()) as Backup)
      return `${n}일치 기록을 가져왔어요.`
    })

  return (
    <section className="card">
      <p className="label">백업</p>
      <div className="row">
        <button className="secondary" disabled={busy} onClick={download}>내보내기</button>
        <button className="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>가져오기</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
    </section>
  )
}

function ReminderSection() {
  return (
    <section className="card">
      <p className="label">8시 50분 알림</p>
      <ol className="small steps">
        <li><strong>아이폰:</strong> 단축어 앱 → 자동화 → ＋ → 특정 시간 → 오전 8:50, 매주 월~금 → “즉시 실행” → 동작 “URL 열기”에 이 앱 주소</li>
        <li><strong>학교 PC:</strong> 북마크해 두고 아침에 여세요. 다 쓰면 탭을 닫으면 돼요.</li>
      </ol>
    </section>
  )
}
