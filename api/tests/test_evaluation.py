from evaluation import recall_at_k, reciprocal_rank, summarize_evaluation


def test_recall_and_reciprocal_rank_are_deterministic():
    ranked = ["p3", "p8", "p2", "p7", "p4"]
    relevant = {"p7", "p4"}
    assert recall_at_k(ranked, relevant, 5) == 1.0
    assert reciprocal_rank(ranked, relevant) == 0.25
    assert summarize_evaluation([(ranked, relevant)]) == {"recall_at_5": 1.0, "mrr": 0.25}
