import { useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./pages/Auth";
import Today from "./pages/Today";
import Companies from "./pages/Companies";
import Dossier from "./pages/Dossier";
import Settings, { demoSeller } from "./pages/Settings";
import Jobs from "./pages/Jobs";
const demoWebsites = [
  "atlas-freight",
  "northstar-retail",
  "meridian-health",
  "orbit-manufacturing",
  "cedar-finance",
  "harbor-logistics",
  "lumen-energy",
  "summit-software",
  "evergreen-foods",
  "prism-education",
  "vertex-mobility",
  "apex-industrial",
]
  .map((d) => d + ".example")
  .join("\n");
export default function App() {
  const [user, setUser] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState(() =>
      location.hash.startsWith("#company/")
        ? "Dossier"
        : location.hash.slice(1) || "Today",
    ),
    [companyId, setCompanyId] = useState(() =>
      location.hash.startsWith("#company/") ? location.hash.slice(9) : "",
    ),
    [toast, setToast] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(v: string, id?: string) {
    setView(v);
    if (id) setCompanyId(id);
    location.hash = id ? "company/" + id : v;
    window.scrollTo(0, 0);
  }
  useEffect(() => {
    const fn = () => {
      const hash = location.hash.slice(1);
      if (hash.startsWith("company/")) {
        setView("Dossier");
        setCompanyId(hash.slice(8));
      } else setView(hash || "Today");
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  if (loading)
    return <div className="boot">SignalDesk · Loading workspace…</div>;
  if (!user)
    return <Auth onLogin={async () => setUser(await api("/auth/me"))} />;
  const open = (id: string) => navigate("Dossier", id);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>SignalDesk
        </div>
        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[
            ["Today", "◈"],
            ["Companies", "▤"],
            ["Research", "◎"],
            ["Settings", "⚙"],
          ].map(([v, icon]) => (
            <button
              className={
                view === v || (v === "Companies" && view === "Dossier")
                  ? "active"
                  : ""
              }
              key={v}
              onClick={() => navigate(v)}
            >
              <span aria-hidden="true">{icon}</span>
              {v}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="signal-dot" />
          <strong>Evidence, then action.</strong>
          <p>Prioritize what matters. Keep the uncertainty visible.</p>
        </div>
        <div className="account">
          <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>Your workspace</small>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await api("/auth/logout", "POST");
              setUser(null);
              navigate("Today");
            }}
          >
            ↗
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Intelligence /{" "}
            <strong>{view === "Dossier" ? "Company dossier" : view}</strong>
          </span>
          <span className="topbar-label">FOCUS ON THE NEXT RIGHT MOVE</span>
          <button
            className="mobile-signout"
            onClick={async () => {
              await api("/auth/logout", "POST");
              setUser(null);
              navigate("Today");
            }}
          >
            Sign out
          </button>
        </header>
        <main>
          {view === "Today" ? (
            <Today
              open={open}
              notify={setToast}
              allowDemo={user.allowDemo}
              onDemo={async () => {
                const settings = await api("/settings");
                if (!settings.offering.trim())
                  await api("/settings", "PUT", demoSeller);
                await api("/companies/import", "POST", {
                  input: demoWebsites,
                  mode: "demo",
                });
                setToast("Demo companies queued");
              }}
            />
          ) : view === "Companies" ? (
            <Companies
              open={open}
              notify={setToast}
              allowDemo={user.allowDemo}
              liveAvailable={user.liveAvailable}
            />
          ) : view === "Dossier" ? (
            <Dossier
              key={companyId}
              id={companyId}
              notify={setToast}
              back={() => navigate("Companies")}
            />
          ) : view === "Research" ? (
            <Jobs />
          ) : (
            <Settings notify={setToast} />
          )}
        </main>
        <footer>
          SignalDesk · Recommendations are grounded in observed public evidence.
          Review before acting.
        </footer>
      </div>
      {toast && (
        <div role="status" className="toast">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
