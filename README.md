# Mini Recommender App

A small Flask API that suggests similar products using text embeddings.  
Built for learning and demo purposes.

---

## Features
- `GET /health` → quick check if the API is running  
- `POST /recommend` → send a query and get back the most similar items  

---

## Setup (Windows PowerShell)

Clone the repo and go into the folder:

```powershell
git clone https://github.com/itsmyfacade/recommender-app.git
cd recommender-app
```

Create and activate a virtual environment:

```bash cd api
python -m venv .venv
.\.venv\Scripts\Activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

---

Run the API

```bash
python app.py
```

The service will start on:
👉 http://127.0.0.1:8001

---

## Example Requests

**Health check:**

```bash
curl http://127.0.0.1:8001/health
```
**Recommend (ask for similar items):**

```bash
curl -X POST http://127.0.0.1:8001/recommend ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"wireless headphones\",\"k\":3}"
```

---

## Testing

Run quick tests with pytest:

```bash
cd api
python -m pytest -q
```
---

## Notes
*	Product data lives in api/data/products.json.
*	The model is all-MiniLM-L6-v2 from SentenceTransformers.
