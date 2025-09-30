"""
Fast negative-path test for /recommend.
- We send an empty body to confirm we get a 400 error.
- This keeps tests fast (no model download on CI).
"""

import json
from app import app


def test_recommend_requires_query():
    client = app.test_client()

    # send an empty JSON -> should return 400 with an error message
    resp = client.post("/recommend", json={})
    assert resp.status_code == 400

    data = json.loads(resp.data)
    assert "error" in data