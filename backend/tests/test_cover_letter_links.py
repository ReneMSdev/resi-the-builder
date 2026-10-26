import io
import json

from docx import Document

from app.services.cover_letter_links import cover_letter_links


def _profile_with_links(minimal_profile):
    profile = json.loads(json.dumps(minimal_profile))
    profile["meta"]["links"] = [
        {"id": "link_github", "label": "GitHub", "url": "github.com/janedoe"},
        {"id": "link_website", "label": "Website", "url": "janedoe.dev"},
        {"id": "link_linkedin", "label": "LinkedIn", "url": "linkedin.com/in/janedoe"},
    ]
    return profile


def test_only_linkedin_and_website_in_that_order(minimal_profile):
    links = cover_letter_links(_profile_with_links(minimal_profile))

    assert [l["url"] for l in links] == ["linkedin.com/in/janedoe", "janedoe.dev"]


def test_profile_without_those_links_gives_none(minimal_profile):
    assert cover_letter_links(minimal_profile) == []  # fixture only has GitHub


def test_generate_cover_letter_adds_links_from_profile(
    client, mock_llm, tmp_profile_path, minimal_profile, minimal_cover_letter
):
    tmp_profile_path.write_text(json.dumps(_profile_with_links(minimal_profile)))
    # A link the model made up must not survive; links come from the profile only.
    letter = json.loads(json.dumps(minimal_cover_letter))
    letter["meta"]["links"] = [{"id": "x", "label": "LinkedIn", "url": "linkedin.com/in/made-up"}]
    mock_llm(json.dumps({**letter, "cleaned_job_description": "JD."}))

    resp = client.post("/generate", json={"job_description": "A job.", "type": "cover_letter"})

    assert resp.status_code == 200
    urls = [l["url"] for l in resp.json()["cover_letter"]["meta"]["links"]]
    assert urls == ["linkedin.com/in/janedoe", "janedoe.dev"]


def test_cover_letter_docx_contact_line_includes_links(client, minimal_cover_letter):
    letter = json.loads(json.dumps(minimal_cover_letter))
    letter["meta"]["links"] = [
        {"id": "link_linkedin", "label": "LinkedIn", "url": "linkedin.com/in/janedoe"},
        {"id": "link_website", "label": "Website", "url": "janedoe.dev"},
    ]

    resp = client.post("/render", json={"cover_letter": letter, "format": "docx"})

    assert resp.status_code == 200
    text = "\n".join(p.text for p in Document(io.BytesIO(resp.content)).paragraphs)
    assert "jane@example.com | 555-0100 | linkedin.com/in/janedoe | janedoe.dev" in text


def test_older_letter_without_links_still_renders(client, minimal_cover_letter):
    resp = client.post("/render", json={"cover_letter": minimal_cover_letter, "format": "docx"})

    assert resp.status_code == 200
