import { useState } from 'react'
import { checkPin } from '../lib/lock'

export function Lock({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (await checkPin(pin)) onUnlock()
    else {
      setErr('PIN이 맞지 않아요.')
      setPin('')
    }
  }

  return (
    <main className="app center">
      <form className="lock" onSubmit={submit}>
        <p className="eyebrow">아침 5분 묵상</p>
        <h1 className="serif">잠시 마음을 고요히</h1>
        <input
          className="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-label="PIN"
          placeholder="PIN"
        />
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={pin.length < 4}>열기</button>
      </form>
    </main>
  )
}
