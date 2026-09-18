import json
from types import SimpleNamespace

from app.services import usage_guard
from app.services.llm import MAX_INPUT_CHARS


def test_revise_profile_success(client, mock_llm, minimal_profile):
    mock_llm(json.dumps({"updates": [{"id": "summary_backend_1", "text": "Revised summary."}]}))

    resp = client.post(
        "/revise",
        json={
            "profile": minimal_profile,
            "selected_ids": ["summary_backend_1"],
            "instruction": "make punchier",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"updates": [{"id": "summary_backend_1", "text": "Revised summary."}]}


def test_revise_profile_relays_role_type_group_expansion_from_model(
    client, mock_llm, minimal_profile
):
    """As with resume entry/section expansion, the backend doesn't expand role-type
    group ids itself — that's prompt-driven. This just confirms the route relays
    whatever per-summary-item updates the model returns for a group-level selection."""
    mock_llm(
        json.dumps(
            {
                "updates": [
                    {"id": "summary_backend_1", "text": "Revised variant one."},
                ]
            }
        )
    )

    resp = client.post(
        "/revise",
        json={
            "profile": minimal_profile,
            "selected_ids": ["role_backend"],
            "instruction": "make punchier",
        },
    )

    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()["updates"]}
    assert ids == {"summary_backend_1"}


def test_revise_profile_never_forwards_job_description_even_if_sent(
    client, mock_llm, minimal_profile
):
    """Defensive check: even if a caller sends job_description alongside profile
    (which the frontend won't do, but shouldn't be trusted blindly), it must never
    reach the profile-revise prompt — profile editing isn't job-tailoring."""
    captured = {}

    def _capture(*args, **kwargs):
        captured["user_content"] = kwargs["messages"][0]["content"]
        captured["system"] = kwargs["system"]
        block = SimpleNamespace(
            type="text", text=json.dumps({"updates": [{"id": "summary_backend_1", "text": "x"}]})
        )
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture)

    resp = client.post(
        "/revise",
        json={
            "profile": minimal_profile,
            "selected_ids": ["summary_backend_1"],
            "instruction": "make punchier",
            "job_description": "This should never reach the model for a profile revise.",
        },
    )

    assert resp.status_code == 200
    assert "This should never reach the model" not in captured["user_content"]
    assert "JOB DESCRIPTION" not in captured["user_content"]
    assert "tailoring content to a specific job" in captured["system"]


def test_revise_profile_returns_502_on_malformed_model_json(client, mock_llm, minimal_profile):
    mock_llm("Sure, here is some prose instead of JSON as requested.")

    resp = client.post(
        "/revise",
        json={"profile": minimal_profile, "selected_ids": ["summary_backend_1"], "instruction": "x"},
    )

    assert resp.status_code == 502
    assert "did not return valid JSON" in resp.json()["detail"]


def test_revise_profile_returns_429_when_daily_limit_reached(client, monkeypatch, minimal_profile):
    monkeypatch.setattr(usage_guard, "DAILY_CALL_LIMIT", 0)

    resp = client.post(
        "/revise",
        json={"profile": minimal_profile, "selected_ids": ["summary_backend_1"], "instruction": "x"},
    )

    assert resp.status_code == 429
    assert "Daily API call limit reached" in resp.json()["detail"]


def test_revise_profile_rejects_oversized_instruction(client, minimal_profile):
    resp = client.post(
        "/revise",
        json={
            "profile": minimal_profile,
            "selected_ids": ["summary_backend_1"],
            "instruction": "x" * (MAX_INPUT_CHARS + 1),
        },
    )

    assert resp.status_code == 502
    assert "exceeds the" in resp.json()["detail"]
