import { describe, expect, it } from 'vitest'
import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '@/shared/sync/base64'

describe('base64 utf8', () => {
  it('round-trips Chinese text', () => {
    const text = '腾讯视频 — 收藏 日本語テスト'
    expect(decodeBase64ToUtf8(encodeUtf8ToBase64(text))).toBe(text)
  })

  it('decodes UTF-8 bytes that plain atob would garble', () => {
    const text = '腾讯视频'
    const b64 = encodeUtf8ToBase64(text)
    const garbled = atob(b64)
    expect(garbled).not.toBe(text)
    expect(decodeBase64ToUtf8(b64)).toBe(text)
  })

  it('ignores newlines in base64 payloads', () => {
    const text = '你好'
    const b64 = encodeUtf8ToBase64(text)
    const wrapped = `${b64.slice(0, 4)}\n${b64.slice(4)}`
    expect(decodeBase64ToUtf8(wrapped)).toBe(text)
  })
})
