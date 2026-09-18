import json
from types import SimpleNamespace

from app.services import usage_guard
from app.services.llm import MAX_INPUT_CHARS


def test_generate_resume_success(client, mock_llm, tmp_profile_path, minimal_resume):
    payload = {**minimal_resume, "cleaned_job_description": "Cleaned posting text."}
    mock_llm(json.dumps(payload))

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 200
    body = resp.json()
    assert body["cover_letter"] is None
    assert body["resume"]["meta"]["name"]["text"] == "Jane Doe"
    assert body["resume"]["sections"][0]["entries"][0]["bullets"][0]["text"] == "Built things."
    assert body["cleaned_job_description"] == "Cleaned posting text."
    assert "cleaned_job_description" not in body["resume"]


def test_generate_cover_letter_success(client, mock_llm, tmp_profile_path, minimal_cover_letter):
    payload = {**minimal_cover_letter, "cleaned_job_description": "Cleaned posting text."}
    mock_llm(json.dumps(payload))

    resp = client.post(
        "/generate",
        json={"job_description": "A generic job description.", "type": "cover_letter"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["resume"] is None
    assert body["cover_letter"]["meta"]["company"]["text"] == "Acme Corp"
    assert len(body["cover_letter"]["paragraphs"]) == 2
    assert body["cleaned_job_description"] == "Cleaned posting text."
    assert "cleaned_job_description" not in body["cover_letter"]


def test_generate_resume_defaults_cleaned_job_description_to_none_if_missing(
    client, mock_llm, tmp_profile_path, minimal_resume
):
    """If the model omits the field (e.g. an older/degraded response), the route
    shouldn't crash — it should just come back null."""
    mock_llm(json.dumps(minimal_resume))

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 200
    assert resp.json()["cleaned_job_description"] is None


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


def test_generate_rejects_oversized_additional_context(client, tmp_profile_path):
    resp = client.post(
        "/generate",
        json={
            "job_description": "A generic job description.",
            "additional_context": "x" * (MAX_INPUT_CHARS + 1),
        },
    )

    assert resp.status_code == 502
    assert "exceeds the" in resp.json()["detail"]


def test_generate_forwards_additional_context_to_the_model(
    client, mock_llm, tmp_profile_path, minimal_resume
):
    """Contract check for the company_context -> additional_context rename: the field
    is accepted under its new name and actually forwarded in the prompt sent to the
    model, not silently dropped."""
    captured = {}

    def _capture(*args, **kwargs):
        captured["user_content"] = "".join(b["text"] for b in kwargs["messages"][0]["content"])
        block = SimpleNamespace(type="text", text=json.dumps(minimal_resume))
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture)

    resp = client.post(
        "/generate",
        json={
            "job_description": "A generic job description.",
            "additional_context": "I know someone on the engineering team there.",
        },
    )

    assert resp.status_code == 200
    assert "ADDITIONAL CONTEXT:" in captured["user_content"]
    assert "I know someone on the engineering team there." in captured["user_content"]


def _assert_prompt_caching_structure(captured, expected_tail_marker):
    # System prompt is a single block with an ephemeral cache breakpoint — shared
    # across resume AND cover-letter generation (the whole point of splitting it out
    # of the type-specific tail), and identical across every call, forever.
    from app.services.llm import GENERATE_SHARED_PREAMBLE

    assert len(captured["system"]) == 1
    assert captured["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert captured["system"][0]["text"] == GENERATE_SHARED_PREAMBLE

    # User content is split into 3 blocks: profile (cached, shared across types),
    # type-specific tail (cached, but diverges resume vs cover_letter), then an
    # unmarked job-description/additional-context block. Breakpoints must be on the
    # LAST two stable blocks in order — putting one after the varying suffix would
    # write a new cache entry every call and never read one back.
    content = captured["content"]
    assert len(content) == 3
    assert content[0]["cache_control"] == {"type": "ephemeral"}
    assert "PROFILE DATA:" in content[0]["text"]
    assert content[1]["cache_control"] == {"type": "ephemeral"}
    assert expected_tail_marker in content[1]["text"]
    assert "cache_control" not in content[2]
    assert "JOB DESCRIPTION:" in content[2]["text"]


def test_generate_resume_uses_prompt_caching_breakpoints(client, mock_llm, tmp_profile_path, minimal_resume):
    captured = {}

    def _capture(*args, **kwargs):
        captured["system"] = kwargs["system"]
        captured["content"] = kwargs["messages"][0]["content"]
        block = SimpleNamespace(type="text", text=json.dumps(minimal_resume))
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture)

    resp = client.post("/generate", json={"job_description": "A generic job description."})

    assert resp.status_code == 200
    _assert_prompt_caching_structure(captured, expected_tail_marker="resume-tailoring assistant")


def test_generate_cover_letter_uses_prompt_caching_breakpoints(
    client, mock_llm, tmp_profile_path, minimal_cover_letter
):
    captured = {}

    def _capture(*args, **kwargs):
        captured["system"] = kwargs["system"]
        captured["content"] = kwargs["messages"][0]["content"]
        block = SimpleNamespace(type="text", text=json.dumps(minimal_cover_letter))
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture)

    resp = client.post(
        "/generate",
        json={"job_description": "A generic job description.", "type": "cover_letter"},
    )

    assert resp.status_code == 200
    _assert_prompt_caching_structure(captured, expected_tail_marker="cover-letter-writing assistant")


def test_generate_resume_and_cover_letter_share_the_same_system_and_profile_blocks(
    client, mock_llm, tmp_profile_path, minimal_resume, minimal_cover_letter
):
    """This is the actual cross-type cache-sharing property the prompt unification
    was for: resume and cover-letter calls must produce byte-identical system and
    profile blocks (only the tail block may differ), or they won't share a cache
    entry no matter how the code is otherwise structured."""
    captured = {}

    def _capture(*args, **kwargs):
        captured.setdefault("calls", []).append(
            {"system": kwargs["system"], "content": kwargs["messages"][0]["content"]}
        )
        block = SimpleNamespace(type="text", text=json.dumps(minimal_resume))
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture)
    client.post("/generate", json={"job_description": "A generic job description."})

    def _capture2(*args, **kwargs):
        captured["calls"].append(
            {"system": kwargs["system"], "content": kwargs["messages"][0]["content"]}
        )
        block = SimpleNamespace(type="text", text=json.dumps(minimal_cover_letter))
        return SimpleNamespace(content=[block])

    mock_llm(side_effect=_capture2)
    client.post(
        "/generate",
        json={"job_description": "A generic job description.", "type": "cover_letter"},
    )

    resume_call, cl_call = captured["calls"]
    assert resume_call["system"] == cl_call["system"]
    assert resume_call["content"][0] == cl_call["content"][0]  # profile block
    assert resume_call["content"][1] != cl_call["content"][1]  # tail block diverges


def test_generate_profile_block_is_byte_identical_across_calls():
    """The cache is a strict byte-for-byte prefix match — if this weren't
    deterministic, caching would silently never hit despite the code being correct."""
    from app.services.llm import _generate_content_blocks, GENERATE_RESUME_TAIL

    profile = json.loads(json.dumps({"meta": {"name": "Jane"}, "sections": [1, 2, 3]}))

    first = _generate_content_blocks(profile, GENERATE_RESUME_TAIL, "JD one", None)
    second = _generate_content_blocks(profile, GENERATE_RESUME_TAIL, "JD two", "different context")

    assert first[0]["text"] == second[0]["text"]
