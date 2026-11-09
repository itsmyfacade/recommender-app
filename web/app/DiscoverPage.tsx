"use client";

import { useState } from "react";

type Item = { id: string; title: string; score: number };
type RecommendResponse = {
  items: Item[];
  count?: number;
  inference_time_ms?: number;
};
type ErrorResponse = { error?: string };

const examples = [
  "comfortable running shoes",
  "wireless earbuds for workouts",
  "desk setup for better posture",
];

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [k, setK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [inferenceTime, setInferenceTime] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setItems([]);
    setInferenceTime(null);
    const value = query.trim();
    if (!value) {
      setError("Enter a description before searching.");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: value, k }),
      });
      const data = (await response.json()) as RecommendResponse & ErrorResponse;
      if (!response.ok) {
        setError(
          data.error || "The recommendation request could not be completed.",
        );
        return;
      }
      if (!Array.isArray(data.items)) {
        setError("The service returned an unexpected response.");
        return;
      }
      setItems(data.items);
      setInferenceTime(
        typeof data.inference_time_ms === "number"
          ? data.inference_time_ms
          : null,
      );
    } catch {
      setError(
        "Could not reach the recommendation service. Check that the backend is running.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Semantic Discovery home">
          <span className="brand-mark" aria-hidden="true">
            SD
          </span>
          <span>Semantic Discovery</span>
        </a>
        <span className="service-status">
          <span className="status-dot" /> Local embedding workspace
        </span>
      </header>
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">SEMANTIC RETRIEVAL / PRODUCT CATALOG</p>
        <h1 id="page-title">
          Search by
          <br />
          <span>what you mean.</span>
        </h1>
        <p className="hero-copy">
          Describe the thing you need in natural language. MiniLM turns your
          query and the catalog into embeddings, then ranks the closest matches
          by semantic similarity.
        </p>
      </section>
      <section
        className="workspace-grid"
        aria-label="Semantic recommendation workspace"
      >
        <form className="search-card" onSubmit={onSubmit}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">01 / DISCOVER</p>
              <h2>Describe what you need</h2>
            </div>
            <span className="model-chip">MINILM</span>
          </div>
          <label className="field-label" htmlFor="recommendation-query">
            Natural-language query
          </label>
          <input
            id="recommendation-query"
            value={query}
            maxLength={1000}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. a comfortable setup for long work sessions"
            aria-describedby="query-help"
          />
          <div className="field-meta">
            <span id="query-help">
              Search the catalog by meaning, not exact keywords.
            </span>
            <span>{query.length} / 1,000</span>
          </div>
          <div className="search-options">
            <label className="field-label" htmlFor="result-count">
              Results to return
            </label>
            <select
              id="result-count"
              value={k}
              onChange={(event) => setK(Number(event.target.value))}
            >
              {[3, 5, 8, 10].map((count) => (
                <option key={count} value={count}>
                  {count} matches
                </option>
              ))}
            </select>
          </div>
          <div className="examples" aria-label="Example searches">
            <span className="examples-label">Try a search</span>
            {examples.map((example) => (
              <button
                className="example-button"
                type="button"
                key={example}
                onClick={() => {
                  setQuery(example);
                  setError("");
                }}
              >
                {example}
              </button>
            ))}
          </div>
          <button
            className="primary-button"
            type="submit"
            disabled={loading || !query.trim()}
          >
            <span>{loading ? "Searching catalog" : "Find similar items"}</span>
            <span aria-hidden="true">{loading ? "…" : "→"}</span>
          </button>
          <div className="form-status" aria-live="polite">
            {loading && (
              <span className="loading-line">
                <span className="spinner" /> Encoding query and ranking matches…
              </span>
            )}
            {error && (
              <div className="error-message" role="alert">
                <strong>Search not completed</strong>
                <span>{error}</span>
              </div>
            )}
          </div>
        </form>
        <section
          className="results-card"
          aria-live="polite"
          aria-labelledby="results-title"
        >
          <div className="card-heading">
            <div>
              <p className="eyebrow">02 / RESULTS</p>
              <h2 id="results-title">Closest matches</h2>
            </div>
            <span className="result-index">
              {items.length ? `${items.length} FOUND` : "WAITING"}
            </span>
          </div>
          {items.length ? (
            <div className="results-list">
              {items.map((item, index) => (
                <article className="product-result" key={item.id}>
                  <div className="rank">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="product-copy">
                    <h3>{item.title}</h3>
                    <div className="similarity">
                      <div className="similarity-head">
                        <span>Semantic similarity</span>
                        <strong>{item.score.toFixed(4)}</strong>
                      </div>
                      <div className="similarity-track">
                        <span
                          style={{
                            width: `${Math.max(0, Math.min(1, item.score)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-result">
              <div className="empty-orbit" aria-hidden="true">
                <span />
              </div>
              <h3>Search results will appear here</h3>
              <p>
                Describe a need to compare it with the 10-item demonstration
                catalog.
              </p>
            </div>
          )}
          {items.length > 0 && (
            <div className="results-footer">
              <span>
                Scores are similarity measures, not purchase probabilities.
              </span>
              {inferenceTime !== null && (
                <strong>{inferenceTime.toFixed(2)} ms inference</strong>
              )}
            </div>
          )}
        </section>
      </section>
      <section className="model-note" aria-labelledby="model-note-title">
        <div className="note-icon" aria-hidden="true">
          ⌁
        </div>
        <div>
          <h2 id="model-note-title">How semantic discovery works</h2>
          <p>
            Each catalog title and your query are encoded with{" "}
            <strong>sentence-transformers/all-MiniLM-L6-v2</strong>. Normalized
            vectors are compared with cosine similarity, so related language can
            match even when the exact words differ. This demo contains product
            titles only, no prices, ratings, inventory, or purchase predictions.
          </p>
        </div>
      </section>
      <footer className="app-footer">
        <span>Built as a focused ML retrieval application</span>
        <span>MiniLM · SentenceTransformers · Flask · Next.js</span>
      </footer>
    </main>
  );
}
