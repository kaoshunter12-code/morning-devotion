import { useEffect, useState } from 'react'
import { getDeviceMode, setDeviceMode, type DeviceMode } from './lib/device'
import { tryReceive } from './lib/inbox'
import { Home } from './screens/Home'
import { SharedHome } from './screens/SharedHome'
import { Flow } from './screens/Flow'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { Welcome } from './screens/Welcome'

export type Screen = 'home' | 'flow' | 'history' | 'settings'

export default function App() {
  const [mode, setMode] = useState<DeviceMode | null>(getDeviceMode)
  const [screen, setScreen] = useState<Screen>('home')
  // 학교 PC: 오늘 보낸 다짐은 메모리에만 둡니다(탭을 닫으면 사라짐).
  const [sentResolution, setSentResolution] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'phone') return
    tryReceive()
    const onVis = () => document.visibilityState === 'visible' && tryReceive()
    const onOnline = () => tryReceive()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
    }
  }, [mode])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  const choose = (m: DeviceMode | null) => {
    setDeviceMode(m)
    setMode(m)
    setScreen('home')
  }

  if (!mode) return <main className="app center"><Welcome onChoose={choose} /></main>

  return (
    <main className="app">
      {screen === 'home' && (mode === 'phone' ? <Home go={setScreen} /> : <SharedHome go={setScreen} sentResolution={sentResolution} />)}
      {screen === 'flow' && <Flow go={setScreen} mode={mode} onSent={setSentResolution} />}
      {screen === 'history' && mode === 'phone' && <History go={setScreen} />}
      {screen === 'settings' && <Settings go={setScreen} mode={mode} onChangeMode={choose} />}
    </main>
  )
}
