"""
Quick test for the /recommend endpoint.
Checks that if we don't send a query, the API gives back a 400 error.
"""

import json
from app import app


def test_recommend_requires_query():
    # set up a temporary client to call the API
    client = app.test_client()

    # send an empty JSON body, should give a 400 (bad request)
    resp = client.post("/recommend", json={})
    assert resp.status_code == 400

    # turn the response into a Python dict
    data = json.loads(resp.data)

    # make sure the response includes an "error" field
    assert "error" in data