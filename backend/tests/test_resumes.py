def test_create_and_get_resume_round_trip(client, tmp_saved_items, minimal_resume):
    create_resp = client.post("/resumes", json={"type": "resume", "data": minimal_resume})
    assert create_resp.status_code == 200
    created = create_resp.json()
    assert created["type"] == "resume"
    assert created["name"].startswith("Resume — ")
    assert created["data"] == minimal_resume

    get_resp = client.get(f"/resumes/{created['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json() == created


def test_create_cover_letter_default_name_uses_company_and_role(
    client, tmp_saved_items, minimal_cover_letter
):
    resp = client.post("/resumes", json={"type": "cover_letter", "data": minimal_cover_letter})

    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme Corp — Senior Engineer"


def test_create_with_explicit_name_overrides_default(client, tmp_saved_items, minimal_resume):
    resp = client.post(
        "/resumes", json={"type": "resume", "data": minimal_resume, "name": "My Custom Name"}
    )

    assert resp.status_code == 200
    assert resp.json()["name"] == "My Custom Name"


def test_list_resumes_returns_summaries_only(client, tmp_saved_items, minimal_resume):
    a = client.post("/resumes", json={"type": "resume", "data": minimal_resume}).json()
    b = client.post("/resumes", json={"type": "resume", "data": minimal_resume}).json()

    resp = client.get("/resumes")

    assert resp.status_code == 200
    items = resp.json()
    ids = {item["id"] for item in items}
    assert ids == {a["id"], b["id"]}
    for item in items:
        assert set(item.keys()) == {"id", "name", "type", "created_at"}


def test_get_missing_resume_returns_404(client, tmp_saved_items):
    resp = client.get("/resumes/does-not-exist")

    assert resp.status_code == 404


def test_delete_resume_then_get_returns_404(client, tmp_saved_items, minimal_resume):
    created = client.post("/resumes", json={"type": "resume", "data": minimal_resume}).json()

    delete_resp = client.delete(f"/resumes/{created['id']}")
    assert delete_resp.status_code == 204

    get_resp = client.get(f"/resumes/{created['id']}")
    assert get_resp.status_code == 404


def test_delete_missing_resume_returns_404(client, tmp_saved_items):
    resp = client.delete("/resumes/does-not-exist")

    assert resp.status_code == 404
