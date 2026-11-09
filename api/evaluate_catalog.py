"""Run the real MiniLM ranking evaluation against the local synthetic catalog."""

import json

from app import app
from evaluation import EVALUATION_CASES, summarize_evaluation


def main() -> None:
    results = []
    with app.test_client() as client:
        for case in EVALUATION_CASES:
            response = client.post("/recommend", json={"query": case["query"], "k": 5})
            if response.status_code != 200:
                raise RuntimeError(f"Evaluation request failed: {response.status_code}")
            ranked_ids = [item["id"] for item in response.get_json()["items"]]
            results.append((ranked_ids, case["relevant_ids"]))
            print(json.dumps({"query": case["query"], "ranked_ids": ranked_ids}))
    print(json.dumps(summarize_evaluation(results), indent=2))


if __name__ == "__main__":
    main()
