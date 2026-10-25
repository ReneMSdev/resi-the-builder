import anthropic
import httpx2
import pytest

from app.services import llm as llm_module
from app.services import usage_guard

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
JD = {"job_description": "A generic job description."}


def _request():
    return httpx2.Request("POST", ANTHROPIC_URL)


def _status_error(cls, status, body=None):
    response = httpx2.Response(status, request=_request())
    return cls(f"Error code: {status} - {body}", response=response, body=body)


def _raiser(exc):
    def _raise(*args, **kwargs):
        raise exc

    return _raise


def _revise_payload(kind, minimal_resume, minimal_cover_letter, minimal_profile):
    doc = {"resume": minimal_resume, "cover_letter": minimal_cover_letter, "profile": minimal_profile}
    return {kind: doc[kind], "selected_ids": ["b_1"], "instruction": "punchier"}


def test_generate_bad_api_key_returns_502_with_cors(client, mock_llm, tmp_profile_path):
    """A rejected key used to escape as an unhandled 500 without CORS headers, which the
    browser surfaces only as "Failed to fetch"."""
    mock_llm(side_effect=_raiser(_status_error(anthropic.AuthenticationError, 401)))

    resp = client.post("/generate", json=JD, headers={"Origin": "http://localhost:3000"})

    assert resp.status_code == 502
    assert "API key" in resp.json()["detail"]
    assert resp.headers.get("access-control-allow-origin") == "*"


@pytest.mark.parametrize("kind", ["resume", "cover_letter", "profile"])
def test_revise_bad_api_key_returns_502(
    client, mock_llm, minimal_resume, minimal_cover_letter, minimal_profile, kind
):
    mock_llm(side_effect=_raiser(_status_error(anthropic.AuthenticationError, 401)))

    resp = client.post(
        "/revise", json=_revise_payload(kind, minimal_resume, minimal_cover_letter, minimal_profile)
    )

    assert resp.status_code == 502
    assert "API key" in resp.json()["detail"]


def test_missing_api_key_returns_502_without_using_daily_cap(
    client, mock_llm, tmp_profile_path, monkeypatch
):
    """With no key configured the SDK raises a plain TypeError, which isn't an APIError, so
    the check has to happen before the call."""
    mock_llm("{}")
    monkeypatch.setattr(llm_module.client, "api_key", None)

    resp = client.post("/generate", json=JD, headers={"Origin": "http://localhost:3000"})

    assert resp.status_code == 502
    assert "ANTHROPIC_API_KEY is not set" in resp.json()["detail"]
    assert resp.headers.get("access-control-allow-origin") == "*"
    assert usage_guard._call_count == 0


def test_generate_anthropic_rate_limit_returns_429(client, mock_llm, tmp_profile_path):
    mock_llm(side_effect=_raiser(_status_error(anthropic.RateLimitError, 429)))

    resp = client.post("/generate", json=JD)

    assert resp.status_code == 429
    assert "rate limit" in resp.json()["detail"]


def test_generate_server_error_uses_anthropic_message(client, mock_llm, tmp_profile_path):
    body = {"type": "error", "error": {"type": "api_error", "message": "Internal server error"}}
    mock_llm(side_effect=_raiser(_status_error(anthropic.InternalServerError, 500, body)))

    resp = client.post("/generate", json=JD)

    assert resp.status_code == 502
    assert resp.json()["detail"] == "Anthropic API error (500): Internal server error"


def test_generate_timeout_returns_504(client, mock_llm, tmp_profile_path):
    mock_llm(side_effect=_raiser(anthropic.APITimeoutError(request=_request())))

    resp = client.post("/generate", json=JD)

    assert resp.status_code == 504
    assert "timed out" in resp.json()["detail"]


@pytest.mark.parametrize(
    "exc",
    [
        anthropic.APIConnectionError(request=_request()),
        anthropic.APIResponseValidationError(
            httpx2.Response(200, request=_request()), body=None, message="Unexpected response shape"
        ),
    ],
)
def test_generate_other_anthropic_errors_return_502(client, mock_llm, tmp_profile_path, exc):
    mock_llm(side_effect=_raiser(exc))

    resp = client.post("/generate", json=JD)

    assert resp.status_code == 502
    assert "Anthropic API" in resp.json()["detail"]
