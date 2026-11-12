/**
 * Lightweight Sentry capture for Edge Functions.
 * Set SENTRY_DSN in function secrets. No-op when unset.
 */

const SENTRY_DSN = Deno.env.get('SENTRY_DSN')?.trim() || ''
const ENV = Deno.env.get('SENTRY_ENVIRONMENT')?.trim() || Deno.env.get('ENVIRONMENT')?.trim() || 'production'

function parseDsn(dsn: string): { publicKey: string; host: string; projectId: string } | null {
  try {
    const url = new URL(dsn)
    const publicKey = url.username
    const projectId = url.pathname.replace(/^\//, '').split('/')[0]
    if (!publicKey || !projectId) return null
    return { publicKey, host: url.host, projectId }
  } catch {
    return null
  }
}

export async function captureEdgeException(
  error: unknown,
  context?: {
    functionName?: string
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  },
): Promise<void> {
  if (!SENTRY_DSN) return
  const parsed = parseDsn(SENTRY_DSN)
  if (!parsed) return

  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown edge error')

  const payload = {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: ENV,
    server_name: context?.functionName ?? 'supabase-edge',
    tags: {
      runtime: 'deno-edge',
      ...(context?.functionName ? { function: context.functionName } : {}),
      ...(context?.tags ?? {}),
    },
    extra: context?.extra ?? {},
    exception: {
      values: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split('\n')
                  .slice(0, 20)
                  .map((line) => ({ filename: 'edge', function: line.trim() })),
              }
            : undefined,
        },
      ],
    },
  }

  const endpoint = `https://${parsed.host}/api/${parsed.projectId}/store/`
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // Never fail the request because of telemetry
  }
}

export function withSentry<T extends (req: Request) => Promise<Response>>(
  functionName: string,
  handler: T,
): T {
  const wrapped = (async (req: Request) => {
    try {
      return await handler(req)
    } catch (error) {
      await captureEdgeException(error, { functionName })
      throw error
    }
  }) as T
  return wrapped
}
