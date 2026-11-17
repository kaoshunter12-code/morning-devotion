// 종단간 암호화: 비밀문구 → PBKDF2 → AES-GCM 키.
// 서버(Supabase)에는 암호문만 저장되므로 서버 운영자도 글을 읽을 수 없습니다.
const enc = new TextEncoder()
const dec = new TextDecoder()

export const PBKDF2_ITERATIONS = 310_000

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** salt는 사용자 ID로 정합니다. 같은 비밀문구 + 같은 계정이면 어느 기기에서든 같은 키가 나옵니다. */
export async function deriveKey(passphrase: string, saltText: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(`morning-devotion:${saltText}`), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // 키를 밖으로 꺼낼 수 없게(non-extractable) 만듭니다.
    ['encrypt', 'decrypt'],
  )
}

export interface Sealed {
  iv: string
  data: string
}

export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)))
  return { iv: toB64(iv), data: toB64(ct) }
}

export async function open<T>(key: CryptoKey, sealed: Sealed): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.data))
  return JSON.parse(dec.decode(pt)) as T
}

/** 화면 잠금용 PIN 해시 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${salt}:${pin}`))
  return toB64(digest)
}
