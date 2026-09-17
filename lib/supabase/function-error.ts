/**
 * supabase-js wraps non-2xx edge responses in FunctionsHttpError with the
 * unhelpful message "Edge Function returned a non-2xx status code". The real
 * reason is usually in `data.error` or `error.context` (Response body).
 */
export async function readSupabaseFunctionError(
  error: unknown,
  data: unknown,
  fallback: string,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error
    if (typeof message === 'string' && message.trim()) return message.trim()
  }

  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string' && message.trim() && !/non-2xx/i.test(message)) {
      return message.trim()
    }
  }

  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (typeof Response !== 'undefined' && context instanceof Response) {
      try {
        const body = (await context.clone().json()) as { error?: unknown; message?: unknown }
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
        if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim()
      } catch {
        try {
          const text = (await context.clone().text()).trim()
          if (text && !/non-2xx/i.test(text)) return text.slice(0, 240)
        } catch {
          // Body already consumed — fall through.
        }
      }
    }
    if (context && typeof context === 'object' && typeof (context as { json?: unknown }).json === 'function') {
      try {
        const body = (await (context as Response).clone().json()) as {
          error?: unknown
          message?: unknown
        }
        if (typeof body?.error === 'string' && body.error.trim()) return body.error.trim()
        if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim()
      } catch {
        // ignore
      }
    }
  }

  if (error instanceof Error && error.message && !/non-2xx|Edge Function/i.test(error.message)) {
    return error.message
  }

  return fallback
}
