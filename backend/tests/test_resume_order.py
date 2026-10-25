import json

from app.services.resume_order import sort_dated_sections


def _entry(entry_id, dates):
    return {
        "id": entry_id,
        "title": {"id": f"{entry_id}_title", "text": entry_id},
        "organization": {"id": f"{entry_id}_org", "text": "Org"},
        "location": {"id": f"{entry_id}_location", "text": ""},
        "dates": {"id": f"{entry_id}_dates", "text": dates},
        "bullets": [],
    }


def _ids(resume, section_type):
    section = next(s for s in resume["sections"] if s["type"] == section_type)
    return [e["id"] for e in section["entries"]]


def test_certifications_newest_first_with_in_progress_on_top():
    resume = {"sections": [{"id": "sec_certifications", "type": "certifications", "entries": [
        _entry("psm", "2023"), _entry("itil", "2024"), _entry("aws_sa", "In Progress"),
        _entry("undated", ""), _entry("aws_ccp", "2025"), _entry("linux", "2024"),
    ]}]}

    sort_dated_sections(resume)

    # Same-year entries (itil, linux) keep their original relative order.
    assert _ids(resume, "certifications") == ["aws_sa", "aws_ccp", "itil", "linux", "psm", "undated"]


def test_education_sorted_by_end_date_and_ongoing_first():
    resume = {"sections": [{"id": "sec_education", "type": "education", "entries": [
        _entry("bs", "2016 - 2020"), _entry("ms", "2022 - Present"), _entry("cert", "May 2021"),
    ]}]}

    sort_dated_sections(resume)

    assert _ids(resume, "education") == ["ms", "cert", "bs"]


def test_other_sections_are_left_alone():
    resume = {"sections": [{"id": "sec_experience", "type": "experience", "entries": [
        _entry("old", "2018 - 2021"), _entry("new", "2024 - Present"),
    ]}]}

    sort_dated_sections(resume)

    assert _ids(resume, "experience") == ["old", "new"]


def test_generate_returns_certifications_newest_first(
    client, mock_llm, tmp_profile_path, minimal_resume
):
    resume = json.loads(json.dumps(minimal_resume))
    resume["sections"].append({
        "id": "sec_certifications", "title": "Certifications", "type": "certifications",
        "entries": [_entry("cert_old", "2022"), _entry("cert_wip", "In Progress"),
                    _entry("cert_new", "2025")],
        "groups": [],
    })
    mock_llm(json.dumps({**resume, "cleaned_job_description": "JD."}))

    resp = client.post("/generate", json={"job_description": "A job."})

    assert resp.status_code == 200
    assert _ids(resp.json()["resume"], "certifications") == ["cert_wip", "cert_new", "cert_old"]
