/**
 * PayU Hosted Checkout posts to surl/furl (POST).
 * SPA `/orders/payu-return` is GET-only — this API accepts POST and 303s to the SPA.
 */

function destination(request: Request): string {
  const url = new URL(request.url)
  const status = url.searchParams.get('status')?.toLowerCase() === 'success' ? 'success' : 'failure'
  const embed = url.searchParams.get('embed')
  const dest = new URL('/orders/payu-return', url.origin)
  dest.searchParams.set('status', status)
  if (embed === '1' || embed?.toLowerCase() === 'true') {
    dest.searchParams.set('embed', '1')
  }
  return dest.toString()
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'POST') {
    try {
      await request.arrayBuffer()
    } catch {
      // ignore
    }
  }
  return Response.redirect(destination(request), 303)
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}

export async function HEAD(request: Request) {
  return new Response(null, {
    status: 303,
    headers: { Location: destination(request) },
  })
}
