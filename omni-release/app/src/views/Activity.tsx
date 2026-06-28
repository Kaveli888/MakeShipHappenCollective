import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import type { AuditLog, PublishAttempt } from "../types.js";
import { fmtTime, statusClass } from "../util.js";

export default function Activity() {
  const [tab, setTab] = useState<"attempts" | "audit">("attempts");
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [a, l] = await Promise.all([api.attemptsList(80), api.auditList(120)]);
      setAttempts(a);
      setAudit(l);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Activity</h2>
          <p className="sub">Every publish attempt and audit event is recorded here.</p>
        </div>
        <div className="seg">
          <button className={tab === "attempts" ? "on" : ""} onClick={() => setTab("attempts")}>
            Publish attempts ({attempts.length})
          </button>
          <button className={tab === "audit" ? "on" : ""} onClick={() => setTab("audit")}>
            Audit log ({audit.length})
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      {tab === "attempts" && (
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Mode</th>
              <th>#</th>
              <th>Outcome</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {attempts.length === 0 && (
              <tr>
                <td colSpan={5} className="sub">
                  No attempts yet — schedule or publish a target.
                </td>
              </tr>
            )}
            {attempts.map((a) => (
              <tr key={a.id}>
                <td>{fmtTime(a.started_at)}</td>
                <td>
                  <span className="chip">{a.mode}</span>
                </td>
                <td>{a.attempt_no}</td>
                <td>
                  <span className={`status ${statusClass(a.outcome ?? "")}`}>
                    {a.outcome ?? "running"}
                  </span>
                </td>
                <td className="result-cell">
                  {a.external_url ? (
                    <code>{a.external_url}</code>
                  ) : (
                    <span className="bad">{a.error_message ?? a.error_code ?? ""}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "audit" && (
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((l) => (
              <tr key={l.id}>
                <td>{fmtTime(l.created_at)}</td>
                <td>
                  <span className="chip">{l.actor}</span>
                </td>
                <td>{l.action}</td>
                <td className="sub">
                  {l.target_type ? `${l.target_type}:${l.target_id?.slice(0, 12)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
