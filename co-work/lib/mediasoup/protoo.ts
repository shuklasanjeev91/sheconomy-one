/**
 * Minimal protoo peer (the mediasoup-demo signalling protocol) over one WebSocket.
 * Wire format: https://protoo.versatica.com/#message-format
 */

export type ProtooRequestHandler = (
  method: string,
  data: unknown,
) => Promise<unknown> | unknown

export type ProtooNotificationHandler = (method: string, data: unknown) => void

export type ProtooWebSocketFactory = (url: string, protocol: string) => WebSocket

type ProtooMessage =
  | { request: true; id: number; method: string; data?: unknown }
  | { response: true; id: number; ok: true; data?: unknown }
  | { response: true; id: number; ok: false; errorCode?: number; errorReason?: string }
  | { notification: true; method: string; data?: unknown }

type Pending = {
  method: string
  resolve: (data: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class ProtooRequestError extends Error {
  readonly code: number | undefined

  constructor(method: string, code: number | undefined, reason: string | undefined) {
    super(reason ? `${method}: ${reason}` : `${method} failed`)
    this.name = 'ProtooRequestError'
    this.code = code
  }
}

export function parseProtooMessage(raw: unknown): ProtooMessage | null {
  if (typeof raw !== 'string') return null
  let message: unknown
  try {
    message = JSON.parse(raw)
  } catch {
    return null
  }
  if (!message || typeof message !== 'object') return null
  const m = message as Record<string, unknown>
  if (m.request === true && typeof m.id === 'number' && typeof m.method === 'string') {
    return m as ProtooMessage
  }
  if (m.response === true && typeof m.id === 'number') return m as ProtooMessage
  if (m.notification === true && typeof m.method === 'string') return m as ProtooMessage
  return null
}

function randomRequestId(): number {
  return Math.floor(Math.random() * 10_000_000)
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export class ProtooPeer {
  private readonly socket: WebSocket
  private readonly pending = new Map<number, Pending>()
  private readonly requestTimeoutMs: number
  private closed = false
  private opened = false

  onRequest: ProtooRequestHandler = () => {
    throw new Error('Unhandled protoo request')
  }
  onNotification: ProtooNotificationHandler = () => {}
  /** Fires once when the socket closes for any reason after `open` resolved. */
  onClose: (reason: string) => void = () => {}

  readonly open: Promise<void>

  constructor(
    url: string,
    options: { createWebSocket?: ProtooWebSocketFactory; requestTimeoutMs?: number } = {},
  ) {
    const create = options.createWebSocket ?? ((u, p) => new WebSocket(u, p))
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.socket = create(url, 'protoo')

    this.open = new Promise<void>((resolve, reject) => {
      this.socket.onopen = () => {
        this.opened = true
        resolve()
      }
      this.socket.onerror = () => {
        if (!this.opened) reject(new Error('Could not reach the meeting media server.'))
      }
      this.socket.onclose = (event) => {
        const reason = event.reason || `socket closed (${event.code})`
        if (!this.opened) reject(new Error(reason))
        this.teardown(reason)
      }
    })
    this.socket.onmessage = (event) => this.handleMessage(event.data)
  }

  get isClosed(): boolean {
    return this.closed
  }

  request<T = unknown>(method: string, data: unknown = {}): Promise<T> {
    if (this.closed) return Promise.reject(new Error('Signalling connection is closed.'))
    const id = randomRequestId()
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`${method}: request timed out`))
      }, this.requestTimeoutMs)
      this.pending.set(id, {
        method,
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
      })
      this.send({ request: true, id, method, data })
    })
  }

  notify(method: string, data: unknown = {}): void {
    if (this.closed) return
    this.send({ notification: true, method, data })
  }

  /** Close from our side; `onClose` does not fire. */
  close(): void {
    if (this.closed) return
    this.teardown('closed by client', false)
    try {
      this.socket.close()
    } catch {
      // Already closing.
    }
  }

  private send(message: ProtooMessage) {
    try {
      this.socket.send(JSON.stringify(message))
    } catch {
      // The close handler rejects anything still pending.
    }
  }

  private teardown(reason: string, notify = true) {
    if (this.closed) return
    this.closed = true
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`Signalling connection closed: ${reason}`))
    }
    this.pending.clear()
    if (this.opened && notify) this.onClose(reason)
  }

  private handleMessage(raw: unknown) {
    const message = parseProtooMessage(raw)
    if (!message) return

    if ('response' in message) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.ok) pending.resolve(message.data)
      else pending.reject(new ProtooRequestError(pending.method, message.errorCode, message.errorReason))
      return
    }

    if ('notification' in message) {
      this.onNotification(message.method, message.data)
      return
    }

    const { id, method, data } = message
    void (async () => {
      try {
        const result = await this.onRequest(method, data)
        this.send({ response: true, id, ok: true, data: result ?? {} })
      } catch (error) {
        this.send({
          response: true,
          id,
          ok: false,
          errorCode: 500,
          errorReason: error instanceof Error ? error.message : String(error),
        })
      }
    })()
  }
}
