"use client";

import { useState } from "react";

/*
  Simple UI for the recommender:
  - user types a query and chooses k
  - sends a POST to /api/recommend
  - shows a list of items with scores
*/

type Item = { id: string; title: string; score: number };
type RecommendResponse = { items: Item[] };
type ErrorResponse = { error?: string };

export default function Page() {
  // query text from the input
  const [query, setQuery] = useState("");
  // number of results to return
  const [k, setK] = useState(5);
  // basic loading state for the submit button
  const [loading, setLoading] = useState(false);
  // items returned from the API
  const [items, setItems] = useState<Item[]>([]);
  // error text (if something goes wrong)
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();            // stop page reload
    setError("");                  // clear any old error
    setItems([]);                  // clear old results

    const q = query.trim();        // remove extra spaces
    if (!q) {                      // basic validation
      setError("Please enter a query.");
      return;
    }

    try {
      setLoading(true);            // disable button while waiting

      // call our Next.js proxy which forwards to Flask
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, k })
      });

      const data = (await res.json()) as RecommendResponse & ErrorResponse;

      if (!res.ok) {
        // backend might return {error:"..."} on bad request
        setError(data?.error || "Request failed.");
        return;
      }

      if (!Array.isArray(data.items)) {
        setError("Unexpected response from API.");
        return;
      }

      setItems(data.items);        // show results
    } catch {
      setError("Could not reach the API. Make sure the backend is running.");
    } finally {
      setLoading(false);           // re-enable button
    }
  }

  const isDisabled = loading || !query.trim();

  return (
    <main>
      <h1>Mini Recommender</h1>
      <p>Type a short description (e.g., "gym headphones") and get similar items.</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label>
          Query: {' '}
          <br />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="wireless earbuds for workouts"
          />
        </label>

        <label>
          Results: {' '}
          <input
            type="number"
            min={1}
            max={10}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
          />
        </label>

        <button type="submit" disabled={isDisabled}>
          {loading ? "Searching..." : "Recommend"}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {!!items.length && (
        <ul className="list" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="item">
              {it.title} <span className="score">({(it.score * 100).toFixed(1)}%)</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}