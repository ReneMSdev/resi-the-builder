"""Real-LLM smoke tests — actually call the Anthropic API and spend real tokens.

Excluded from the default `pytest` run (see pytest.ini: `addopts = -m "not live and
not slow"`). Run explicitly with:

    pytest -m live

These check that the live contract still works end-to-end (valid response shape,
no crash) — they are not a substitute for the mocked contract tests, which cover
error paths and edge cases far more cheaply and deterministically.
"""
import json

import pytest

pytestmark = pytest.mark.live


def test_live_generate_resume(client):
    resp = client.post(
        "/generate",
        json={
            "job_description": (
                "We are hiring a Senior Software Engineer to join our platform team. "
                "Requirements: 5+ years building backend services in Python, experience "
                "with cloud infrastructure (AWS/GCP), strong distributed systems "
                "background. You will design scalable APIs and mentor junior engineers."
            )
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["resume"] is not None
    assert body["resume"]["summary"]["text"]
    assert body["resume"]["sections"]


def test_live_generate_cover_letter(client):
    resp = client.post(
        "/generate",
        json={
            "job_description": (
                "We are hiring a Senior Software Engineer to join our platform team. "
                "Requirements: 5+ years building backend services in Python, experience "
                "with cloud infrastructure (AWS/GCP)."
            ),
            "type": "cover_letter",
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["cover_letter"] is not None
    assert len(body["cover_letter"]["paragraphs"]) >= 3


def test_live_revise_bullet(client, minimal_resume):
    resp = client.post(
        "/revise",
        json={
            "resume": minimal_resume,
            "selected_ids": ["b_1"],
            "instruction": "make this punchier and quantify impact if plausible",
        },
    )

    assert resp.status_code == 200
    updates = resp.json()["updates"]
    assert any(u["id"] == "b_1" for u in updates)
