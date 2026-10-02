import { useState } from "react";
import { api } from "../api";
export default function Auth({ onLogin }: { onLogin: (user: any) => void }) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">S</span>SignalDesk
        </div>
        <div>
          <p className="eyebrow">LESS NOISE. BETTER CONVERSATIONS.</p>
          <h1>
            Know who.
            <br />
            Know why.
            <br />
            <em>Know when.</em>
          </h1>
          <p>
            A focused workspace for company intelligence and the opportunities
            worth your attention.
          </p>
        </div>
        <small>
          Evidence first. Thoughtful outreach. Five worthwhile moves.
        </small>
      </section>
      <section className="auth-form">
        <p className="eyebrow">YOUR OPPORTUNITY WORKSPACE</p>
        <h2>{register ? "Start with a clear signal." : "Welcome back."}</h2>
        <p className="muted">
          {register
            ? "Create your account and configure what you sell."
            : "Sign in to your company intelligence workspace."}
        </p>
        <div className="segmented">
          <button
            className={!register ? "active" : ""}
            onClick={() => {
              setRegister(false);
              setError("");
            }}
          >
            Sign in
          </button>
          <button
            className={register ? "active" : ""}
            onClick={() => {
              setRegister(true);
              setError("");
            }}
          >
            Create account
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              onLogin(
                await api(
                  "/auth/" + (register ? "register" : "login"),
                  "POST",
                  { email, password, name },
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={register ? "new-password" : "current-password"}
            />
            <small>At least 12 characters.</small>
          </label>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create workspace" : "Sign in"}
          </button>
        </form>
        <p className="fine-print">
          Your research and drafts stay in your workspace. Demo companies are
          clearly labeled fictional.
        </p>
      </section>
    </div>
  );
}
