"""
Tests for the Flask recommender API health endpoint.
"""

import os
import sys

import pytest

# Ensure the parent api/ directory is available on the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app


@pytest.fixture
def client():
    """
    Create a Flask test client for the application.
    """
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_ok(client):
    """
    /health should return HTTP 200 with the expected JSON payload.
    """
    response = client.get("/health")

    assert response.status_code == 200

    data = response.get_json()
    assert data is not None
    assert data.get("status") == "ok"
    assert data.get("service") == "recommender-api"
    assert "model_loaded" in data
    assert "data_loaded" in data
    assert "embedding_cached" in data
    assert "model_name" in data