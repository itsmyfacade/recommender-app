# Recommender Service

Production-oriented semantic recommendation API powered by sentence embeddings. Designed as a modular machine learning inference service with a separate frontend client.

## Overview

This project implements a REST-based recommendation service using a pre-trained SentenceTransformer model. The system encodes product titles into embeddings, computes cosine similarity against a user query, and returns the top-k most relevant items through a Flask API. A Next.js frontend provides a simple client interface.

The architecture emphasizes:

- Clean separation of backend and frontend
- Reusable embedding pipeline
- Testable API endpoints
- Production-aware structure

## Model

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Framework: SentenceTransformers with PyTorch
- Task: Semantic similarity search
- Output: Ranked product recommendations with similarity scores

The model is initialized once and reused across inference requests to minimize repeated load overhead. Product embeddings are computed once and cached for efficient recommendation serving.

## API Endpoints

### Health Check

`GET /health`

Returns service status and model metadata.

### Recommendations

`POST /recommend`

Request:

```json
{
  "query": "comfortable running shoes",
  "k": 3
}
```

Response:

```json
{
  "count": 3,
  "inference_time_ms": 42.71,
  "items": [
    {
      "id": "p4",
      "score": 0.745991,
      "title": "Running Shoes with Arch Support"
    },
    {
      "id": "p3",
      "score": 0.223205,
      "title": "Bluetooth Speaker for Outdoor Use"
    },
    {
      "id": "p7",
      "score": 0.187171,
      "title": "Laptop Stand for Better Posture"
    }
  ]
}
```

## Architecture

```text
recommender-app/
|-- api/
|   |-- app.py
|   |-- requirements.txt
|   |-- data/
|   |   |-- products.json
|   |-- tests/
|   |-- Dockerfile
|   |-- .dockerignore
|-- web/
|   |-- app/
|-- README.md
```

- Backend handles embedding generation, similarity search, and API routing
- Frontend provides the client interaction layer
- Service boundaries support independent deployment

## Design Principles

- Separation of concerns between inference service and UI
- Stateless API design
- Deterministic JSON responses
- Cached embeddings for efficient recommendations
- Easily containerizable backend
- Model abstraction for future swap or upgrade

## Local Setup

### Clone the Repository

```powershell
git clone https://github.com/itsmyfacade/recommender-app.git
cd recommender-app
```

### Backend

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python app.py
```

Backend runs on:

`http://127.0.0.1:8001`

### Frontend

```powershell
cd web
npm install
npm run dev
```

Frontend runs on:

`http://127.0.0.1:3000`

## Docker

The backend service can be containerized and deployed using Docker.
The container runs the Flask API using Gunicorn for production-style serving.

### Build the Image

From the `api` directory:

```bash
docker build -t recommender-api .
```

### Run the Container

```bash
docker run -p 8001:8001 recommender-api
```

The API will be available at:

`http://127.0.0.1:8001`

### Verify the Service

Health check:

```bash
curl http://127.0.0.1:8001/health
```

Recommendation query:

```bash
curl -X POST "http://127.0.0.1:8001/recommend" \
  -H "Content-Type: application/json" \
  -d '{"query":"comfortable running shoes","k":3}'
```

### Notes

- Gunicorn is used as the production WSGI server inside the container
- The model is initialized once and reused across requests
- Product embeddings are cached after initial computation
- The first recommendation request may take longer due to model and embedding initialization

## Example Requests

### Health Check

```bash
curl http://127.0.0.1:8001/health
```

Example response:

```json
{
  "data_loaded": false,
  "embedding_cached": false,
  "model_loaded": false,
  "model_name": "sentence-transformers/all-MiniLM-L6-v2",
  "service": "recommender-api",
  "status": "ok"
}
```

### Recommendation Query

```bash
curl -X POST "http://127.0.0.1:8001/recommend" \
  -H "Content-Type: application/json" \
  -d '{"query":"comfortable running shoes","k":3}'
```

Example response:

```json
{
  "count": 3,
  "inference_time_ms": 42.71,
  "items": [
    {
      "id": "p4",
      "score": 0.745991,
      "title": "Running Shoes with Arch Support"
    },
    {
      "id": "p3",
      "score": 0.223205,
      "title": "Bluetooth Speaker for Outdoor Use"
    },
    {
      "id": "p7",
      "score": 0.187171,
      "title": "Laptop Stand for Better Posture"
    }
  ]
}
```

You can also open the frontend at `http://127.0.0.1:3000` and submit a query through the form.

## Testing

Run the backend tests with:

```powershell
cd api
pytest -q
```

Current test coverage includes:

- `/health` endpoint validation
- `/recommend` success path
- `/recommend` missing query validation
- `/recommend` invalid `k` validation
- `/recommend` positive `k` validation

## Performance

Local CPU benchmark using a warm model:

- Native local recommendation inference observed around `8.54 ms`
- Containerized recommendation inference observed around `42.71 ms`
- Product embeddings are cached to avoid repeated recomputation
- Model is reused across requests to reduce load overhead
- Response includes ranked results and latency measurement

## Production Considerations

- Model initialized once and reused across requests
- Product embeddings cached in memory
- Structured JSON responses
- Input validation for missing query and invalid `k`
- REST interface suitable for containerization
- Test coverage for critical endpoints
- Environment variable support for model name and runtime configuration

## Tech Stack

- Python
- Flask
- SentenceTransformers
- PyTorch
- scikit-learn
- NumPy
- Next.js
- TypeScript

## Security and deployment boundary

Set `FRONTEND_ORIGINS` to the exact frontend origin before exposing the API. The API applies bounded request sizes, a single in-process inference slot, a small per-process fixed-window request limit, and safe public errors. Catalog embedding initialization uses a bounded batch size to reduce peak memory. These controls are suitable for a controlled demonstration, not a substitute for a distributed production rate limiter or authentication. Tests use fixed embeddings and mocked model calls where appropriate, so they do not download the SentenceTransformer model. A real demo still requires model download, memory for PyTorch, and deployment-specific abuse protection. This repository has not been deployed or load-tested as a public service.
## Final frontend experience

The Next.js client is a dark semantic-discovery workspace with natural-language search, example queries, supported result-count selection, disabled duplicate submissions, embedding/loading feedback, ranked catalog titles, real similarity scores, and explicit limitations around purchase prediction.

```text
Browser → Next.js /api/recommend proxy → Flask /recommend → MiniLM embeddings
```

Use Python 3.12 for the documented local environment. The Dockerfile installs CPU-only Torch; isolated container build, real MiniLM inference, and 80-record catalog verification have passed. After reducing catalog embedding batch size, a strict 512 MiB container acceptance run completed real MiniLM inference at approximately 409 MiB, leaving limited headroom. Public deployment remains unverified.
## Verified two-terminal startup

```powershell
# Terminal 1 - backend
cd api
py -3.12 -m venv .venv312
.\.venv312\Scripts\Activate.ps1
$env:PORT = "8012"
$env:FRONTEND_ORIGINS = "http://localhost:3112"
pip install -r requirements.txt
python app.py

# Terminal 2 - frontend
cd web
npm ci
$env:API_URL = "http://127.0.0.1:8012"
npm run dev -- --port 3112
```

Open `http://localhost:3112`. The backend health endpoint is `http://127.0.0.1:8012/health`.

The server-side proxies allow up to three minutes for a sleeping backend to cold-start, then return a safe error instead of leaving the UI waiting indefinitely. Set `API_TIMEOUT_MS` to override this value when the deployment environment has a different startup budget.

## Current catalog and evaluation

The source-of-truth catalog contains exactly 80 synthetic demonstration records across eight categories: Audio, Fitness, Workstation, Smart Devices, Capture, Travel, Kitchen, and Outdoor. Every record has a stable ID, title, category, short description, and searchable tags. The API returns these fields from `GET /catalog`; recommendation embeddings are built from the title, description, category, and tags, then normalized for cosine-similarity ranking.

Run the deterministic ranking evaluation with the real local model after the model is available:

```powershell
cd api
python evaluate_catalog.py
```

The evaluation reports measured Recall@5 and MRR for five representative queries. These are local synthetic-catalog evaluation results, not model accuracy or production performance claims.

The browser workbench provides semantic search, two-query comparison, category/text filtering for all catalog records, session-only history, and CSV export. It does not provide personalization, commercial inventory, prices, ratings, or purchasing links.

## Container and deployment boundary

The backend Dockerfile uses one Gunicorn `gthread` worker with two threads, CPU-only PyTorch, and the container `PORT` contract. The single process preserves model memory while allowing the lightweight `/health` endpoint to respond during inference. A Render deployment should use separate frontend and backend services, set the frontend `API_URL` to the backend URL, expose only the backend health path publicly, and retain deployment-level abuse protection.

## Final acceptance measurements

- Isolated Docker build: passed.
- Isolated real MiniLM inference: passed against the expanded catalog.
- Loaded container memory observed: approximately 392 MiB after the 80-record embedding matrix was cached.
- Image size observed before the final PORT-only rebuild: approximately 2.41 GB; the rebuild changes startup binding only.
- `GET /catalog` returned all 80 records.
- QA containers used dedicated names, ports, and network; no MAATMARK resources were modified.

## Render preparation and cost boundary

`render.yaml` defines a free Node frontend and a free Docker API service. A strict local 512 MiB cap completed real MiniLM inference at approximately 442 MiB, leaving limited headroom for a controlled demonstration. Free services can cold-start and can be suspended after free instance hours are exhausted; this is not production certification. Set `FRONTEND_ORIGINS` and the frontend `API_URL` during Blueprint setup; no secrets are committed.

Deployment steps: create a Render Blueprint from `render.yaml`, provide the two prompted URLs, confirm the API service health check, wait for the model's first cold start, then test `/health`, `/catalog`, and one `/recommend` request. No deployment has been performed by this repository.

The workbench includes semantic search, two-query comparison, session-only search history, CSV export, and a catalog explorer backed by the read-only `GET /catalog` endpoint. The explorer displays the actual 80 synthetic records used for retrieval, supports category and text filtering, and does not invent prices, ratings, images, or personalization signals.
