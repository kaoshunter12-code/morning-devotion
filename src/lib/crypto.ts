// 우체통 방식 암호화
// - 아이폰이 RSA 자물쇠(공개키)와 열쇠(개인키)를 만듭니다. 열쇠는 아이폰 밖으로 꺼낼 수 없게 만듭니다.
// - 학교 PC는 자물쇠만 받아서, 글마다 새 AES 키로 잠그고 그 AES 키를 다시 자물쇠로 잠가 보냅니다.
// - 서버와 학교 PC는 열쇠가 없으므로 내용을 볼 수 없습니다.
const enc = new TextEncoder()
const dec = new TextDecoder()

const RSA: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 3072,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

export function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** 개인키는 추출 불가(extractable=false), 공개키는 언제나 내보낼 수 있습니다. */
export async function generateInboxKeys(): Promise<{ keys: CryptoKeyPair; publicJwk: JsonWebKey }> {
  const keys = await crypto.subtle.generateKey(RSA, false, ['encrypt', 'decrypt'])
  const publicJwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
  return { keys, publicJwk }
}

export function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
}

export interface Letter {
  wrapped_key: string
  iv: string
  data: string
}

export async function sealFor(publicKey: CryptoKey, value: unknown): Promise<Letter> {
  const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, enc.encode(JSON.stringify(value)))
  const raw = await crypto.subtle.exportKey('raw', aes)
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw)
  return { wrapped_key: toB64(wrapped), iv: toB64(iv), data: toB64(ct) }
}

export async function openWith<T>(privateKey: CryptoKey, letter: Letter): Promise<T> {
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromB64(letter.wrapped_key))
  const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(letter.iv) }, aes, fromB64(letter.data))
  return JSON.parse(dec.decode(pt)) as T
}

/** 두 기기에서 같은 자물쇠인지 눈으로 비교할 수 있는 짧은 지문 */
export async function fingerprint(jwk: JsonWebKey): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`${jwk.n}.${jwk.e}`)))
  return Array.from(digest.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()
}
