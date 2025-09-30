"""
Simple recommender API using Flask.

Loads a small list of products and uses embeddings
to find items similar to a text query.
"""

# standard library
import json   # to read product data
import os     # to build file paths
from typing import List, Dict  # basic type hints

# web framework
from flask import Flask, request, jsonify
from flask_cors import CORS

# ML / math
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer


# set up the Flask app
app = Flask(__name__)

# allow requests from other origins (frontend, etc.)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=False)


# globals (lazy-loaded so we don’t recompute each request)
_DATA: List[Dict] = []                  # product list
_EMB_MATRIX: np.ndarray | None = None   # product embeddings
_MODEL: SentenceTransformer | None = None  # sentence transformer model


def load_data() -> List[Dict]:
    """load product data from products.json (once)"""
    global _DATA
    if not _DATA:
        data_path = os.path.join(os.path.dirname(__file__), "data", "products.json")
        with open(data_path, "r", encoding="utf-8") as f:
            _DATA = json.load(f)
    return _DATA


def get_model() -> SentenceTransformer:
    """load the sentence transformer model (once)"""
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    return _MODEL


def get_embeddings() -> np.ndarray:
    """make and cache embeddings for all product titles"""
    global _EMB_MATRIX
    if _EMB_MATRIX is None:
        items = load_data()
        titles = [x["title"] for x in items]
        model = get_model()
        vecs = model.encode(titles, normalize_embeddings=True)
        _EMB_MATRIX = np.array(vecs, dtype=np.float32)
    return _EMB_MATRIX


@app.get("/health")
def health():
    """simple health check"""
    return jsonify({"status": "ok", "service": "recommender-api"}), 200


@app.post("/recommend")
def recommend():
    """return the top-k most similar products for a query"""
    body = request.get_json(silent=True) or {}
    query = (body.get("query") or "").strip()
    k = int(body.get("k") or 5)

    if not query:
        return jsonify({"error": "query is required"}), 400

    # embed the query
    model = get_model()
    q_vec = model.encode([query], normalize_embeddings=True)

    # get embeddings for all products
    emb = get_embeddings()

    # compute similarity between query and products
    sims = cosine_similarity(q_vec, emb)[0]

    # sort and take top-k
    top_idx = np.argsort(-sims)[:k]

    # build response list
    items = load_data()
    results = [
        {
            "id": items[i]["id"],
            "title": items[i]["title"],
            "score": float(sims[i])
        }
        for i in top_idx
    ]

    return jsonify({"items": results}), 200


@app.get("/")
def index():
    """landing route with quick API info"""
    return jsonify({
        "service": "recommender-api",
        "endpoints": {
            "health": "/health",
            "recommend": "POST /recommend  (body: {\"query\": \"...\", \"k\": 5})"
        }
    }), 200


@app.get("/favicon.ico")
def favicon():
    """ignore browser favicon requests"""
    return ("", 204)


if __name__ == "__main__":
    # run locally on port 8001
    app.run(host="0.0.0.0", port=8001, debug=True)