import type { ApiError, ApiErrorCode } from '../../src/lib/registration/types.js'
import type { FieldIssue } from '../../src/lib/registration/schema.js'

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

const statuses: Record<ApiErrorCode, number> = {
  validation: 400,
  closed: 403,
  notFound: 404,
  invoiceFull: 409,
  alreadyRegistered: 409,
  rateLimited: 429,
  server: 500,
}

export function apiError(error: ApiErrorCode, issues?: FieldIssue[]): Response {
  const body: ApiError = issues ? { error, issues } : { error }
  return json(body, statuses[error], { 'cache-control': 'no-store' })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export async function hashClient(request: Request): Promise<string> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cwo:${ip}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
