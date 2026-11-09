"""
Tests for the Flask recommender API recommendation endpoint.
"""

import os
import sys

import pytest
import numpy as np

# Ensure the parent api/ directory is available on the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
import app as app_module


@pytest.fixture
def client():
    """
    Create a Flask test client for the application.
    """
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_recommend_requires_query(client):
    """
    /recommend should return HTTP 400 when query is missing.
    """
    response = client.post("/recommend", json={})
    assert response.status_code == 400

    data = response.get_json()
    assert data is not None
    assert data.get("error") == "query is required"


def test_catalog_returns_title_records(client):
    response = client.get("/catalog")
    assert response.status_code == 200
    data = response.get_json()
    assert data is not None
    assert data["count"] == 80
    assert [item["id"] for item in data["items"]] == [f"p{i}" for i in range(1, 81)]
    assert all({"id", "title", "category", "description", "tags"}.issubset(item) for item in data["items"])
    assert len({item["title"] for item in data["items"]}) == 80


def test_recommend_success(client, monkeypatch):
    """
    /recommend should return items, count, and inference timing for valid input.
    """
    class FakeModel:
        def encode(self, values, normalize_embeddings=True, **_kwargs):
            return np.ones((len(values), 2), dtype=np.float32)

    monkeypatch.setattr(app_module, "get_model", lambda: FakeModel())
    monkeypatch.setattr(app_module, "get_embeddings", lambda: np.ones((10, 2), dtype=np.float32))
    response = client.post(
        "/recommend",
        json={"query": "comfortable running shoes", "k": 3},
    )
    assert response.status_code == 200

    data = response.get_json()
    assert data is not None
    assert "items" in data
    assert "count" in data
    assert "inference_time_ms" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["count"], int)
    assert isinstance(data["inference_time_ms"], float)
    assert data["count"] <= 3

    if data["items"]:
        first_item = data["items"][0]
        assert "id" in first_item
        assert "title" in first_item
        assert "score" in first_item
        assert isinstance(first_item["score"], float)


def test_recommend_invalid_k(client):
    """
    /recommend should return HTTP 400 when k is not a valid integer.
    """
    response = client.post(
        "/recommend",
        json={"query": "running shoes", "k": "abc"},
    )
    assert response.status_code == 400

    data = response.get_json()
    assert data is not None
    assert data.get("error") == "k must be an integer"


def test_recommend_k_must_be_positive(client):
    """
    /recommend should return HTTP 400 when k is less than 1.
    """
    response = client.post(
        "/recommend",
        json={"query": "running shoes", "k": 0},
    )
    assert response.status_code == 400

    data = response.get_json()
    assert data is not None
    assert data.get("error") == "k must be at least 1"


def test_recommend_rejects_non_string_query(client):
    response = client.post("/recommend", json={"query": 123})
    assert response.status_code == 400
    assert response.get_json()["error"] == "query must be a string"


def test_recommend_rejects_malformed_json(client):
    response = client.post("/recommend", data="{", content_type="application/json")
    assert response.status_code == 400
    assert response.get_json()["error"] == "request body must be a JSON object"


def test_recommend_rejects_oversized_query(client):
    response = client.post("/recommend", json={"query": "x" * 1001})
    assert response.status_code == 400
    assert response.get_json()["error"] == "query is too long"


def test_recommend_empty_catalog_is_safe(client, monkeypatch):
    monkeypatch.setattr(app_module, "load_data", lambda: [])
    response = client.post("/recommend", json={"query": "shoes"})
    assert response.status_code == 503
    assert response.get_json() == {"error": "catalog is unavailable"}


def test_recommend_model_failure_is_safe(client, monkeypatch):
    monkeypatch.setattr(app_module, "get_model", lambda: (_ for _ in ()).throw(RuntimeError("hidden")))
    response = client.post("/recommend", json={"query": "shoes"})
    assert response.status_code == 500
    assert response.get_json() == {"error": "internal server error"}


def test_recommend_ranks_fixed_embeddings(client, monkeypatch):
    items = [{"id": "a", "title": "First"}, {"id": "b", "title": "Second"}]

    class FakeModel:
        def encode(self, values, normalize_embeddings=True, **_kwargs):
            assert normalize_embeddings is True
            return np.array([[1.0, 0.0]] if len(values) == 1 else [[0.2, 0.98], [1.0, 0.0]])

    monkeypatch.setattr(app_module, "load_data", lambda: items)
    monkeypatch.setattr(app_module, "get_model", lambda: FakeModel())
    monkeypatch.setattr(app_module, "get_embeddings", lambda: np.array([[0.2, 0.98], [1.0, 0.0]]))
    response = client.post("/recommend", json={"query": "exact", "k": 2})
    assert response.status_code == 200
    assert [item["id"] for item in response.get_json()["items"]] == ["b", "a"]
