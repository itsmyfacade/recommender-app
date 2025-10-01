"""
Simple test for the /health endpoint.
Checks that the API responds with 200 and the expected JSON fields.
"""

import json            # helps convert the response from bytes to dict
from app import app    # import the Flask app instance


def test_health_ok():
    # make a temporary client to send requests to the app
    client = app.test_client()

    # send a GET request to /health
    resp = client.get("/health")

    # verify the response status code
    assert resp.status_code == 200

    # decode the JSON response
    data = json.loads(resp.data)

    # confirm the JSON has the right keys/values
    assert data.get("status") == "ok"
    assert data.get("service") == "recommender-api"