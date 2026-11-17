/** 같은 항목이 기기와 서버에 모두 있을 때, 마지막으로 고친 쪽을 남깁니다. */
export function newerSide(localUpdatedAt: number | undefined, remoteUpdatedAt: number | undefined): 'local' | 'remote' | 'same' {
  const l = localUpdatedAt ?? -1
  const r = remoteUpdatedAt ?? -1
  if (l === r) return 'same'
  return l > r ? 'local' : 'remote'
}
