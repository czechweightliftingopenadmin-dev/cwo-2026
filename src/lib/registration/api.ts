import type { FieldIssue, LookupInput, UpdateInput } from './schema'
import type {
  ApiErrorCode,
  CreatedRegistration,
  LookupResult,
  Startlist,
  UpdatedRegistration,
} from './types'

export type ClientErrorCode = ApiErrorCode | 'network'

export type ApiResult<T> =
  { ok: true; data: T } | { ok: false; error: ClientErrorCode; issues?: FieldIssue[] }

async function request<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(
      path,
      body === undefined
        ? undefined
        : {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          },
    )
    const data: unknown = await response.json().catch(() => null)
    if (response.ok && data) return { ok: true, data: data as T }
    const error = data as { error?: ApiErrorCode; issues?: FieldIssue[] } | null
    return { ok: false, error: error?.error ?? 'server', issues: error?.issues }
  } catch {
    return { ok: false, error: 'network' }
  }
}

/** The body is validated on the server; it carries the honeypot field as well. */
export const registerAthletes = (body: unknown) =>
  request<CreatedRegistration>('/api/register', body)
export const lookupRegistration = (body: LookupInput) => request<LookupResult>('/api/lookup', body)
export const updateRegistration = (body: UpdateInput) =>
  request<UpdatedRegistration>('/api/update', body)
export const fetchStartlist = () => request<Startlist>('/api/startlist')
