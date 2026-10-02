import { useEffect, useState } from "react";
import { api, date } from "../api";
import { Empty } from "../components/Primitives";
export default function Jobs() {
  const [data, setData] = useState<any[]>([]),
    [error, setError] = useState(""),
    [page, setPage] = useState(1),
    [attempts, setAttempts] = useState<any>(null);
  async function load() {
    try {
      setData((await api("/jobs?page=" + page)).jobs);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [page]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">INPUT → RESEARCH → ANALYSIS → DATABASE</p>
          <h1>Research activity</h1>
          <p>Durable jobs keep working when you leave the page.</p>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Attempts</th>
              <th>Updated</th>
              <th>Controls</th>
            </tr>
          </thead>
          <tbody>
            {data.map((j) => (
              <tr key={j.id}>
                <td>
                  <strong>{j.name}</strong>
                  {j.error_code && (
                    <small className="error">
                      {j.error_code.replaceAll("_", " ")}
                    </small>
                  )}
                </td>
                <td>
                  <span className={"status " + j.status}>{j.status}</span>
                </td>
                <td>{j.mode === "demo" ? "Fictional demo" : "Live"}</td>
                <td>
                  {j.attempts}/{j.max_attempts}
                </td>
                <td>{date(j.updated_at)}</td>
                <td>
                  <div className="button-row">
                    <button
                      onClick={async () => {
                        try {
                          setAttempts(await api("/jobs/" + j.id));
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Details
                    </button>
                    {["failed", "cancelled"].includes(j.status) && (
                      <button
                        onClick={async () => {
                          try {
                            await api("/jobs/" + j.id + "/retry", "POST");
                            load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Retry
                      </button>
                    )}
                    {["queued", "running"].includes(j.status) && (
                      <button
                        onClick={async () => {
                          try {
                            await api("/jobs/" + j.id + "/cancel", "POST");
                            load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.length && (
        <Empty title="No research jobs yet">
          Add a company to start the automated workflow.
        </Empty>
      )}
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button disabled={data.length < 50} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
      {attempts && (
        <section className="panel">
          <div className="row">
            <h2>Attempt history</h2>
            <button onClick={() => setAttempts(null)}>Close details</button>
          </div>
          {attempts.attemptHistory.map((a: any) => (
            <p key={a.attempt}>
              Attempt {a.attempt}: {a.status}{" "}
              {a.error_code && "— " + a.error_code} · {date(a.started_at)}
            </p>
          ))}
          {attempts.usage && (
            <p>
              AI usage: {attempts.usage.inputTokens} input /{" "}
              {attempts.usage.outputTokens} output tokens
            </p>
          )}
        </section>
      )}
    </>
  );
}
