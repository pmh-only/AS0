import { useState } from "react";

import "./LookingGlass.css";

const queryTypes = {
  route: {
    label: "BGP route",
    placeholder: "2a06:9801:ff0::/44",
    hint: "IPv6 address or prefix",
  },
  ping: {
    label: "Ping",
    placeholder: "2606:4700:4700::1111",
    hint: "IPv6 address",
  },
  traceroute: {
    label: "Traceroute",
    placeholder: "2606:4700:4700::1111",
    hint: "IPv6 address",
  },
};

export default function LookingGlass({ apiUrl }) {
  const [type, setType] = useState("route");
  const [target, setTarget] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const selected = queryTypes[type];

  async function submit(event) {
    event.preventDefault();
    if (!target.trim() || loading) return;

    setLoading(true);
    setResult(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, target: target.trim() }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      setResult(data);
    } catch (error) {
      setResult({
        error:
          error instanceof DOMException && error.name === "AbortError"
            ? "The query timed out."
            : error instanceof Error
              ? error.message
              : "The query failed.",
      });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  return (
    <section className="console" aria-labelledby="console-title">
      <div className="console-heading">
        <div>
          <span className="eyebrow">PUBLIC TOOL / 01</span>
          <h2 id="console-title">Looking glass</h2>
        </div>
        <div className="location"><i /> CORE / ASIA PACIFIC</div>
      </div>

      <form onSubmit={submit}>
        <fieldset>
          <legend>Query type</legend>
          <div className="query-types">
            {Object.entries(queryTypes).map(([value, query]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="query-type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                />
                <span>{query.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="target-label" htmlFor="target">Target</label>
        <div className="target-row">
          <span aria-hidden="true">$</span>
          <input
            id="target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder={selected.placeholder}
            aria-describedby="target-hint"
            autoComplete="off"
            spellCheck="false"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Running" : "Run query"}
            <b aria-hidden="true">{">"}</b>
          </button>
        </div>
        <p id="target-hint" className="target-hint">{selected.hint}</p>
      </form>

      <div className={`output${result ? " has-result" : ""}`} aria-live="polite">
        <div className="output-bar">
          <span>OUTPUT</span>
          {result && !result.error && (
            <span>{result.location} / {result.elapsedMs} MS / EXIT {result.exitCode}</span>
          )}
        </div>
        {loading ? (
          <div className="loading-lines" aria-label="Query in progress"><i /><i /><i /></div>
        ) : result ? (
          <pre className={result.error ? "error" : ""}>{result.error || result.output}</pre>
        ) : (
          <div className="empty-output">
            <span>Awaiting query</span>
            <small>Results are generated live from the AS218822 core router.</small>
          </div>
        )}
      </div>
    </section>
  );
}
