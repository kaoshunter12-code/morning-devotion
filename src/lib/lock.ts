import { db, getMeta, setMeta } from './db'
import { hashPin } from './crypto'

// 화면 잠금은 "책상 서랍 자물쇠"입니다. 다른 사람이 화면을 열어 보는 것을 막아 주지만,
// 기기 안의 데이터를 암호화하지는 않아요. 학교 PC에서는 개인 브라우저 프로필도 함께 쓰세요.
export const RELOCK_AFTER_MS = 3 * 60 * 1000

interface PinRecord {
  salt: string
  hash: string
}

export async function hasPin(): Promise<boolean> {
  return Boolean(await getMeta<PinRecord>('pin'))
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN은 숫자 4~8자리로 정해 주세요.')
  const salt = crypto.randomUUID()
  await setMeta('pin', { salt, hash: await hashPin(pin, salt) } satisfies PinRecord)
}

export async function clearPin(): Promise<void> {
  await db.meta.delete('pin')
}

export async function checkPin(pin: string): Promise<boolean> {
  const rec = await getMeta<PinRecord>('pin')
  if (!rec) return true
  return (await hashPin(pin, rec.salt)) === rec.hash
}
