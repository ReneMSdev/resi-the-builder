import pytest

from app.services.llm import _extract_json


def test_extract_json_plain():
    assert _extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_fenced_at_start():
    text = '```json\n{"a": 1}\n```'
    assert _extract_json(text) == {"a": 1}


def test_extract_json_fenced_without_language_tag():
    text = '```\n{"a": 1}\n```'
    assert _extract_json(text) == {"a": 1}


def test_extract_json_preamble_prose_before_fence():
    """The regression case: the model reasons in prose, then puts the actual answer
    in a fenced block instead of leading with it despite being told not to."""
    text = (
        "Looking at this against the job description, I'll remove the irrelevant "
        'groups.\n\n```json\n{"updates": [{"id": "skill_backend", "text": "Python"}]}\n```'
    )
    assert _extract_json(text) == {"updates": [{"id": "skill_backend", "text": "Python"}]}


def test_extract_json_bare_object_wrapped_in_prose_no_fence():
    text = 'Sure, here is the JSON: {"a": 1} — let me know if you need anything else.'
    assert _extract_json(text) == {"a": 1}


def test_extract_json_raises_on_genuinely_non_json_text():
    with pytest.raises(ValueError, match="did not return valid JSON"):
        _extract_json("I'm sorry, I don't have enough information to do that.")
