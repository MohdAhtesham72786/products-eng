import { useEffect, useState } from "react";
import { api, date } from "../api";
import { Sources, Score, DemoBadge, Empty } from "../components/Primitives";
import type { Source, Snapshot } from "../../shared/contracts";
type Data = {
  company: any;
  snapshots: Snapshot[];
  sources: Source[];
  drafts: any[];
  totalSnapshots: number;
  page: number;
};
export default function Dossier({
  id,
  notify,
  back,
}: {
  id: string;
  notify: (s: string) => void;
  back: () => void;
}) {
  const [data, setData] = useState<Data | null>(null),
    [tab, setTab] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [comparison, setComparison] = useState<any>(null),
    [before, setBefore] = useState(""),
    [after, setAfter] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [channel, setChannel] = useState("email"),
    [page, setPage] = useState(1);
  async function load() {
    try {
      const result = await api<Data>(`/companies/${id}?page=${page}`);
      setData(result);
      if (!before && result.snapshots.length > 1)
        setBefore(result.snapshots[1].id);
      if (!after && result.snapshots.length) setAfter(result.snapshots[0].id);
      setDraft((d: any) => d || result.drafts[0] || null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [id, page]);
  const s = data?.snapshots[0];
  return (
    <>
      <button className="text-button back-button" onClick={back}>
        ← Company directory
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMPANY DOSSIER</p>
          <h1>{data?.company.name || "Loading company…"}</h1>
          <p>
            {data?.company.website}{" "}
            {s && <span>· Observed {date(s.createdAt)}</span>}
          </p>
        </div>
        <div className="button-row">
          {s?.demo && <DemoBadge />}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await api("/companies/" + id + "/research", "POST", {
                  mode: data?.company.mode || "demo",
                });
                notify("Research queued");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Queuing…" : "Research again"}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div
        className="tabs"
        role="tablist"
        aria-label="Company dossier sections"
      >
        {["Overview", "Evidence", "Changes", "Outreach"].map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {!s && (
        <Empty title="Research in progress">
          This dossier will appear when the durable research job completes. See
          Research activity for progress or errors.
        </Empty>
      )}
      {s && tab === "Overview" && (
        <>
          <section className="panel">
            <h2>Company intelligence</h2>
            <div className="facts-grid">
              {[
                "offering",
                "market",
                "location",
                "business_model",
                "headcount",
                "revenue",
              ].map((field) => {
                const r = s.resolutions.find((r) => r.field === field);
                return (
                  <div key={field}>
                    <span className="fact-label">
                      {field.replaceAll("_", " ")}
                    </span>
                    <strong>{r?.selected?.value || "Unknown"}</strong>
                    {r?.status === "unresolved_conflict" && (
                      <p className="notice">
                        Conflicting evidence — value withheld
                      </p>
                    )}
                    {r?.selected && (
                      <Sources
                        sources={data!.sources}
                        ids={r.selected.sourceIds}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <div className="dossier-columns">
            <section className="panel">
              <h2>Opportunity assessment</h2>
              <Score assessment={s.assessment} />
            </section>
            <div>
              <section className="panel">
                <h2>Who to approach</h2>
                <span className="badge">
                  {s.analysis.contact.kind === "persona"
                    ? "Suggested buyer persona"
                    : "Publicly evidenced person"}
                </span>
                <h3>{s.analysis.contact.name || s.analysis.contact.role}</h3>
                {s.analysis.contact.name && <p>{s.analysis.contact.role}</p>}
                <p>{s.analysis.contact.reason}</p>
                <Sources
                  sources={data!.sources}
                  ids={s.analysis.contact.sourceIds}
                />
                <p className="muted">
                  Public route: company website contact page. No email address
                  is guessed.
                </p>
              </section>
              <section className="panel">
                <h2>Why now</h2>
                {s.analysis.developments.map((d, i) => (
                  <div className="development" key={i}>
                    <span className="badge">{d.kind}</span>
                    <p>{d.text}</p>
                    <small>
                      Event date: {d.eventDate || "unknown"} · observed{" "}
                      {date(s.createdAt)}
                    </small>
                    <Sources sources={data!.sources} ids={d.sourceIds} />
                  </div>
                ))}
              </section>
            </div>
          </div>
          <section className="panel">
            <h2>Likely needs & approach</h2>
            {s.analysis.needs.map((n, i) => (
              <div key={i}>
                <p>{n.text}</p>
                <Sources sources={data!.sources} ids={n.sourceIds} />
              </div>
            ))}
            <blockquote>{s.analysis.approach}</blockquote>
            <h3>Uncertainty to keep in mind</h3>
            <ul>
              {s.analysis.uncertainties.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </section>
        </>
      )}
      {s && tab === "Evidence" && (
        <>
          <section className="panel">
            <h2>Source reliability</h2>
            <p>
              Direct primary evidence, corroboration, and freshness guide
              conflict resolution. Competing facts stay visible.
            </p>
            {s.resolutions.map((r) => (
              <div className="resolution" key={r.field}>
                <div className="row">
                  <h3>{r.field.replaceAll("_", " ")}</h3>
                  <span className="badge">{r.status.replaceAll("_", " ")}</span>
                </div>
                <p>{r.reason}</p>
                {r.alternatives.map((c, i) => (
                  <div key={i} className="claim">
                    <strong>{c.value}</strong>
                    <span> · {c.confidence}% confidence</span>
                    <blockquote>“{c.excerpt}”</blockquote>
                    <Sources sources={data!.sources} ids={c.sourceIds} />
                  </div>
                ))}
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Research sources</h2>
            {data!.sources.map((src) => (
              <article className="source-card" key={src.id}>
                <div className="row">
                  <a href={src.url} target="_blank" rel="noopener noreferrer">
                    {src.url} ↗
                  </a>
                  <span className="badge">
                    {src.type === "primary"
                      ? "Primary source"
                      : "Secondary source"}
                  </span>
                </div>
                <small>
                  Retrieved {date(src.retrievedAt)} · Published{" "}
                  {src.publishedAt ? date(src.publishedAt) : "unknown"}
                </small>
                {src.demo && (
                  <p>
                    <DemoBadge />
                  </p>
                )}
                <details>
                  <summary>Read extracted evidence</summary>
                  <p>{src.text}</p>
                </details>
              </article>
            ))}
          </section>
        </>
      )}
      {s && tab === "Changes" && (
        <section className="panel">
          <h2>Signals over time</h2>
          <p>
            Compare immutable research snapshots. First observations are not
            historical changes.
          </p>
          <div className="form-grid">
            <label>
              Before snapshot
              <select
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              >
                <option value="">Select older snapshot</option>
                {data!.snapshots.map((s) => (
                  <option value={s.id} key={s.id}>
                    {date(s.createdAt)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              After snapshot
              <select value={after} onChange={(e) => setAfter(e.target.value)}>
                <option value="">Select newer snapshot</option>
                {data!.snapshots.map((s) => (
                  <option value={s.id} key={s.id}>
                    {date(s.createdAt)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            disabled={!before || !after || before === after}
            onClick={async () => {
              try {
                setComparison(
                  await api(
                    `/companies/${id}/compare?before=${before}&after=${after}`,
                  ),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Compare snapshots
          </button>
          {data!.snapshots.length < 2 && (
            <Empty title="One snapshot is a starting point">
              Research again to compare changes. No historical trigger is
              inferred from a single observation.
            </Empty>
          )}
          {comparison && (
            <>
              <p className="notice">{comparison.note}</p>
              {comparison.triggers.length ? (
                comparison.triggers.map((t: any, i: number) => (
                  <article className="trigger-card" key={i}>
                    <span className="badge">
                      {t.kind} · {t.confidence}% confidence
                    </span>
                    <h3>{t.text}</h3>
                    <p>{t.significance}</p>
                    <div className="form-grid">
                      <div>
                        <h4>Before evidence</h4>
                        {t.beforeSourceIds.length ? (
                          <Sources
                            sources={data!.sources}
                            ids={t.beforeSourceIds}
                          />
                        ) : (
                          <p>
                            No matching development was observed in the earlier
                            snapshot.
                          </p>
                        )}
                      </div>
                      <div>
                        <h4>After evidence</h4>
                        <Sources
                          sources={data!.sources}
                          ids={t.afterSourceIds}
                        />
                      </div>
                    </div>
                    <p>
                      Event date {t.eventDate || "unknown"} · first observed{" "}
                      {date(t.observedAt)}
                    </p>
                    <blockquote>{t.suggestedAction}</blockquote>
                  </article>
                ))
              ) : (
                <Empty title="No meaningful new developments">
                  Unchanged semantic content and formatting noise do not create
                  action signals.
                </Empty>
              )}
            </>
          )}
          <div className="pagination">
            <button
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1);
                setBefore("");
                setAfter("");
                setComparison(null);
              }}
            >
              Newer snapshots
            </button>
            <span>
              {data!.totalSnapshots} snapshots · page {page}
            </span>
            <button
              disabled={page * 20 >= data!.totalSnapshots}
              onClick={() => {
                setPage(page + 1);
                setBefore("");
                setAfter("");
                setComparison(null);
              }}
            >
              Older snapshots
            </button>
          </div>
        </section>
      )}
      {s && tab === "Outreach" && (
        <section className="panel outreach-panel">
          <div className="section-heading">
            <div>
              <h2>A thoughtful first approach</h2>
              <p>
                Grounded in the company context. Review and edit before use.
              </p>
            </div>
            <div className="button-row">
              <label>
                Channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="email">Email</option>
                  <option value="network">Professional network</option>
                </select>
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setDraft(
                      await api("/companies/" + id + "/outreach", "POST", {
                        channel,
                      }),
                    );
                    notify("Draft generated");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Generating…" : "Generate draft"}
              </button>
            </div>
          </div>
          {draft ? (
            <>
              <label>
                Subject
                <input
                  value={draft.subject}
                  onChange={(e) =>
                    setDraft({ ...draft, subject: e.target.value })
                  }
                />
              </label>
              <label>
                Message
                <textarea
                  rows={10}
                  value={draft.message}
                  onChange={(e) =>
                    setDraft({ ...draft, message: e.target.value })
                  }
                />
              </label>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      await api("/drafts/" + draft.id, "PATCH", {
                        subject: draft.subject,
                        message: draft.message,
                      });
                      notify("Draft saved");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Save draft
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        draft.subject + "\n\n" + draft.message,
                      );
                      notify("Draft copied");
                    } catch {
                      setError(
                        "Clipboard unavailable. Select and copy the message manually.",
                      );
                    }
                  }}
                >
                  Copy draft
                </button>
              </div>
              <h3>Evidence used</h3>
              <Sources
                sources={data!.sources}
                ids={draft.sourceIds || draft.source_ids}
              />
              <ul className="muted">
                {draft.caveats?.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          ) : (
            <Empty title="Context before copy">
              Generate a draft using the current company research, buyer
              recommendation, and your seller profile.
            </Empty>
          )}
          {data!.drafts.length > 1 && (
            <label>
              Previous drafts
              <select
                onChange={(e) => {
                  const selected = data!.drafts.find(
                    (d) => d.id === e.target.value,
                  );
                  if (selected) setDraft(selected);
                }}
                value={draft?.id || ""}
              >
                <option value="">Choose a saved draft</option>
                {data!.drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {date(d.created_at)} · {d.channel}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
      )}
    </>
  );
}
