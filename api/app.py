"""
Recommender API using Flask.

Loads a small list of products and uses embeddings
to find items similar to a text query.

Endpoints:
- GET /health -> quick check if the API is running
- GET /catalog -> returns the read-only catalog records
- POST /recommend -> returns top-k most similar products for a query
"""

import json
import logging
import os
import threading
import time
from typing import Any, Dict, List

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------
app = Flask(__name__)
TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",") if origin.strip()]
CORS(app, resources={r"/*": {"origins": TRUSTED_ORIGINS}}, supports_credentials=False)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8001"))
DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
DEFAULT_K = int(os.getenv("DEFAULT_K", "5"))
MAX_K = int(os.getenv("MAX_K", "10"))
EMBEDDING_BATCH_SIZE = max(1, int(os.getenv("EMBEDDING_BATCH_SIZE", "8")))
app.config["MAX_CONTENT_LENGTH"] = int(os.getenv("MAX_CONTENT_LENGTH", "20000"))
INFERENCE_CONCURRENCY = max(1, int(os.getenv("INFERENCE_CONCURRENCY", "1")))
RATE_LIMIT_REQUESTS = max(1, int(os.getenv("RATE_LIMIT_REQUESTS", "30")))
RATE_LIMIT_WINDOW_SECONDS = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")))

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Lazy-loaded globals
# -----------------------------------------------------------------------------
_DATA: List[Dict[str, Any]] = []
_EMB_MATRIX: np.ndarray | None = None
_MODEL: Any | None = None
_inference_slots = threading.BoundedSemaphore(INFERENCE_CONCURRENCY)
_rate_limit_lock = threading.Lock()
_rate_limit_state: dict[str, tuple[float, int]] = {}


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def error_response(message: str, status_code: int) -> tuple:
    return jsonify({"error": message}), status_code


def success_response(payload: Dict[str, Any], status_code: int = 200) -> tuple:
    return jsonify(payload), status_code


def request_is_rate_limited() -> bool:
    """Apply a small per-process fixed-window limit for public demo protection."""
    now = time.monotonic()
    client_key = request.remote_addr or "unknown"
    with _rate_limit_lock:
        window_start, count = _rate_limit_state.get(client_key, (now, 0))
        if now - window_start >= RATE_LIMIT_WINDOW_SECONDS:
            window_start, count = now, 0
        if count >= RATE_LIMIT_REQUESTS:
            _rate_limit_state[client_key] = (window_start, count)
            return True
        _rate_limit_state[client_key] = (window_start, count + 1)
    return False


def load_data() -> List[Dict[str, Any]]:
    """
    Load product data once from products.json and cache it in memory.
    """
    global _DATA
    if not _DATA:
        data_path = os.path.join(os.path.dirname(__file__), "data", "products.json")
        with open(data_path, "r", encoding="utf-8") as f:
            _DATA = json.load(f)
        logger.info("Loaded %s products from %s", len(_DATA), data_path)
    return _DATA


def get_model() -> Any:
    """
    Load the sentence transformer model once and reuse it.
    """
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", MODEL_NAME)
        _MODEL = SentenceTransformer(MODEL_NAME)
        logger.info("Embedding model loaded successfully")
    return _MODEL


def embedding_text(item: Dict[str, Any]) -> str:
    """Build the searchable text representation for one catalog record."""
    tags = ", ".join(str(tag) for tag in item.get("tags", []))
    return f"{item['title']}. {item.get('description', '')} Categories: {item.get('category', '')}. Tags: {tags}."


def get_embeddings() -> np.ndarray:
    """
    Compute and cache normalized embeddings for all product titles.
    """
    global _EMB_MATRIX
    if _EMB_MATRIX is None:
        items = load_data()
        searchable_text = [embedding_text(item) for item in items]
        model = get_model()
        vectors = model.encode(
            searchable_text,
            batch_size=EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        _EMB_MATRIX = np.array(vectors, dtype=np.float32)
        logger.info("Cached product embedding matrix with shape %s", _EMB_MATRIX.shape)
    return _EMB_MATRIX


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.get("/health")
def health():
    """
    Simple health check endpoint.
    """
    return success_response(
        {
            "status": "ok",
            "service": "recommender-api",
            "model_loaded": _MODEL is not None,
            "data_loaded": len(_DATA) > 0,
            "embedding_cached": _EMB_MATRIX is not None,
            "model_name": MODEL_NAME,
        }
    )


@app.get("/")
def index():
    """
    Landing route with quick API reference.
    """
    return success_response(
        {
            "service": "recommender-api",
            "model_name": MODEL_NAME,
            "endpoints": {
                "health": "GET /health",
                "catalog": "GET /catalog",
                "recommend": 'POST /recommend (body: {"query": "...", "k": 5})',
            },
        }
    )


@app.get("/favicon.ico")
def favicon():
    """
    Ignore browser favicon requests.
    """
    return ("", 204)


@app.get("/catalog")
def catalog():
    """Return the actual title-only catalog used by retrieval."""
    try:
        items = load_data()
        return success_response(
            {
                "items": [
                    {
                        "id": item["id"],
                        "title": item["title"],
                        "category": item.get("category", ""),
                        "description": item.get("description", ""),
                        "tags": item.get("tags", []),
                    }
                    for item in items
                ],
                "count": len(items),
            }
        )
    except Exception:
        logger.exception("Unexpected error during /catalog")
        return error_response("catalog unavailable", 500)


@app.route("/recommend", methods=["OPTIONS"])
def recommend_options():
    """
    Respond to browser preflight requests.
    """
    return ("", 204)


@app.post("/recommend")
def recommend():
    """
    Return the top-k most similar products for a query.

    Expects:
        {"query": "running shoes", "k": 5}

    Returns:
        {
            "items": [...],
            "count": 5,
            "inference_time_ms": 12.34
        }
    """
    try:
        if request_is_rate_limited():
            return error_response("request rate limit exceeded", 429)
        body = request.get_json(silent=True)
        if not isinstance(body, dict):
            return error_response("request body must be a JSON object", 400)

        raw_query = body.get("query")
        if "query" not in body:
            return error_response("query is required", 400)
        if not isinstance(raw_query, str):
            return error_response("query must be a string", 400)
        query = raw_query.strip()
        raw_k = body.get("k", DEFAULT_K)

        if not query:
            return error_response("query is required", 400)

        if len(query) > 1000:
            return error_response("query is too long", 400)

        if isinstance(raw_k, bool):
            return error_response("k must be an integer", 400)
        try:
            k = int(raw_k)
        except (TypeError, ValueError):
            return error_response("k must be an integer", 400)

        if k < 1:
            return error_response("k must be at least 1", 400)

        if k > MAX_K:
            k = MAX_K

        items = load_data()
        if not items:
            return error_response("catalog is unavailable", 503)

        if not _inference_slots.acquire(blocking=False):
            return error_response("inference service is busy; retry shortly", 429)

        try:
            model = get_model()
            embeddings = get_embeddings()
            start_time = time.perf_counter()

            query_vector = model.encode([query], normalize_embeddings=True)
            query_array = np.asarray(query_vector, dtype=np.float32)
            catalog_array = np.asarray(embeddings, dtype=np.float32)
            query_norm = np.linalg.norm(query_array, axis=1, keepdims=True)
            catalog_norm = np.linalg.norm(catalog_array, axis=1, keepdims=True)
            if np.any(query_norm == 0) or np.any(catalog_norm == 0):
                return error_response("catalog contains invalid embeddings", 503)
            similarities = ((query_array / query_norm) @ (catalog_array / catalog_norm).T)[0]
            top_indices = np.argsort(-similarities)[:k]

            end_time = time.perf_counter()
        finally:
            _inference_slots.release()
        inference_time_ms = round((end_time - start_time) * 1000, 2)

        results = [
            {
                "id": items[i]["id"],
                "title": items[i]["title"],
                "category": items[i].get("category", ""),
                "description": items[i].get("description", ""),
                "tags": items[i].get("tags", []),
                "score": round(float(similarities[i]), 6),
            }
            for i in top_indices
        ]

        response = {
            "items": results,
            "count": len(results),
            "inference_time_ms": inference_time_ms,
        }

        logger.info(
            "Recommendation completed | count=%s | inference_time_ms=%.2f",
            response["count"],
            response["inference_time_ms"],
        )

        return success_response(response)

    except Exception:
        logger.exception("Unexpected error during /recommend")
        return error_response("internal server error", 500)


@app.errorhandler(413)
def request_too_large(_error):
    return error_response("request body is too large", 413)


# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Starting recommender-api on %s:%s", HOST, PORT)
    app.run(host=HOST, port=PORT, debug=DEBUG)
