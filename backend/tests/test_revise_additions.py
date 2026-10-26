import json
from types import SimpleNamespace

from app.services.revise_scope import resume_addition_anchors


def _respond(payload):
    def _create(*args, **kwargs):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    return _create


def _revise(client, doc_key, doc, selected_ids, instruction="split this"):
    return client.post(
        "/revise", json={doc_key: doc, "selected_ids": selected_ids, "instruction": instruction}
    )


def test_addition_anchors_skip_education_and_skills(minimal_resume):
    anchors = resume_addition_anchors(minimal_resume, [])

    assert {"entry_acme", "b_1", "b_2"} <= anchors
    assert not {"entry_state_u", "sec_education", "skill_backend", "sec_skills", "summary"} & anchors


def test_addition_anchors_limited_to_selection(minimal_resume):
    assert resume_addition_anchors(minimal_resume, ["b_1"]) == {"b_1"}
    assert resume_addition_anchors(minimal_resume, ["entry_acme"]) == {"entry_acme", "b_1", "b_2"}


def test_split_bullet_keeps_update_and_in_scope_addition(client, mock_llm, minimal_resume):
    mock_llm(side_effect=_respond({
        "updates": [{"id": "b_1", "text": "First part."}],
        "removals": [],
        "additions": [{"after": "b_1", "text": "  Second part.  "},
                      {"after": "b_2", "text": "Out of scope."},
                      {"after": "entry_state_u", "text": "Education can't take bullets."},
                      {"after": "b_1", "text": "   "}],
    }))

    resp = _revise(client, "resume", minimal_resume, ["b_1"])

    assert resp.status_code == 200
    body = resp.json()
    assert body["updates"] == [{"id": "b_1", "text": "First part."}]
    assert body["additions"] == [{"after": "b_1", "text": "Second part."}]


def test_updates_for_invented_ids_are_dropped(client, mock_llm, minimal_resume):
    """The failure that prompted the guard: shifting text into IDs to make room for a split,
    including inventing an ID for the overflow."""
    mock_llm(side_effect=_respond({
        "updates": [{"id": "b_1", "text": "First part."}, {"id": "b_3_invented", "text": "Overflow."}],
        "removals": [], "additions": [],
    }))

    resp = _revise(client, "resume", minimal_resume, ["entry_acme"])

    assert resp.status_code == 200
    assert resp.json()["updates"] == [{"id": "b_1", "text": "First part."}]


def test_addition_anchored_to_removed_item_is_dropped(client, mock_llm, minimal_resume):
    mock_llm(side_effect=_respond({
        "updates": [], "removals": ["b_2"], "additions": [{"after": "b_2", "text": "Orphan."}],
    }))

    resp = _revise(client, "resume", minimal_resume, ["entry_acme"])

    assert resp.json()["removals"] == ["b_2"]
    assert resp.json()["additions"] == []


def test_cover_letter_paragraph_addition(client, mock_llm, minimal_cover_letter):
    mock_llm(side_effect=_respond({
        "updates": [{"id": "p1", "text": "Short opener."}],
        "removals": [],
        "additions": [{"after": "p1", "text": "New second paragraph."},
                      {"after": "cl_salutation", "text": "Not a paragraph anchor."}],
    }))

    resp = _revise(client, "cover_letter", minimal_cover_letter, ["p1"])

    assert resp.status_code == 200
    assert resp.json()["additions"] == [{"after": "p1", "text": "New second paragraph."}]


def test_profile_revise_never_returns_additions(client, mock_llm, minimal_profile):
    mock_llm(side_effect=_respond({"updates": [], "removals": [], "additions": [{"after": "x", "text": "y"}]}))

    resp = _revise(client, "profile", minimal_profile, ["sec_experience"])

    assert resp.json()["additions"] == []


def test_missing_additions_key_defaults_to_empty(client, mock_llm, minimal_resume):
    mock_llm(json.dumps({"updates": [{"id": "b_1", "text": "Reworded."}]}))

    resp = _revise(client, "resume", minimal_resume, ["b_1"], "reword")

    assert resp.json()["additions"] == []


def test_shifting_text_into_other_existing_bullets_is_dropped(client, mock_llm, minimal_resume):
    """Only b_1 is selected; writing its second half into the existing b_2 (to make room for
    a split) must not overwrite b_2. The split arrives as an addition instead."""
    mock_llm(side_effect=_respond({
        "updates": [{"id": "b_1", "text": "First part."}, {"id": "b_2", "text": "Second part."}],
        "removals": [],
        "additions": [{"after": "b_1", "text": "Second part."}],
    }))

    resp = _revise(client, "resume", minimal_resume, ["b_1"])

    body = resp.json()
    assert body["updates"] == [{"id": "b_1", "text": "First part."}]
    assert body["additions"] == [{"after": "b_1", "text": "Second part."}]


def test_selected_entry_allows_updates_to_its_bullets(client, mock_llm, minimal_resume):
    mock_llm(side_effect=_respond({
        "updates": [{"id": "b_1", "text": "One."}, {"id": "b_2", "text": "Two."},
                    {"id": "entry_acme_title", "text": "Not selected."}],
        "removals": [], "additions": [],
    }))

    resp = _revise(client, "resume", minimal_resume, ["entry_acme"])

    assert [u["id"] for u in resp.json()["updates"]] == ["b_1", "b_2"]


def test_addition_inside_removed_entry_is_dropped(client, mock_llm, minimal_resume):
    mock_llm(side_effect=_respond({
        "updates": [], "removals": ["entry_acme"], "additions": [{"after": "b_1", "text": "Gone."}],
    }))

    resp = _revise(client, "resume", minimal_resume, [])

    assert resp.json()["removals"] == ["entry_acme"]
    assert resp.json()["additions"] == []
