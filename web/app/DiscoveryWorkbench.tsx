"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: string; title: string; score: number; category?: string; description?: string; tags?: string[] };
type SearchSession = {
  query: string;
  items: Item[];
  inferenceTime: number | null;
};
type ApiResponse = {
  items: Item[];
  inference_time_ms?: number;
  error?: string;
};
type CatalogItem = Pick<Item, "id" | "title" | "category" | "description" | "tags">;
type CatalogResponse = {
  items: CatalogItem[];
  count: number;
  error?: string;
};

const examples = [
  "comfortable running shoes",
  "wireless earbuds for workouts",
  "desk setup for better posture",
];

async function runQuery(
  query: string,
  k: number,
  signal: AbortSignal,
): Promise<SearchSession> {
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, k }),
    signal,
  });
  const data = (await response.json()) as ApiResponse;
  if (!response.ok || !Array.isArray(data.items))
    throw new Error(
      data.error || "The recommendation request could not be completed.",
    );
  return {
    query,
    items: data.items,
    inferenceTime:
      typeof data.inference_time_ms === "number"
        ? data.inference_time_ms
        : null,
  };
}

async function loadCatalog(
  signal: AbortSignal,
): Promise<CatalogItem[]> {
  const response = await fetch("/api/catalog", { signal });
  const data = (await response.json()) as CatalogResponse;
  if (!response.ok || !Array.isArray(data.items))
    throw new Error(data.error || "The catalog could not be loaded.");
  return data.items;
}

function exportRows(rows: SearchSession[], filename: string) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    "query,rank,id,title,similarity,inference_time_ms",
    ...rows.flatMap((session) =>
      session.items.map((item, index) =>
        [
          escape(session.query),
          index + 1,
          item.id,
          escape(item.title),
          item.score,
          session.inferenceTime ?? "",
        ].join(","),
      ),
    ),
  ].join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function ResultList({
  session,
  title,
}: {
  session: SearchSession;
  title?: string;
}) {
  return (
    <div className="comparison-column">
      <div className="comparison-title">{title || session.query}</div>
      {session.items.map((item, index) => (
        <article className="product-result" key={item.id}>
          <div className="rank">{String(index + 1).padStart(2, "0")}</div>
          <div className="product-copy">
            <h3>{item.title}</h3>
            {item.category && <span className="category-label">{item.category}</span>}
            {item.description && <p className="product-description">{item.description}</p>}
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
  );
}

export default function DiscoveryWorkbench() {
  const [mode, setMode] = useState<"search" | "compare" | "catalog">("search");
  const [query, setQuery] = useState("");
  const [secondQuery, setSecondQuery] = useState(
    "wireless earbuds for workouts",
  );
  const [k, setK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<SearchSession | null>(null);
  const [comparison, setComparison] = useState<SearchSession | null>(null);
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogFilter, setCatalogFilter] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  function changeMode(nextMode: "search" | "compare" | "catalog") {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setMode(nextMode);
    setSession(null);
    setComparison(null);
    setError("");
    setLoading(false);
    setCatalogError("");
    setCatalogFilter("");
    setCatalogCategory("all");
  }
  useEffect(() => {
    if (mode !== "catalog") return;
    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    abortRef.current = controller;
    setCatalogLoading(true);
    loadCatalog(controller.signal)
      .then((items) => {
        if (requestId.current === currentRequest) setCatalog(items);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (requestId.current === currentRequest)
          setCatalogError(
            err instanceof Error
              ? err.message
              : "The catalog could not be loaded.",
          );
      })
      .finally(() => {
        if (requestId.current === currentRequest) {
          setCatalogLoading(false);
          abortRef.current = null;
        }
      });
    return () => controller.abort();
  }, [mode]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = query.trim();
    const second = secondQuery.trim();
    if (!first) {
      setError("Enter a description before searching.");
      return;
    }
    if (mode === "compare" && !second) {
      setError("Add a second query for comparison.");
      return;
    }
    requestId.current += 1;
    const currentRequest = requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError("");
    setSession(null);
    setComparison(null);
    setLoading(true);
    try {
      const firstResult = await runQuery(first, k, controller.signal);
      if (currentRequest !== requestId.current) return;
      if (mode === "compare") {
        const secondResult = await runQuery(second, k, controller.signal);
        if (currentRequest !== requestId.current) return;
        setSession(firstResult);
        setComparison(secondResult);
        setHistory((items) =>
          [
            secondResult,
            firstResult,
            ...items.filter(
              (item) => item.query !== first && item.query !== second,
            ),
          ].slice(0, 8),
        );
      } else {
        setSession(firstResult);
        setHistory((items) =>
          [firstResult, ...items.filter((item) => item.query !== first)].slice(
            0,
            8,
          ),
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (currentRequest === requestId.current)
        setError(err instanceof Error ? err.message : "The request failed.");
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        abortRef.current = null;
      }
    }
  }
  const catalogCategories = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((item) => item.category)
            .filter((category): category is string => Boolean(category)),
        ),
      ).sort(),
    [catalog],
  );
  const filteredCatalog = useMemo(() => {
    const normalized = catalogFilter.trim().toLowerCase();
    return catalog.filter((item) => {
      const matchesCategory = catalogCategory === "all" || item.category === catalogCategory;
      const matchesText = !normalized || `${item.id} ${item.title} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesText;
    });
  }, [catalog, catalogCategory, catalogFilter]);
  const exportable =
    mode === "compare"
      ? [session, comparison].filter((item): item is SearchSession =>
          Boolean(item),
        )
      : mode === "search" && session
        ? [session]
        : [];
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Semantic Discovery home">
          Semantic Discovery
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
          Describe a need in natural language. MiniLM turns the query and
          catalog into embeddings, then ranks the closest matches by semantic
          similarity.
        </p>
      </section>
      <section
        className="workbench-panel discovery-panel"
        aria-label="Semantic recommendation workspace"
      >
        <div className="mode-switch" role="tablist" aria-label="Discovery mode">
          <button
            className={mode === "search" ? "active" : ""}
            role="tab"
            aria-selected={mode === "search"}
            onClick={() => changeMode("search")}
          >
            Semantic search
          </button>
          <button
            className={mode === "compare" ? "active" : ""}
            role="tab"
            aria-selected={mode === "compare"}
            onClick={() => changeMode("compare")}
          >
            Compare queries
          </button>
          <button
            className={mode === "catalog" ? "active" : ""}
            role="tab"
            aria-selected={mode === "catalog"}
            onClick={() => changeMode("catalog")}
          >
            Catalog explorer
          </button>
        </div>
        {mode === "catalog" ? (
          <section className="catalog-grid" aria-labelledby="catalog-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">CATALOG EXPLORER</p>
                <h2 id="catalog-title">The verified catalog</h2>
                <p className="catalog-caption">
                  Read-only records loaded from the same catalog used for
                  embedding retrieval.
                </p>
              </div>
              <span className="result-index">{catalog.length} RECORDS</span>
            </div>
            <label
              className="field-label catalog-filter-label"
              htmlFor="catalog-filter"
            >
              Filter catalog
            </label>
            <input
              id="catalog-filter"
              value={catalogFilter}
              onChange={(event) => setCatalogFilter(event.target.value)}
              placeholder="Search product IDs or titles"
            />
            <label className="field-label catalog-category-label" htmlFor="catalog-category">Category</label>
            <select id="catalog-category" value={catalogCategory} onChange={(event) => setCatalogCategory(event.target.value)}>
              <option value="all">All categories</option>
              {catalogCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            {catalogLoading ? (
              <p className="catalog-feedback" aria-live="polite">
                Loading catalog records…
              </p>
            ) : catalogError ? (
              <p className="catalog-feedback catalog-error" role="alert">
                {catalogError}
              </p>
            ) : filteredCatalog.length ? (
              <div className="catalog-cards">
                {filteredCatalog.map((item) => (
                  <article className="catalog-row" key={item.id}>
                    <div className="catalog-row-head"><span>{item.id}</span><strong>{item.title}</strong></div>
                    <small>{item.category}</small>
                    <p>{item.description}</p>
                    {item.tags && <div className="catalog-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="catalog-feedback" aria-live="polite">
                No catalog records match “{catalogFilter}”.
              </p>
            )}
          </section>
        ) : (
          <form className="search-card" onSubmit={submit}>
            <div className="card-heading">
              <div>
                <p className="eyebrow">01 / DISCOVER</p>
                <h2>
                  {mode === "compare"
                    ? "Compare two descriptions"
                    : "Describe what you need"}
                </h2>
              </div>
              <span className="model-chip">MINILM</span>
            </div>
            <label className="field-label" htmlFor="recommendation-query">
              {mode === "compare" ? "First query" : "Natural-language query"}
            </label>
            <input
              id="recommendation-query"
              value={query}
              maxLength={1000}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. a comfortable setup for long work sessions"
              aria-describedby="query-help"
            />
            {mode === "compare" && (
              <>
                <label
                  className="field-label compare-label"
                  htmlFor="second-query"
                >
                  Second query
                </label>
                <input
                  id="second-query"
                  value={secondQuery}
                  maxLength={1000}
                  onChange={(event) => setSecondQuery(event.target.value)}
                />
              </>
            )}
            <div className="field-meta">
              <span id="query-help">
                Search by meaning, not exact keywords.
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
              <span>
                {loading
                  ? "Encoding and ranking"
                  : mode === "compare"
                    ? "Compare results"
                    : "Find similar items"}
              </span>
              <span aria-hidden="true">{loading ? "…" : "→"}</span>
            </button>
            <div className="form-status" aria-live="polite">
              {loading && (
                <span className="loading-line">
                  <span className="spinner" /> Running real embedding inference…
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
        )}
      </section>
      {mode !== "catalog" &&
        ((mode === "compare" && session && comparison) ||
          (mode === "search" && session)) && (
          <section
            className={`results-card ${mode === "compare" ? "comparison-results" : ""}`}
            aria-live="polite"
          >
            <div className="section-heading">
              <div>
                <p className="eyebrow">02 / RESULTS</p>
                <h2>
                  {mode === "compare" ? "Query comparison" : "Closest matches"}
                </h2>
              </div>
              <div className="result-actions">
                {exportable.length > 0 && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      exportRows(exportable, "semantic-search-results.csv")
                    }
                  >
                    Download CSV
                  </button>
                )}
              </div>
            </div>
            {mode === "compare" && session && comparison ? (
              <div className="comparison-grid">
                <ResultList session={session} title={session.query} />
                <ResultList session={comparison} title={comparison.query} />
              </div>
            ) : (
              session && <ResultList session={session} />
            )}
          </section>
        )}
      {history.length > 0 && (
        <section className="history-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SESSION HISTORY</p>
              <h2>{history.length} recent searches</h2>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => exportRows(history, "semantic-search-history.csv")}
            >
              Export history
            </button>
          </div>
          <div className="search-history">
            {history.map((item) => (
              <button
                type="button"
                key={item.query}
                onClick={() => {
                  setQuery(item.query);
                  setMode("search");
                }}
              >
                <span>{item.query}</span>
                <strong>{item.items.length} matches</strong>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="model-note" aria-labelledby="model-note-title">
        <div className="note-icon" aria-hidden="true">
          ⌁
        </div>
        <div>
          <h2 id="model-note-title">How semantic discovery works</h2>
          <p>
            Queries and catalog titles are encoded with{" "}
            <strong>sentence-transformers/all-MiniLM-L6-v2</strong>. Normalized
            vectors are compared with cosine similarity. This demo contains only
            the verified 80 synthetic product records, no prices, ratings,
            inventory, or personalization signals.
          </p>
        </div>
      </section>
      <footer className="app-footer">
        <span>MiniLM · SentenceTransformers · Flask · Next.js</span>
        <span>Session-only workbench</span>
      </footer>
    </main>
  );
}
