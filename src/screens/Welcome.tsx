import type { DeviceMode } from '../lib/device'

export function Welcome({ onChoose }: { onChoose: (m: DeviceMode) => void }) {
  return (
    <section className="welcome">
      <p className="eyebrow">아침 5분 묵상</p>
      <h1 className="serif">이 기기는 어떤 기기인가요?</h1>
      <button className="choice" onClick={() => onChoose('phone')}>
        <strong>📱 내 아이폰</strong>
        <span>기록을 이 기기에 보관해요. 학교 PC에서 쓴 글도 여기로 모여요.</span>
      </button>
      <button className="choice" onClick={() => onChoose('shared')}>
        <strong>🏫 학교 PC</strong>
        <span>글을 써서 아이폰으로 보내기만 해요. 이 PC에는 기록이 남지 않아요.</span>
      </button>
      <p className="muted small">나중에 설정에서 바꿀 수 있어요.</p>
    </section>
  )
}
