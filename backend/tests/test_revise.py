import json

from app.services import usage_guard
from app.services.llm import MAX_INPUT_CHARS


def test_revise_requires_resume_or_cover_letter(client):
    resp = client.post("/revise", json={"selected_ids": ["b_1"], "instruction": "punchier"})

    assert resp.status_code == 400
    assert "resume" in resp.json()["detail"] and "cover_letter" in resp.json()["detail"]


def test_revise_resume_success(client, mock_llm, minimal_resume):
    mock_llm(json.dumps({"updates": [{"id": "b_1", "text": "Revised bullet text."}]}))

    resp = client.post(
        "/revise",
        json={"resume": minimal_resume, "selected_ids": ["b_1"], "instruction": "make punchier"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"updates": [{"id": "b_1", "text": "Revised bullet text."}]}


def test_revise_cover_letter_success(client, mock_llm, minimal_cover_letter):
    mock_llm(json.dumps({"updates": [{"id": "p1", "text": "Revised paragraph text."}]}))

    resp = client.post(
        "/revise",
        json={
            "cover_letter": minimal_cover_letter,
            "selected_ids": ["p1"],
            "instruction": "make punchier",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"updates": [{"id": "p1", "text": "Revised paragraph text."}]}


def test_revise_relays_entry_level_expansion_from_model(client, mock_llm, minimal_resume):
    """The backend doesn't do id-expansion itself — that's entirely prompt-driven. This
    just confirms the route relays whatever bullet-level updates the model returns for
    an entry/section-level selection, without trying to interpret or filter them."""
    mock_llm(
        json.dumps(
            {
                "updates": [
                    {"id": "b_1", "text": "Revised bullet one."},
                    {"id": "b_2", "text": "Revised bullet two."},
                ]
            }
        )
    )

    resp = client.post(
        "/revise",
        json={
            "resume": minimal_resume,
            "selected_ids": ["entry_acme"],
            "instruction": "make punchier",
        },
    )

    assert resp.status_code == 200
    ids = {u["id"] for u in resp.json()["updates"]}
    assert ids == {"b_1", "b_2"}


def test_revise_normalizes_bare_object_to_empty_updates(client, mock_llm, minimal_resume):
    mock_llm("{}")

    resp = client.post(
        "/revise",
        json={
            "resume": minimal_resume,
            "selected_ids": ["entry_state_u"],
            "instruction": "n/a, entry has no bullets",
        },
    )

    assert resp.status_code == 200
    assert resp.json() == {"updates": []}


def test_revise_returns_502_on_malformed_model_json(client, mock_llm, minimal_resume):
    mock_llm("Sure, here is some prose instead of JSON as requested.")

    resp = client.post(
        "/revise",
        json={"resume": minimal_resume, "selected_ids": ["b_1"], "instruction": "punchier"},
    )

    assert resp.status_code == 502
    assert "did not return valid JSON" in resp.json()["detail"]


def test_revise_returns_429_when_daily_limit_reached(client, monkeypatch, minimal_resume):
    monkeypatch.setattr(usage_guard, "DAILY_CALL_LIMIT", 0)

    resp = client.post(
        "/revise",
        json={"resume": minimal_resume, "selected_ids": ["b_1"], "instruction": "punchier"},
    )

    assert resp.status_code == 429
    assert "Daily API call limit reached" in resp.json()["detail"]


def test_revise_rejects_oversized_instruction(client, minimal_resume):
    resp = client.post(
        "/revise",
        json={
            "resume": minimal_resume,
            "selected_ids": ["b_1"],
            "instruction": "x" * (MAX_INPUT_CHARS + 1),
        },
    )

    assert resp.status_code == 502
    assert "exceeds the" in resp.json()["detail"]
