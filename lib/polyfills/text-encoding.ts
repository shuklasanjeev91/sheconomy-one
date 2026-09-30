/** UTF-8 TextEncoder / TextDecoder for Hermes builds that lack them. */

class Utf8TextEncoder {
  readonly encoding = 'utf-8'

  encode(input = ''): Uint8Array {
    const text = String(input)
    const bytes: number[] = []
    for (let index = 0; index < text.length; index += 1) {
      let code = text.charCodeAt(index)
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
        const next = text.charCodeAt(index + 1)
        if (next >= 0xdc00 && next <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00)
          index += 1
        }
      }
      if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd
      if (code < 0x80) {
        bytes.push(code)
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
      } else {
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f),
        )
      }
    }
    return new Uint8Array(bytes)
  }

  encodeInto(input: string, destination: Uint8Array) {
    const encoded = this.encode(input)
    const written = Math.min(encoded.length, destination.length)
    destination.set(encoded.subarray(0, written))
    return { read: input.length, written }
  }
}

function toBytes(input?: ArrayBuffer | ArrayBufferView | null): Uint8Array {
  if (!input) return new Uint8Array(0)
  if (input instanceof Uint8Array) return input
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  return new Uint8Array(input)
}

class Utf8TextDecoder {
  readonly encoding = 'utf-8'
  readonly fatal = false
  readonly ignoreBOM = false

  constructor(label = 'utf-8') {
    const normalized = String(label).trim().toLowerCase()
    if (normalized !== 'utf-8' && normalized !== 'utf8' && normalized !== 'unicode-1-1-utf-8') {
      throw new RangeError(`The "${label}" encoding is not supported`)
    }
  }

  decode(input?: ArrayBuffer | ArrayBufferView | null): string {
    const bytes = toBytes(input)
    let start = 0
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3
    let out = ''
    const chunk: number[] = []
    const flush = () => {
      out += String.fromCharCode(...chunk)
      chunk.length = 0
    }
    for (let index = start; index < bytes.length; ) {
      const byte = bytes[index]!
      let code = 0xfffd
      let size = 1
      if (byte < 0x80) {
        code = byte
      } else if (byte >= 0xc2 && byte < 0xe0 && index + 1 < bytes.length) {
        code = ((byte & 0x1f) << 6) | (bytes[index + 1]! & 0x3f)
        size = 2
      } else if (byte >= 0xe0 && byte < 0xf0 && index + 2 < bytes.length) {
        code = ((byte & 0x0f) << 12) | ((bytes[index + 1]! & 0x3f) << 6) | (bytes[index + 2]! & 0x3f)
        size = 3
      } else if (byte >= 0xf0 && byte < 0xf5 && index + 3 < bytes.length) {
        code =
          ((byte & 0x07) << 18) |
          ((bytes[index + 1]! & 0x3f) << 12) |
          ((bytes[index + 2]! & 0x3f) << 6) |
          (bytes[index + 3]! & 0x3f)
        size = 4
      }
      index += size
      if (code > 0xffff) {
        code -= 0x10000
        chunk.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff))
      } else {
        chunk.push(code)
      }
      if (chunk.length >= 8192) flush()
    }
    flush()
    return out
  }
}

const scope = globalThis as unknown as Record<string, unknown>
if (typeof scope.TextEncoder !== 'function') scope.TextEncoder = Utf8TextEncoder
if (typeof scope.TextDecoder !== 'function') scope.TextDecoder = Utf8TextDecoder
