import { useEffect, useRef, useState } from 'react'
import { hasPin, RELOCK_AFTER_MS } from './lib/lock'
import { trySync } from './lib/sync'
import { Home } from './screens/Home'
import { Flow } from './screens/Flow'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { Lock } from './screens/Lock'

export type Screen = 'home' | 'flow' | 'history' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [locked, setLocked] = useState<boolean | null>(null)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    hasPin().then(setLocked)
    trySync()
    const onVis = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else {
        if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS && (await hasPin())) setLocked(true)
        hiddenAt.current = null
        trySync()
      }
    }
    const onOnline = () => trySync()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  if (locked === null) return null
  if (locked) return <Lock onUnlock={() => setLocked(false)} />

  return (
    <main className="app">
      {screen === 'home' && <Home go={setScreen} />}
      {screen === 'flow' && <Flow go={setScreen} />}
      {screen === 'history' && <History go={setScreen} />}
      {screen === 'settings' && <Settings go={setScreen} onLockNow={() => setLocked(true)} />}
    </main>
  )
}
