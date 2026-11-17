import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Screen } from '../App'
import { db, exportBackup, importBackup, type Backup } from '../lib/db'
import { clearPin, hasPin, setPin } from '../lib/lock'
import { currentUser, getKey, signIn, signOut, syncConfigured, syncNow, unlockWithPassphrase } from '../lib/sync'
import { dateKey } from '../lib/date'

type SyncState = 'off' | 'login' | 'passphrase' | 'ready'

export function Settings({ go, onLockNow }: { go: (s: Screen) => void; onLockNow: () => void }) {
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<string | void>) => {
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
        <p className="eyebrow">설정</p>
      </header>
      {(msg || err) && <p className={err ? 'error banner' : 'ok banner'} role="status">{err || msg}</p>}
      <SyncSection run={run} busy={busy} />
      <PinSection run={run} busy={busy} onLockNow={onLockNow} />
      <BackupSection run={run} busy={busy} />
      <ReminderSection />
    </>
  )
}

type Run = (fn: () => Promise<string | void>) => Promise<void>

function SyncSection({ run, busy }: { run: Run; busy: boolean }) {
  const [state, setState] = useState<SyncState>('off')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [phrase, setPhrase] = useState('')
  const lastSync = useLiveQuery(async () => (await db.meta.get('lastSyncAt'))?.value as number | undefined, [])
  const pending = useLiveQuery(async () => (await db.entries.where('dirty').equals(1).count()) + (await db.verseTexts.where('dirty').equals(1).count()), [])

  const refresh = async () => {
    if (!syncConfigured) return setState('off')
    if (!(await currentUser())) return setState('login')
    setState((await getKey()) ? 'ready' : 'passphrase')
  }
  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="card">
      <p className="label">아이폰 ↔ 학교 PC 동기화</p>
      {state === 'off' && (
        <p className="muted small">
          아직 설정되지 않았어요. README의 “동기화 켜기” 순서대로 Supabase 값을 넣고 다시 배포하면 이 칸이 열려요.
          그 전까지는 이 기기 안에만 저장돼요.
        </p>
      )}
      {state === 'login' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await signIn(email, pw); setPw(''); await refresh() }) }}>
          <input type="email" autoComplete="username" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" autoComplete="current-password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <button className="primary" disabled={busy}>로그인</button>
        </form>
      )}
      {state === 'passphrase' && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await unlockWithPassphrase(phrase); setPhrase(''); await refresh(); const r = await syncNow(); return `연결됐어요. 받은 기록 ${r.pulled}개, 올린 기록 ${r.pushed}개` }) }}>
          <p className="muted small">
            묵상 글을 잠그는 <strong>비밀문구</strong>예요. 로그인 비밀번호와 다르게 정하세요. 두 기기에서 똑같이 입력해야 하고,
            잊어버리면 서버에 있는 글을 되살릴 수 없어요.
          </p>
          <input type="password" autoComplete="new-password" placeholder="비밀문구 (8자 이상)" value={phrase} onChange={(e) => setPhrase(e.target.value)} required minLength={8} />
          <button className="primary" disabled={busy}>잠금 열쇠 만들기</button>
        </form>
      )}
      {state === 'ready' && (
        <div className="stack">
          <p className="small">
            🔒 종단간 암호화로 동기화 중 · 마지막 동기화 {lastSync ? new Date(lastSync).toLocaleString('ko-KR') : '—'}
            {pending ? ` · 올릴 기록 ${pending}개` : ''}
          </p>
          <div className="row">
            <button className="secondary" disabled={busy} onClick={() => run(async () => { const r = await syncNow(); return `받은 기록 ${r.pulled}개, 올린 기록 ${r.pushed}개` })}>지금 동기화</button>
            <button className="ghost" disabled={busy} onClick={() => run(async () => { await signOut(); await refresh(); return '로그아웃했어요. 이 기기의 기록은 그대로 있어요.' })}>로그아웃</button>
          </div>
        </div>
      )}
    </section>
  )
}

function PinSection({ run, busy, onLockNow }: { run: Run; busy: boolean; onLockNow: () => void }) {
  const [on, setOn] = useState(false)
  const [pin, setPinInput] = useState('')
  useEffect(() => {
    hasPin().then(setOn)
  }, [])

  return (
    <section className="card">
      <p className="label">화면 잠금 (이 기기만)</p>
      <p className="muted small">
        학교 PC처럼 다른 사람이 볼 수 있는 기기에서 켜 두세요. 앱을 열 때와 3분 넘게 다른 창에 있다 돌아올 때 PIN을 물어요.
      </p>
      {on ? (
        <div className="row">
          <button className="secondary" onClick={onLockNow}>지금 잠그기</button>
          <button className="ghost" disabled={busy} onClick={() => run(async () => { await clearPin(); setOn(false); return '화면 잠금을 껐어요.' })}>잠금 끄기</button>
        </div>
      ) : (
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await setPin(pin); setPinInput(''); setOn(true); return '화면 잠금을 켰어요.' }) }}>
          <input className="pin-small" type="password" inputMode="numeric" placeholder="숫자 4~8자리" value={pin} maxLength={8} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} />
          <button className="secondary" disabled={busy || pin.length < 4}>PIN 설정</button>
        </form>
      )}
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
      return '백업 파일을 내려받았어요. 암호화되지 않은 파일이니 안전한 곳에 보관하세요.'
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
        <li><strong>학교 PC:</strong> 브라우저 시작 페이지를 이 앱 주소로 정하거나, Chrome/Edge 메뉴의 “앱으로 설치”로 바탕화면에 두세요.</li>
      </ol>
    </section>
  )
}
