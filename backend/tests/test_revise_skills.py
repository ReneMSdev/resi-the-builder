"""Skills restructuring through /revise ("skills_replace"), covering the cases from the
skills bug report: groups were shifted positionally because revise couldn't add or rename
groups."""
import copy
import json
from types import SimpleNamespace

import pytest


def _respond(payload):
    def _create(*args, **kwargs):
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=json.dumps(payload))])

    return _create


@pytest.fixture
def two_group_resume(minimal_resume):
    resume = copy.deepcopy(minimal_resume)
    skills = next(s for s in resume["sections"] if s["type"] == "skills")
    skills["groups"].append({
        "id": "skill_frontend", "label": "Frontend",
        "items": [{"id": "item_frontend_react", "text": "React"}],
    })
    return resume


def _replace(groups, section="sec_skills"):
    return {"updates": [], "removals": [], "additions": [],
            "skills_replace": {"section": section, "groups": groups}}


def _revise(client, resume, selected_ids):
    return client.post("/revise", json={
        "resume": resume, "selected_ids": selected_ids, "instruction": "restructure skills",
    })


NINE = [{"label": f"Group {n}", "items": [f"Skill {n}a", f"Skill {n}b"]} for n in range(1, 10)]


def test_replace_with_more_groups_than_exist(client, mock_llm, two_group_resume):
    mock_llm(side_effect=_respond(_replace(NINE)))

    resp = _revise(client, two_group_resume, ["sec_skills"])

    assert resp.status_code == 200
    assert resp.json()["skills_replace"] == {"section": "sec_skills", "groups": NINE}


def test_replace_with_fewer_groups_and_renamed_label(client, mock_llm, two_group_resume):
    groups = [{"label": "Languages & Frameworks", "items": ["Python", "FastAPI", "React"]}]
    mock_llm(side_effect=_respond(_replace(groups)))

    resp = _revise(client, two_group_resume, ["sec_skills"])

    assert resp.json()["skills_replace"]["groups"] == groups


def test_replace_reorders_and_cleans_items(client, mock_llm, two_group_resume):
    mock_llm(side_effect=_respond(_replace([
        {"label": " Frontend ", "items": ["React", "  ", " Next.js "]},
        {"label": "Backend", "items": ["Python", "FastAPI"]},
    ])))

    resp = _revise(client, two_group_resume, [])

    assert resp.json()["skills_replace"]["groups"] == [
        {"label": "Frontend", "items": ["React", "Next.js"]},
        {"label": "Backend", "items": ["Python", "FastAPI"]},
    ]


def test_replace_drops_conflicting_group_updates(client, mock_llm, two_group_resume):
    payload = _replace([{"label": "All", "items": ["Python", "React"]}])
    payload["updates"] = [{"id": "skill_backend", "text": "Shifted, Content"},
                          {"id": "summary", "text": "Kept."}]
    payload["removals"] = ["skill_frontend"]
    mock_llm(side_effect=_respond(payload))

    resp = _revise(client, two_group_resume, [])

    body = resp.json()
    assert body["skills_replace"]["groups"] == [{"label": "All", "items": ["Python", "React"]}]
    assert body["updates"] == [{"id": "summary", "text": "Kept."}]
    assert body["removals"] == []


@pytest.mark.parametrize("groups", [
    [],                                                    # no groups
    [{"label": "", "items": ["Python"]}],                  # empty label
    [{"label": "Backend", "items": "Python, FastAPI"}],    # items not a list
    [{"label": "Backend", "items": []}],                   # empty items
    [{"label": f"G{n}", "items": ["x"]} for n in range(16)],  # too many groups
])
def test_malformed_replace_is_rejected_and_section_untouched(
    client, mock_llm, two_group_resume, groups
):
    payload = _replace(groups)
    payload["updates"] = [{"id": "skill_backend", "text": "Positional, Shift"}]
    mock_llm(side_effect=_respond(payload))

    resp = _revise(client, two_group_resume, ["sec_skills"])

    body = resp.json()
    assert body["skills_replace"] is None
    assert body["updates"] == []  # no half-applied or positional edit either


def test_replace_out_of_scope_is_rejected(client, mock_llm, two_group_resume):
    mock_llm(side_effect=_respond(_replace(NINE)))

    resp = _revise(client, two_group_resume, ["sec_experience"])

    assert resp.json()["skills_replace"] is None


def test_wrong_section_id_resolves_to_the_only_skills_section(client, mock_llm, two_group_resume):
    payload = _replace(NINE, section="sec_experience")
    payload["updates"] = [{"id": "skill_backend", "text": "Positional, Shift"}]
    mock_llm(side_effect=_respond(payload))

    resp = _revise(client, two_group_resume, [])

    body = resp.json()
    assert body["skills_replace"] == {"section": "sec_skills", "groups": NINE}
    assert body["updates"] == []


def test_unresolvable_section_drops_positional_group_updates(client, mock_llm, two_group_resume):
    """With two skills sections and a bad id, the replace can't be placed: it's rejected,
    and per-group edits in every skills section are dropped too."""
    resume = copy.deepcopy(two_group_resume)
    resume["sections"].append({"id": "sec_skills_2", "title": "More skills", "type": "skills",
                               "entries": [], "groups": [{"id": "skill_other", "label": "Other",
                                                          "items": [{"id": "i_o", "text": "Go"}]}]})
    payload = _replace(NINE, section="nope")
    payload["updates"] = [{"id": "skill_backend", "text": "Positional, Shift"},
                          {"id": "skill_other", "text": "Also, Shifted"},
                          {"id": "summary", "text": "Kept."}]
    mock_llm(side_effect=_respond(payload))

    resp = _revise(client, resume, [])

    body = resp.json()
    assert body["skills_replace"] is None
    assert body["updates"] == [{"id": "summary", "text": "Kept."}]


def test_single_group_rename_keeps_other_groups(client, mock_llm, two_group_resume):
    mock_llm(side_effect=_respond(_replace([
        {"label": "Server-side", "items": ["Python", "FastAPI"]},
        {"label": "Frontend", "items": ["React"]},
    ])))

    resp = _revise(client, two_group_resume, ["skill_backend"])

    assert resp.json()["skills_replace"]["groups"][0]["label"] == "Server-side"


def test_single_group_selected_cannot_change_other_groups(client, mock_llm, two_group_resume):
    mock_llm(side_effect=_respond(_replace([
        {"label": "Server-side", "items": ["Python", "FastAPI"]},
        {"label": "Frontend", "items": ["React", "Vue"]},  # unselected group changed
    ])))

    resp = _revise(client, two_group_resume, ["skill_backend"])

    assert resp.json()["skills_replace"] is None


def test_profile_never_returns_skills_replace(client, mock_llm, minimal_profile):
    mock_llm(side_effect=_respond(_replace(NINE)))

    resp = client.post("/revise", json={
        "profile": minimal_profile, "selected_ids": ["sec_skills"], "instruction": "x",
    })

    assert resp.json()["skills_replace"] is None
