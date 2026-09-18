from docx import Document


def _extract_text(path) -> str:
    doc = Document(str(path))
    return "\n".join(p.text for p in doc.paragraphs)


def test_create_jd_and_resume_only(client, tmp_applications, minimal_resume):
    resp = client.post(
        "/applications",
        json={
            "job_description": {"raw": "Raw posting text.", "cleaned": "Cleaned posting text."},
            "resume": minimal_resume,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["job_description"] == {"raw": "Raw posting text.", "cleaned": "Cleaned posting text."}
    assert body["resume"]["meta"]["name"]["text"] == "Jane Doe"
    assert body["cover_letter"] is None
    assert body["name"].startswith("Application — ")

    folder = tmp_applications / body["id"]
    assert (folder / "job_description.txt").read_text() == "Raw posting text."
    assert (folder / "job_description_cleaned.txt").read_text() == "Cleaned posting text."
    assert (folder / "resume.json").exists()
    assert not (folder / "cover_letter.json").exists()
    assert not (folder / "cover_letter.docx").exists()


def test_create_with_all_three_uses_cover_letter_for_default_name(
    client, tmp_applications, minimal_resume, minimal_cover_letter
):
    resp = client.post(
        "/applications",
        json={
            "job_description": {"raw": "Raw posting text."},
            "resume": minimal_resume,
            "cover_letter": minimal_cover_letter,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "Acme Corp — Senior Engineer"
    assert body["job_description"]["cleaned"] is None
    assert body["resume"] is not None
    assert body["cover_letter"] is not None


def test_create_with_explicit_name_overrides_default(client, tmp_applications, minimal_resume):
    resp = client.post(
        "/applications",
        json={
            "job_description": {"raw": "Raw posting text."},
            "resume": minimal_resume,
            "name": "My Custom Package",
        },
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "My Custom Package"


def test_create_jd_only_no_resume_no_cover_letter(client, tmp_applications):
    resp = client.post(
        "/applications",
        json={"job_description": {"raw": "Raw posting text."}},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["resume"] is None
    assert body["cover_letter"] is None

    folder = tmp_applications / body["id"]
    assert not (folder / "resume.json").exists()
    assert not (folder / "resume.docx").exists()
    assert not (folder / "cover_letter.json").exists()


def test_create_renders_real_openable_docx_snapshots(
    client, tmp_applications, minimal_resume, minimal_cover_letter
):
    resp = client.post(
        "/applications",
        json={
            "job_description": {"raw": "Raw posting text."},
            "resume": minimal_resume,
            "cover_letter": minimal_cover_letter,
        },
    )
    assert resp.status_code == 200
    folder = tmp_applications / resp.json()["id"]

    resume_text = _extract_text(folder / "resume.docx")
    assert "Jane Doe" in resume_text
    assert "Built things." in resume_text

    cl_text = _extract_text(folder / "cover_letter.docx")
    assert "I am excited to apply for this role." in cl_text


def test_list_applications_returns_summaries_with_pill_flags(
    client, tmp_applications, minimal_resume, minimal_cover_letter
):
    a = client.post(
        "/applications",
        json={"job_description": {"raw": "JD one."}, "resume": minimal_resume},
    ).json()
    b = client.post(
        "/applications",
        json={
            "job_description": {"raw": "JD two."},
            "resume": minimal_resume,
            "cover_letter": minimal_cover_letter,
        },
    ).json()

    resp = client.get("/applications")

    assert resp.status_code == 200
    items = {item["id"]: item for item in resp.json()}
    assert set(items.keys()) == {a["id"], b["id"]}
    assert items[a["id"]]["has_resume"] is True
    assert items[a["id"]]["has_cover_letter"] is False
    assert items[b["id"]]["has_resume"] is True
    assert items[b["id"]]["has_cover_letter"] is True
    for item in items.values():
        assert set(item.keys()) == {"id", "name", "created_at", "has_resume", "has_cover_letter"}


def test_get_application_round_trip(client, tmp_applications, minimal_resume, minimal_cover_letter):
    created = client.post(
        "/applications",
        json={
            "job_description": {"raw": "Raw posting.", "cleaned": "Cleaned posting."},
            "resume": minimal_resume,
            "cover_letter": minimal_cover_letter,
        },
    ).json()

    resp = client.get(f"/applications/{created['id']}")

    assert resp.status_code == 200
    assert resp.json() == created


def test_get_missing_application_returns_404(client, tmp_applications):
    resp = client.get("/applications/does-not-exist")

    assert resp.status_code == 404


def test_delete_application_removes_folder_and_get_returns_404(
    client, tmp_applications, minimal_resume
):
    created = client.post(
        "/applications",
        json={"job_description": {"raw": "Raw posting."}, "resume": minimal_resume},
    ).json()
    folder = tmp_applications / created["id"]
    assert folder.exists()

    delete_resp = client.delete(f"/applications/{created['id']}")
    assert delete_resp.status_code == 204
    assert not folder.exists()

    get_resp = client.get(f"/applications/{created['id']}")
    assert get_resp.status_code == 404


def test_delete_missing_application_returns_404(client, tmp_applications):
    resp = client.delete("/applications/does-not-exist")

    assert resp.status_code == 404


def test_update_application_replaces_content_and_reflects_in_get(
    client, tmp_applications, minimal_resume, minimal_cover_letter
):
    created = client.post(
        "/applications",
        json={"job_description": {"raw": "Original JD."}, "resume": minimal_resume},
    ).json()

    updated_resume = {**minimal_resume}
    updated_resume["sections"] = [
        {
            **minimal_resume["sections"][0],
            "entries": [
                {
                    **minimal_resume["sections"][0]["entries"][0],
                    "bullets": [
                        {"id": "b_1", "text": "Rewrote this bullet entirely.", "tags": []},
                    ],
                }
            ],
        }
    ] + minimal_resume["sections"][1:]

    put_resp = client.put(
        f"/applications/{created['id']}",
        json={
            "job_description": {"raw": "Updated JD.", "cleaned": "Updated cleaned JD."},
            "resume": updated_resume,
            "cover_letter": minimal_cover_letter,
        },
    )

    assert put_resp.status_code == 200
    body = put_resp.json()
    assert body["id"] == created["id"]
    assert body["created_at"] == created["created_at"]
    assert body["updated_at"]
    assert body["job_description"] == {"raw": "Updated JD.", "cleaned": "Updated cleaned JD."}
    assert body["cover_letter"] is not None
    assert body["resume"]["sections"][0]["entries"][0]["bullets"][0]["text"] == (
        "Rewrote this bullet entirely."
    )

    folder = tmp_applications / created["id"]
    assert (folder / "job_description.txt").read_text() == "Updated JD."
    assert (folder / "job_description_cleaned.txt").read_text() == "Updated cleaned JD."
    assert (folder / "cover_letter.json").exists()
    resume_docx_text = _extract_text(folder / "resume.docx")
    assert "Rewrote this bullet entirely." in resume_docx_text
    assert "Built things." not in resume_docx_text

    get_resp = client.get(f"/applications/{created['id']}")
    assert get_resp.json() == body


def test_update_application_with_null_field_deletes_that_content(
    client, tmp_applications, minimal_resume, minimal_cover_letter
):
    created = client.post(
        "/applications",
        json={
            "job_description": {"raw": "JD."},
            "resume": minimal_resume,
            "cover_letter": minimal_cover_letter,
        },
    ).json()
    folder = tmp_applications / created["id"]
    assert (folder / "cover_letter.json").exists()
    assert (folder / "cover_letter.docx").exists()

    put_resp = client.put(
        f"/applications/{created['id']}",
        json={"job_description": {"raw": "JD."}, "resume": minimal_resume},
    )

    assert put_resp.status_code == 200
    assert put_resp.json()["cover_letter"] is None
    assert not (folder / "cover_letter.json").exists()
    assert not (folder / "cover_letter.docx").exists()


def test_update_missing_application_returns_404(client, tmp_applications, minimal_resume):
    resp = client.put(
        "/applications/does-not-exist",
        json={"job_description": {"raw": "JD."}, "resume": minimal_resume},
    )

    assert resp.status_code == 404
