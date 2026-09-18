from app.services.usage_guard import DAILY_CALL_LIMIT


def test_health(client):
    resp = client.get("/health")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_get_profile(client, tmp_profile_path, minimal_profile):
    resp = client.get("/profile")

    assert resp.status_code == 200
    assert resp.json()["meta"]["name"]["text"] == minimal_profile["meta"]["name"]["text"]


def test_put_profile_updates_and_persists(client, tmp_profile_path, minimal_profile):
    updated = dict(minimal_profile)
    updated["summary_pool"] = [
        {
            "id": "role_backend",
            "role_type": "Backend",
            "summaries": [{"id": "summary_backend_1", "text": "An updated summary."}],
        }
    ]

    put_resp = client.put("/profile", json=updated)
    assert put_resp.status_code == 200

    get_resp = client.get("/profile")
    assert get_resp.json()["summary_pool"] == updated["summary_pool"]


def test_usage_reports_zero_calls_by_default(client):
    resp = client.get("/usage")

    assert resp.status_code == 200
    assert resp.json() == {"calls_today": 0, "limit": DAILY_CALL_LIMIT}
