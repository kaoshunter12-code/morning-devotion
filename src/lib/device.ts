// 이 기기의 역할. 민감한 값이 아니라서 localStorage에 둡니다.
export type DeviceMode = 'phone' | 'shared'

const KEY = 'deviceMode'

export function getDeviceMode(): DeviceMode | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'phone' || v === 'shared' ? v : null
  } catch {
    return null
  }
}

export function setDeviceMode(m: DeviceMode | null): void {
  try {
    if (m) localStorage.setItem(KEY, m)
    else localStorage.removeItem(KEY)
  } catch {
    /* 저장이 안 되면 다음에 다시 물어봅니다 */
  }
}
