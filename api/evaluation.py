"""Small deterministic ranking evaluation fixture for the synthetic catalog."""

from typing import Iterable, Sequence

EVALUATION_CASES = [
    {"query": "wireless audio for commuting", "relevant_ids": {"p1", "p14", "p16"}},
    {"query": "home strength and mobility workout", "relevant_ids": {"p18", "p19", "p20", "p23", "p24"}},
    {"query": "desk setup for programming and posture", "relevant_ids": {"p7", "p8", "p26", "p27", "p28"}},
    {"query": "portable camera and microphone for tutorials", "relevant_ids": {"p9", "p42", "p43", "p47", "p48"}},
    {"query": "organized travel power and electronics", "relevant_ids": {"p51", "p52", "p58", "p60"}},
]


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: Iterable[str], k: int = 5) -> float:
    relevant = set(relevant_ids)
    if not relevant:
        return 0.0
    return len(set(ranked_ids[:k]) & relevant) / len(relevant)


def reciprocal_rank(ranked_ids: Sequence[str], relevant_ids: Iterable[str]) -> float:
    relevant = set(relevant_ids)
    for rank, item_id in enumerate(ranked_ids, start=1):
        if item_id in relevant:
            return 1.0 / rank
    return 0.0


def summarize_evaluation(results: Sequence[tuple[Sequence[str], Iterable[str]]], k: int = 5) -> dict[str, float]:
    if not results:
        return {"recall_at_5": 0.0, "mrr": 0.0}
    return {
        "recall_at_5": round(sum(recall_at_k(ids, relevant, k) for ids, relevant in results) / len(results), 4),
        "mrr": round(sum(reciprocal_rank(ids, relevant) for ids, relevant in results) / len(results), 4),
    }
