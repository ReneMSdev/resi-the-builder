import type { ApplicationSummary } from '../types'

// Builds the Error thrown for a non-OK backend response. FastAPI errors arrive as
// {"detail": "..."}, or as a list of {msg} for request validation errors (422); show
// just the message(s), keeping the status prefix the UI has always shown. Falls back
// to the raw body when it isn't either shape.
export async function responseError(res: Response): Promise<Error> {
  const body = await res.text()
  let message = body
  try {
    const parsed: unknown = JSON.parse(body)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'detail' in parsed &&
      typeof parsed.detail === 'string'
    ) {
      message = parsed.detail
    } else if (parsed && typeof parsed === 'object' && 'detail' in parsed && Array.isArray(parsed.detail)) {
      const msgs = parsed.detail
        .map((d: unknown) =>
          d && typeof d === 'object' && 'msg' in d && typeof d.msg === 'string' ? d.msg : null,
        )
        .filter((m): m is string => m !== null)
      if (msgs.length > 0) message = msgs.join('; ')
    }
  } catch {
    // not JSON; keep the raw body
  }
  return new Error(`${res.status}: ${message}`)
}

// Max length the backend accepts for an application name (RenameApplicationRequest).
export const APPLICATION_NAME_MAX = 120

export async function renameApplication(id: string, name: string): Promise<ApplicationSummary> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not set.')
  const res = await fetch(`${apiUrl}/job-applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() || null }),
  })
  if (!res.ok) throw await responseError(res)
  return res.json()
}
