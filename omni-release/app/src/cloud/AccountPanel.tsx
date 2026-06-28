import { useEffect, useState } from "react";
import {
  cloudConfigured,
  getUser,
  onAuthChange,
  signIn,
  signOut,
  signUp,
  type CloudUser,
} from "./cloud.js";

export default function AccountPanel() {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!cloudConfigured) return;
    getUser().then(setUser).catch(() => {});
    return onAuthChange(setUser);
  }, []);

  if (!cloudConfigured) {
    return (
      <div className="account">
        <span className="pill">cloud off</span>
        <p className="sub">Set VITE_SUPABASE_URL + ANON_KEY in app/.env to enable accounts & publishing.</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="account">
        <span className="pill ok-pill" title={user.email ?? "signed in"}>
          <span className="ok-dot" aria-hidden="true" />
          <span className="ok-email">{user.email ?? "signed in"}</span>
        </span>
        <button className="ghost sm" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  async function submit(mode: "in" | "up") {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "in") await signIn(email, password);
      else {
        await signUp(email, password);
        setInfo("Check your email to confirm, then sign in.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account">
      <strong className="acct-title">Sign in</strong>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="acct-actions">
        <button className="primary sm" disabled={busy} onClick={() => submit("in")}>
          Sign in
        </button>
        <button className="ghost sm" disabled={busy} onClick={() => submit("up")}>
          Sign up
        </button>
      </div>
      {error && <p className="sub bad">{error}</p>}
      {info && <p className="sub">{info}</p>}
    </div>
  );
}
