import { useEffect, useState } from "react";
import { api, date } from "../api";
import { DemoBadge, Empty } from "../components/Primitives";
export default function Companies({
  open,
  notify,
  allowDemo,
  liveAvailable,
}: {
  open: (id: string) => void;
  notify: (s: string) => void;
  allowDemo: boolean;
  liveAvailable: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [input, setInput] = useState(""),
    [mode, setMode] = useState(allowDemo ? "demo" : "live"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setData(await api(`/companies?q=${encodeURIComponent(q)}&page=${page}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [q, page]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR RESEARCH UNIVERSE</p>
          <h1>Company directory</h1>
          <p>
            Research a single website or bring a batch of up to 20 companies.
          </p>
        </div>
        <span className="badge">{data?.total ?? 0} companies</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section className="panel import-panel">
        <div>
          <h2>Add companies</h2>
          <p>
            Paste one website per line. CSV files use a website, URL or domain
            first column.
          </p>
          <label>
            Company websites
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"https://company.com\nhttps://another-company.com"}
              rows={4}
            />
          </label>
          <label className="file-label">
            Import CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 10000) {
                    setError("CSV must be smaller than 10 KB.");
                    return;
                  }
                  setInput(await f.text());
                }
              }}
            />
          </label>
        </div>
        <div className="import-controls">
          <label>
            Research mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {allowDemo && <option value="demo">Fictional demo</option>}
              <option value="live">Live public research</option>
            </select>
          </label>
          <p className="notice">
            {mode === "demo"
              ? "All results in demo mode are fictional fixtures, including websites and signals."
              : "Live mode fetches public company pages and uses the configured AI provider."}
          </p>
          {mode === "live" && !liveAvailable && (
            <p className="error">
              Live AI key is not configured on the server.
            </p>
          )}
          <button
            className="primary"
            disabled={
              busy || !input.trim() || (mode === "live" && !liveAvailable)
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const r = await api("/companies/import", "POST", {
                  input,
                  mode,
                });
                setResult(r);
                notify(`${r.companies.length} companies queued`);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Queuing…" : "Research companies"}
          </button>
          {result && (
            <div role="status">
              <p>
                {result.companies.length} queued · {result.duplicates}{" "}
                duplicates skipped
              </p>
              {result.errors.map((x: any) => (
                <p className="error" key={x.row}>
                  Row {x.row}: {x.input} — {x.error}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>
      <div className="section-heading">
        <h2>All companies</h2>
        <label className="search-label">
          Search companies
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Name or website"
          />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Opportunity</th>
              <th>Confidence</th>
              <th>Research</th>
              <th>Last observed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.companies.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.name}</strong>
                  <small>{c.website.replace(/^https?:\/\//, "")}</small>
                  {c.demo && <DemoBadge />}
                </td>
                <td>
                  <strong>{c.assessment?.score ?? "—"}</strong>
                  {c.assessment?.provisional && <small>Provisional</small>}
                </td>
                <td>{c.assessment ? c.assessment.confidence + "%" : "—"}</td>
                <td>
                  <span className={"status " + c.job_status}>
                    {c.job_status || "Not researched"}
                  </span>
                </td>
                <td>{c.researched_at ? date(c.researched_at) : "—"}</td>
                <td>
                  <button onClick={() => open(c.id)}>Open dossier</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && !data.companies.length && (
        <Empty title="Your directory is ready for research">
          Add company websites above to create dossiers with sources and
          opportunity scores.
        </Empty>
      )}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button
          disabled={!data || page * 20 >= data.total}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}
