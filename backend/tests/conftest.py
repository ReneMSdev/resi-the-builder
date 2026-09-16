import datetime
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import llm as llm_module
from app.services import usage_guard


@pytest.fixture(autouse=True)
def reset_usage_guard(monkeypatch):
    """Every test starts with a clean daily-call counter, regardless of test order."""
    monkeypatch.setattr(usage_guard, "_call_count", 0)
    monkeypatch.setattr(usage_guard, "_count_date", datetime.date.today())


@pytest.fixture(autouse=True)
def block_real_llm_calls(request, monkeypatch):
    """Safety net: any test not marked `live` and not using `mock_llm` gets a hard
    failure instead of a real network call if it somehow reaches the Anthropic client.
    Tests that need a canned response should request the `mock_llm` fixture, which
    overrides this with a fake response instead."""
    if "live" in request.keywords:
        return

    def _guard(*args, **kwargs):
        raise AssertionError(
            "Real Anthropic API call attempted from a non-live test. "
            "Use the `mock_llm` fixture, or mark the test @pytest.mark.live."
        )

    monkeypatch.setattr(llm_module.client.messages, "create", _guard)


@pytest.fixture
def mock_llm(monkeypatch):
    """Patches the Anthropic client to return a canned text response instead of making
    a real API call. Usage: mock_llm("<json response text>") before hitting the route,
    or mock_llm(side_effect=some_callable) for per-call dynamic behavior."""
    state = {"text": "{}", "side_effect": None}

    def fake_create(*args, **kwargs):
        if state["side_effect"] is not None:
            return state["side_effect"](*args, **kwargs)
        block = SimpleNamespace(type="text", text=state["text"])
        return SimpleNamespace(content=[block])

    monkeypatch.setattr(llm_module.client.messages, "create", fake_create)

    def _set(text=None, side_effect=None):
        if side_effect is not None:
            state["side_effect"] = side_effect
        else:
            state["text"] = text
            state["side_effect"] = None

    return _set


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def minimal_profile():
    return {
        "meta": {
            "name": {"id": "meta_name", "text": "Jane Doe"},
            "email": {"id": "meta_email", "text": "jane@example.com"},
            "phone": {"id": "meta_phone", "text": "555-0100"},
            "links": [{"id": "link_github", "label": "GitHub", "url": "github.com/janedoe"}],
        },
        "summary_pool": ["A software engineer."],
        "sections": [
            {
                "id": "sec_experience",
                "title": "Experience",
                "type": "experience",
                "entries": [
                    {
                        "id": "entry_acme",
                        "title": {"id": "entry_acme_title", "text": "Engineer"},
                        "organization": {"id": "entry_acme_org", "text": "Acme Corp"},
                        "location": {"id": "entry_acme_location", "text": "Remote"},
                        "dates": {"id": "entry_acme_dates", "text": "2020 - Present"},
                        "bullets": [
                            {"id": "b_1", "text": "Built things.", "tags": ["python"]},
                        ],
                    }
                ],
                "groups": [],
            }
        ],
    }


@pytest.fixture
def minimal_resume():
    return {
        "type": "resume",
        "meta": {
            "name": {"id": "meta_name", "text": "Jane Doe"},
            "email": {"id": "meta_email", "text": "jane@example.com"},
            "phone": {"id": "meta_phone", "text": "555-0100"},
            "links": [{"id": "link_github", "label": "GitHub", "url": "github.com/janedoe"}],
        },
        "summary": {"id": "summary", "text": "A software engineer."},
        "sections": [
            {
                "id": "sec_experience",
                "title": "Experience",
                "type": "experience",
                "entries": [
                    {
                        "id": "entry_acme",
                        "title": {"id": "entry_acme_title", "text": "Engineer"},
                        "organization": {"id": "entry_acme_org", "text": "Acme Corp"},
                        "location": {"id": "entry_acme_location", "text": "Remote"},
                        "dates": {"id": "entry_acme_dates", "text": "2020 - Present"},
                        "bullets": [
                            {"id": "b_1", "text": "Built things.", "tags": ["python"]},
                            {"id": "b_2", "text": "Shipped stuff.", "tags": ["backend"]},
                        ],
                    }
                ],
                "groups": [],
            },
            {
                "id": "sec_education",
                "title": "Education",
                "type": "education",
                "entries": [
                    {
                        "id": "entry_state_u",
                        "title": {"id": "entry_state_u_title", "text": "B.S. Computer Science"},
                        "organization": {"id": "entry_state_u_org", "text": "State University"},
                        "location": {"id": "entry_state_u_location", "text": "Springfield"},
                        "dates": {"id": "entry_state_u_dates", "text": "2016 - 2020"},
                        "bullets": [],
                    }
                ],
                "groups": [],
            },
            {
                "id": "sec_skills",
                "title": "Skills",
                "type": "skills",
                "entries": [],
                "groups": [
                    {
                        "id": "skill_backend",
                        "label": "Backend",
                        "items": [
                            {"id": "item_backend_python", "text": "Python"},
                            {"id": "item_backend_fastapi", "text": "FastAPI"},
                        ],
                    }
                ],
            },
        ],
    }


@pytest.fixture
def minimal_cover_letter():
    return {
        "type": "cover_letter",
        "meta": {
            "name": {"id": "cl_meta_name", "text": "Jane Doe"},
            "email": {"id": "cl_meta_email", "text": "jane@example.com"},
            "phone": {"id": "cl_meta_phone", "text": "555-0100"},
            "date": {"id": "cl_meta_date", "text": ""},
            "company": {"id": "cl_meta_company", "text": "Acme Corp"},
            "role": {"id": "cl_meta_role", "text": "Senior Engineer"},
        },
        "salutation": {"id": "cl_salutation", "text": "Dear Hiring Manager,"},
        "sign_off": {"id": "cl_sign_off", "text": "Sincerely,"},
        "paragraphs": [
            {"id": "p1", "text": "I am excited to apply for this role."},
            {"id": "p2", "text": "My experience aligns well with your needs."},
        ],
    }


@pytest.fixture
def tmp_saved_items(tmp_path, monkeypatch):
    """Points the /resumes routes at a scratch directory instead of the real
    app/data/saved_items, so tests never touch real saved data."""
    from app.routes import resumes as resumes_module

    monkeypatch.setattr(resumes_module, "DATA_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def tmp_profile_path(tmp_path, monkeypatch, minimal_profile):
    """Points both /profile and /generate at a scratch profile.json instead of the
    real app/data/profile.json, so tests never read or overwrite real personal data."""
    from app.routes import profile as profile_module
    from app.routes import generate as generate_module

    path = tmp_path / "profile.json"
    with open(path, "w") as f:
        json.dump(minimal_profile, f)

    monkeypatch.setattr(profile_module, "DATA_PATH", path)
    monkeypatch.setattr(generate_module, "DATA_PATH", path)
    return path
