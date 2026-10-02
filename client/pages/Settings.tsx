import { useEffect, useState } from "react";
import { api } from "../api";
import type { SellerSettings } from "../../shared/contracts";
export const demoSeller: SellerSettings = {
  offering: "Operations workflow automation",
  industries: ["logistics", "software"],
  geography: ["India"],
  size: "10–500 employees",
  personas: ["Operations lead", "COO"],
  disqualifiers: ["Individual consumers"],
  style: "concise",
  actionLimit: 5,
};
export default function Settings({ notify }: { notify: (s: string) => void }) {
  const [value, setValue] = useState<SellerSettings | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/settings")
      .then(setValue)
      .catch((e) => setError(e.message));
  }, []);
  if (!value) return <p>{error || "Loading settings…"}</p>;
  function set<K extends keyof SellerSettings>(key: K, v: SellerSettings[K]) {
    setValue((x) => ({ ...x!, [key]: v }));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE RELEVANCE PERSONAL</p>
          <h1>Your seller profile</h1>
          <p>
            Tell SignalDesk what a worthwhile opportunity looks like for you.
          </p>
        </div>
      </div>
      <form
        className="panel settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/settings", "PUT", value);
            notify(
              "Settings saved. Research companies again to apply changed seller context.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>What you offer</h2>
        <label>
          Offering
          <textarea
            required
            value={value.offering}
            onChange={(e) => set("offering", e.target.value)}
            placeholder="Describe the business problem you solve"
            rows={3}
          />
        </label>
        <div className="form-grid">
          {(
            ["industries", "geography", "personas", "disqualifiers"] as const
          ).map((k) => (
            <label key={k}>
              {
                {
                  industries: "Target industries",
                  geography: "Target geography",
                  personas: "Buyer personas",
                  disqualifiers: "Disqualifiers",
                }[k]
              }
              <input
                value={value[k].join(", ")}
                onChange={(e) =>
                  set(
                    k,
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
              />
              <small>Separate values with commas.</small>
            </label>
          ))}
          <label>
            Target company size
            <input
              value={value.size}
              onChange={(e) => set("size", e.target.value)}
            />
          </label>
          <label>
            Outreach style
            <select
              value={value.style}
              onChange={(e) =>
                set("style", e.target.value as SellerSettings["style"])
              }
            >
              <option value="concise">Concise</option>
              <option value="warm">Warm</option>
              <option value="formal">Formal</option>
            </select>
          </label>
        </div>
        <hr />
        <h2>Daily focus policy</h2>
        <p>
          Qualifying actions must score at least 55 with 65% evidence
          confidence. Directory size is independent of this limit.
        </p>
        <label className="limit-field">
          Daily action limit
          <input
            type="number"
            min={1}
            max={20}
            value={value.actionLimit}
            onChange={(e) => set("actionLimit", Number(e.target.value))}
          />
        </label>
        <p className="notice">
          Seller fit 35% · demonstrated need 25% · timely trigger 25% ·
          approachability 15%. Changed seller context requires fresh research;
          existing dossiers retain the original assessment inputs.
        </p>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
    </>
  );
}
