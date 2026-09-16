import json

from app.services import usage_guard
from app.services.llm import MAX_INPUT_CHARS


def test_generate_resume_success(client, mock_llm, tmp_profile_path, minimal_resume):
    mock_llm(json.dumps(minimal_resume))

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 200
    body = resp.json()
    assert body["cover_letter"] is None
    assert body["resume"]["meta"]["name"]["text"] == "Jane Doe"
    assert body["resume"]["sections"][0]["entries"][0]["bullets"][0]["text"] == "Built things."


def test_generate_cover_letter_success(client, mock_llm, tmp_profile_path, minimal_cover_letter):
    mock_llm(json.dumps(minimal_cover_letter))

    resp = client.post(
        "/generate",
        json={"job_description": "A generic job description.", "type": "cover_letter"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["resume"] is None
    assert body["cover_letter"]["meta"]["company"]["text"] == "Acme Corp"
    assert len(body["cover_letter"]["paragraphs"]) == 2


def test_generate_rejects_unknown_type(client, tmp_profile_path):
    resp = client.post(
        "/generate",
        json={"job_description": "A generic job description.", "type": "resignation_letter"},
    )

    assert resp.status_code == 400
    assert "Unknown type" in resp.json()["detail"]


def test_generate_returns_502_on_malformed_model_json(client, mock_llm, tmp_profile_path):
    mock_llm("Sure, here is some prose instead of JSON as requested.")

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 502
    assert "did not return valid JSON" in resp.json()["detail"]


def test_generate_returns_429_when_daily_limit_reached(client, monkeypatch, tmp_profile_path):
    monkeypatch.setattr(usage_guard, "DAILY_CALL_LIMIT", 0)

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 429
    assert "Daily API call limit reached" in resp.json()["detail"]


def test_generate_rejects_oversized_job_description(client, tmp_profile_path):
    resp = client.post(
        "/generate",
        json={"job_description": "x" * (MAX_INPUT_CHARS + 1)},
    )

    assert resp.status_code == 502
    assert "exceeds the" in resp.json()["detail"]


def test_generate_rejects_oversized_company_context(client, tmp_profile_path):
    resp = client.post(
        "/generate",
        json={
            "job_description": "A generic job description.",
            "company_context": "x" * (MAX_INPUT_CHARS + 1),
        },
    )

    assert resp.status_code == 502
    assert "exceeds the" in resp.json()["detail"]
