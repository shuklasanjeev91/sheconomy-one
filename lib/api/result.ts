/** Standard API result envelope for Supabase and RPC calls. */
export type ApiResult<T> =
  | { ok: true; data: T; error: null }
  | { ok: false; data: null; error: string }

export type ApiListResult<T> = ApiResult<T[]> & {
  hasMore?: boolean
  page?: number
}

export function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data, error: null }
}

export function fail<T>(error: string): ApiResult<T> {
  return { ok: false, data: null, error }
}

export function fromSupabaseError<T>(
  error: { message: string } | null,
  data: T | null,
  notFoundMessage = 'Not found.',
): ApiResult<T> {
  if (error) return fail(error.message)
  if (data == null) return fail(notFoundMessage)
  return ok(data)
}

export function unwrapOr<T>(result: ApiResult<T>, fallback: T): T {
  return result.ok ? result.data : fallback
}
