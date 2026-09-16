import io
import os

import pytest
from docx import Document

from app.services.render import SOFFICE_PATH


def _extract_text(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs)


def test_render_resume_docx(client, minimal_resume):
    resp = client.post("/render", json={"resume": minimal_resume, "format": "docx"})

    assert resp.status_code == 200
    assert resp.headers["content-type"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert "Jane_Doe_Resume.docx" in resp.headers["content-disposition"]

    text = _extract_text(resp.content)
    assert "Jane Doe" in text
    assert "jane@example.com" in text
    assert "EXPERIENCE" in text
    assert "Engineer — Acme Corp" in text
    assert "Built things." in text
    assert "Shipped stuff." in text
    assert "EDUCATION" in text
    assert "B.S. Computer Science — State University — 2016 - 2020" in text
    assert "SKILLS" in text
    assert "Python, FastAPI" in text


def test_render_cover_letter_docx(client, minimal_cover_letter):
    resp = client.post("/render", json={"cover_letter": minimal_cover_letter, "format": "docx"})

    assert resp.status_code == 200
    assert "Jane_Doe_CoverLetter.docx" in resp.headers["content-disposition"]

    text = _extract_text(resp.content)
    assert "Re: Senior Engineer at Acme Corp" in text
    assert "Dear Hiring Manager," in text
    assert "I am excited to apply for this role." in text
    assert "My experience aligns well with your needs." in text
    assert "Sincerely," in text
    assert "Jane Doe" in text


def test_render_rejects_unsupported_format(client, minimal_resume):
    resp = client.post("/render", json={"resume": minimal_resume, "format": "txt"})

    assert resp.status_code == 400
    assert "Unsupported format" in resp.json()["detail"]


def test_render_requires_resume_or_cover_letter(client):
    resp = client.post("/render", json={"format": "docx"})

    assert resp.status_code == 400
    assert "resume" in resp.json()["detail"] and "cover_letter" in resp.json()["detail"]


@pytest.mark.slow
@pytest.mark.skipif(
    not os.path.exists(SOFFICE_PATH),
    reason="LibreOffice not installed at the expected path",
)
def test_render_resume_pdf(client, minimal_resume):
    resp = client.post("/render", json={"resume": minimal_resume, "format": "pdf"})

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert "Jane_Doe_Resume.pdf" in resp.headers["content-disposition"]
    assert resp.content[:4] == b"%PDF"
