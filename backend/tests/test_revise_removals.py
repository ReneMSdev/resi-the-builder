import json
from types import SimpleNamespace

from app.services.revise_scope import cover_letter_removable_ids, resume_removable_ids


def _respond(payload, calls=None):
    """mock_llm side effect returning `payload` as the model's JSON text, recording kwargs."""

    def _create(*args, **kwargs):
        if calls is not None:
            calls.append(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    return _create


def _revise(client, doc_key, doc, selected_ids, instruction="remove this"):
    return client.post(
        "/revise", json={doc_key: doc, "selected_ids": selected_ids, "instruction": instruction}
    )


def test_resume_removable_ids_whole_document(minimal_resume):
    allowed = resume_removable_ids(minimal_resume, [])

    assert {"sec_experience", "entry_acme", "b_1", "b_2", "sec_skills", "skill_backend",
            "item_backend_python", "link_github", "sec_education", "entry_state_u"} <= allowed
    assert not {"summary", "meta_name", "meta_email", "entry_acme_title"} & allowed


def test_resume_removable_ids_limited_to_selection(minimal_resume):
    allowed = resume_removable_ids(minimal_resume, ["sec_experience"])

    assert allowed == {"sec_experience", "entry_acme", "b_1", "b_2"}


def test_cover_letter_removable_ids(minimal_cover_letter):
    assert cover_letter_removable_ids(minimal_cover_letter, []) == {"p1", "p2"}
    assert cover_letter_removable_ids(minimal_cover_letter, ["p1", "cl_salutation"]) == {"p1"}


def test_resume_removals_are_filtered_to_selection(client, mock_llm, minimal_resume):
    mock_llm(side_effect=_respond({
        "updates": [{"id": "b_1", "text": "should be dropped, b_1 is removed"},
                    {"id": "summary", "text": "Kept."}],
        "removals": ["sec_experience", "sec_skills", "summary", "meta_name", "nope", "sec_experience"],
    }))

    resp = _revise(client, "resume", minimal_resume, ["sec_experience"])

    assert resp.status_code == 200
    body = resp.json()
    assert body["removals"] == ["sec_experience"]
    assert body["updates"] == [{"id": "summary", "text": "Kept."}]


def test_resume_whole_document_sends_empty_selection(client, mock_llm, minimal_resume):
    calls = []
    mock_llm(side_effect=_respond(
        {"updates": [{"id": "b_2", "text": "Shipped more stuff."}], "removals": ["sec_education"]},
        calls,
    ))

    resp = _revise(client, "resume", minimal_resume, [], "drop education, tighten bullets")

    assert resp.status_code == 200
    assert resp.json()["removals"] == ["sec_education"]
    assert "SELECTED IDS:\n[]" in calls[0]["messages"][0]["content"]


def test_missing_removals_key_defaults_to_empty(client, mock_llm, minimal_resume):
    mock_llm(json.dumps({"updates": [{"id": "b_1", "text": "Reworded."}]}))

    resp = _revise(client, "resume", minimal_resume, ["b_1"], "reword")

    assert resp.status_code == 200
    assert resp.json()["removals"] == []


def test_cover_letter_removals_only_paragraphs_in_scope(client, mock_llm, minimal_cover_letter):
    mock_llm(side_effect=_respond({"updates": [], "removals": ["p1", "p2", "cl_salutation"]}))

    resp = _revise(client, "cover_letter", minimal_cover_letter, ["p1"])

    assert resp.status_code == 200
    assert resp.json()["removals"] == ["p1"]


def test_profile_revise_never_returns_removals(client, mock_llm, minimal_profile):
    mock_llm(side_effect=_respond({"updates": [], "removals": ["sec_experience"]}))

    resp = _revise(client, "profile", minimal_profile, ["sec_experience"])

    assert resp.status_code == 200
    assert resp.json()["removals"] == []


def test_profile_revise_requires_a_selection(client, minimal_profile):
    resp = _revise(client, "profile", minimal_profile, [], "rewrite everything")

    assert resp.status_code == 400


def test_removals_leave_master_profile_unchanged(
    client, mock_llm, tmp_profile_path, minimal_resume
):
    """Removals only affect the document sent with the request; /revise never writes
    profile.json (or anything else)."""
    before = tmp_profile_path.read_bytes()
    mock_llm(side_effect=_respond({"updates": [], "removals": ["sec_experience"]}))

    resp = _revise(client, "resume", minimal_resume, [])

    assert resp.status_code == 200
    assert resp.json()["removals"] == ["sec_experience"]
    assert tmp_profile_path.read_bytes() == before
    assert client.get("/profile").json()["sections"][0]["id"] == "sec_experience"
