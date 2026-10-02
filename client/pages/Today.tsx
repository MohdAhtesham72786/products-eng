import { useEffect, useState } from "react";
import { api, date } from "../api";
import { Empty, DemoBadge } from "../components/Primitives";
export default function Today({
  open,
  notify,
  onDemo,
  allowDemo,
}: {
  open: (id: string) => void;
  notify: (s: string) => void;
  onDemo: () => Promise<void>;
  allowDemo: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<any[]>([]),
    [showHistory, setShowHistory] = useState(false),
    [snooze, setSnooze] = useState<string | null>(null),
    [until, setUntil] = useState("");
  async function load() {
    try {
      setData(await api("/actions/today"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  async function change(id: string, status: string, snoozeUntil?: string) {
    try {
      await api("/actions/" + id, "PATCH", { status, snoozeUntil });
      setSnooze(null);
      await load();
      notify("Action updated");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TODAY'S SHORTLIST</p>
          <h1>Your next best moves</h1>
          <p>Companies worth a thoughtful conversation, backed by evidence.</p>
        </div>
        {allowDemo && (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDemo();
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Loading demo…" : "Load fictional demo"}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="metrics">
        <div>
          <span>Daily focus</span>
          <strong>
            {data?.actions.length ?? "—"}
            <small> / {data?.limit ?? 5}</small>
          </strong>
        </div>
        <div>
          <span>Evidence threshold</span>
          <strong>
            65<small>% confidence</small>
          </strong>
        </div>
        <div>
          <span>Scoring policy</span>
          <strong>
            v1<small> · four factors</small>
          </strong>
        </div>
        <div>
          <span>Last refreshed</span>
          <strong className="metric-time">
            {data
              ? new Date(data.refreshedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </strong>
        </div>
      </div>
      <div className="section-heading">
        <h2>Worth acting on</h2>
        <button className="text-button" onClick={load}>
          Refresh ↻
        </button>
      </div>
      <p className="muted policy-note">
        {data?.explanation || "Loading recommendations…"} Score → meaningful
        changes → recency → confidence.
      </p>
      <div className="action-grid">
        {data?.actions.map((a: any, i: number) => (
          <article className="action-card" key={a.id}>
            <div className="row">
              <span className="rank">0{i + 1}</span>
              {a.demo && <DemoBadge />}
              <span className="score-chip">
                {a.score}
                <small>/100</small>
              </span>
            </div>
            <h3>{a.name}</h3>
            <p className="domain">{a.website.replace(/^https?:\/\//, "")}</p>
            <div className="signal">
              <span className="signal-dot" />
              <strong>
                {a.analysis.developments[0]?.kind || "Opportunity"} signal
              </strong>
            </div>
            <p>{a.reason}</p>
            <div className="action-context">
              <span>{a.confidence}% evidence confidence</span>
              <span>
                {a.analysis.contact.kind === "persona"
                  ? "Suggested buyer: "
                  : "Contact: "}
                {a.analysis.contact.name || a.analysis.contact.role}
              </span>
              <small>
                Observed {date(a.observedAt)} · event date{" "}
                {a.analysis.developments[0]?.eventDate || "unknown"}
              </small>
            </div>
            <button className="primary full" onClick={() => open(a.companyId)}>
              Open dossier
            </button>
            <div className="action-controls">
              <button onClick={() => change(a.id, "done")}>Done</button>
              <button
                onClick={() => {
                  setSnooze(a.id);
                  const d = new Date(Date.now() + 86400000);
                  setUntil(d.toISOString().slice(0, 16));
                }}
              >
                Snooze
              </button>
              <button onClick={() => change(a.id, "dismissed")}>Dismiss</button>
            </div>
          </article>
        ))}
      </div>
      {data && !data.actions.length && (
        <Empty title="A useful shortlist starts with context">
          Configure your seller profile, then research a company or load the
          fictional demo. Only supported opportunities will appear here.
        </Empty>
      )}
      <div className="section-heading history-heading">
        <h2>Action history</h2>
        <button
          className="text-button"
          onClick={async () => {
            setShowHistory(!showHistory);
            if (!showHistory)
              setHistory((await api("/actions/history")).actions);
          }}
        >
          {" "}
          {showHistory ? "Hide history" : "View history"}
        </button>
      </div>
      {showHistory && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Action</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Restore</th>
              </tr>
            </thead>
            <tbody>
              {history.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.title}</td>
                  <td>{a.status}</td>
                  <td>{date(a.updated_at)}</td>
                  <td>
                    <button onClick={() => change(a.id, "open")}>Reopen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {snooze && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="snooze-title"
            className="modal"
          >
            <h2 id="snooze-title">Return to this opportunity later</h2>
            <label>
              Snooze until (UTC)
              <input
                type="datetime-local"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button onClick={() => setSnooze(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() =>
                  change(snooze, "snoozed", new Date(until + "Z").toISOString())
                }
              >
                Save snooze
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
