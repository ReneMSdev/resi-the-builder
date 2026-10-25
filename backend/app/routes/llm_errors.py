import anthropic
from fastapi import HTTPException


def _api_error_message(e: anthropic.APIStatusError) -> str:
    """Anthropic's own error text from the response body, falling back to the SDK message
    (which already embeds the status code and the raw body)."""
    body = e.body
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict) and error.get("message"):
            return error["message"]
    return e.message


def anthropic_http_exception(e: anthropic.APIError) -> HTTPException:
    """Map an Anthropic SDK error to an HTTPException with a readable detail.

    Without this, an SDK error escapes the route as an unhandled 500, which goes out
    without CORS headers, so the browser only reports "Failed to fetch".
    """
    if isinstance(e, anthropic.AuthenticationError):
        return HTTPException(
            status_code=502,
            detail="Anthropic API rejected the API key (401). Update ANTHROPIC_API_KEY in "
            "backend/.env and restart the backend.",
        )
    if isinstance(e, anthropic.RateLimitError):
        return HTTPException(
            status_code=429, detail="Anthropic API rate limit reached. Try again shortly."
        )
    if isinstance(e, anthropic.APIStatusError):
        return HTTPException(
            status_code=502,
            detail=f"Anthropic API error ({e.status_code}): {_api_error_message(e)}",
        )
    # APITimeoutError subclasses APIConnectionError, so it must be checked first.
    if isinstance(e, anthropic.APITimeoutError):
        return HTTPException(
            status_code=504, detail="Anthropic API request timed out. Try again."
        )
    if isinstance(e, anthropic.APIConnectionError):
        return HTTPException(status_code=502, detail="Could not reach the Anthropic API.")
    return HTTPException(status_code=502, detail=f"Anthropic API error: {e.message}")
