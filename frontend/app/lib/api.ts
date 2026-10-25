// Builds the Error thrown for a non-OK backend response. FastAPI errors arrive as
// {"detail": "..."}; show just that message, keeping the status prefix the UI has
// always shown. Falls back to the raw body when it isn't that shape.
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
    }
  } catch {
    // not JSON; keep the raw body
  }
  return new Error(`${res.status}: ${message}`)
}
