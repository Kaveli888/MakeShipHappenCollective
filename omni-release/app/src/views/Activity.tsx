import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { AgentHealth, AgentQueueItem, AuditLog, PlatformId, PublishAttempt } from "../types.js";
import { PlatformLogo, platformLabel } from "../components/PlatformLogo.js";
import { fmtTime, statusClass } from "../util.js";

interface QueueGroup {
  key: string;
  postId: string | null;
  items: AgentQueueItem[];
  releasePlatforms: string[];
  releaseTargetCount: number;
  releaseDoneCount: number;
  releaseAttentionCount: number;
  releasePendingCount: number;
  scheduledFor: string | null;
  captionPreview: string | null;
  mediaCount: number;
}

function platformId(p: string): PlatformId {
  return p as PlatformId;
}

export default function Activity({ onOpenPost }: { onOpenPost: (id: string) => void }) {
  const [tab, setTab] = useState<"queue" | "attempts" | "audit">("queue");
  const [queue, setQueue] = useState<AgentQueueItem[]>([]);
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [attempts, setAttempts] = useState<PublishAttempt[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [openingTabs, setOpeningTabs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const queueGroups = useMemo<QueueGroup[]>(() => {
    const groups = new Map<string, QueueGroup>();
    for (const item of queue) {
      const key = item.post_id ?? item.job_id;
      const existing = groups.get(key);
      const releasePlatforms =
        item.release_platforms.length > 0 ? item.release_platforms : [item.platform];
      if (!existing) {
        groups.set(key, {
          key,
          postId: item.post_id,
          items: [item],
          releasePlatforms,
          releaseTargetCount: Math.max(item.release_target_count, releasePlatforms.length, 1),
          releaseDoneCount: item.release_done_count,
          releaseAttentionCount: item.release_attention_count,
          releasePendingCount: item.release_pending_count,
          scheduledFor: item.scheduled_for,
          captionPreview: item.caption_preview,
          mediaCount: item.media_count,
        });
        continue;
      }

      existing.items.push(item);
      existing.releasePlatforms = Array.from(
        new Set([...existing.releasePlatforms, ...releasePlatforms]),
      );
      existing.releaseTargetCount = Math.max(
        existing.releaseTargetCount,
        item.release_target_count,
        existing.releasePlatforms.length,
      );
      existing.releaseDoneCount = Math.max(existing.releaseDoneCount, item.release_done_count);
      existing.releaseAttentionCount = Math.max(
        existing.releaseAttentionCount,
        item.release_attention_count,
      );
      existing.releasePendingCount = Math.max(
        existing.releasePendingCount,
        item.release_pending_count,
      );
      existing.mediaCount = Math.max(existing.mediaCount, item.media_count);
      if (
        item.scheduled_for &&
        (!existing.scheduledFor || new Date(item.scheduled_for) < new Date(existing.scheduledFor))
      ) {
        existing.scheduledFor = item.scheduled_for;
      }
      if (!existing.captionPreview && item.caption_preview) existing.captionPreview = item.caption_preview;
    }

    return Array.from(groups.values()).sort((a, b) =>
      (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""),
    );
  }, [queue]);

  const refresh = useCallback(async () => {
    try {
      const [q, h, a, l] = await Promise.all([
        api.agentQueue(),
        api.agentHealth(),
        api.attemptsList(80),
        api.auditList(120),
      ]);
      setQueue(q);
      setHealth(h);
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

  async function syncResults() {
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const count = await api.ingestAgentResults();
      setNotice(
        count === 0
          ? "No new agent results."
          : `Synced ${count} agent result${count === 1 ? "" : "s"}.`,
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  }

  async function openOutbox() {
    try {
      await api.openPath("outbox");
    } catch (e) {
      setError(String(e));
    }
  }

  // Delete one handoff card: archives its outbox card so the agent can't post
  // it, clears its calendar entry, and unchecks that platform on the release.
  async function deleteHandoff(q: AgentQueueItem) {
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await api.agentHandoffDelete(q.job_id);
      setNotice(
        `Deleted the ${platformLabel(platformId(q.platform))} handoff — unscheduled and unchecked on the release card.`,
      );
      setConfirmDelete(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function openHandoffs(items: AgentQueueItem[]) {
    setOpeningTabs(true);
    setError(null);
    setNotice(null);
    try {
      let opened = 0;
      for (const item of items) {
        if (item.platform_url) {
          await api.openChromeUrl(item.platform_url);
          opened += 1;
        }
        await api.openPath(`outbox/due/${item.job_id}`).catch(() => {});
      }
      setNotice(
        opened === 0
          ? "No platform tabs to open."
          : `Opened ${opened} handoff${opened === 1 ? "" : "s"} in Chrome.`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setOpeningTabs(false);
    }
  }

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h2>Agent Queue</h2>
          <p className="sub">Active browser handoffs, publish attempts, and audit events.</p>
        </div>
        <div className="seg activity-tabs">
          <button className={tab === "queue" ? "on" : ""} onClick={() => setTab("queue")}>
            Active handoffs ({queue.length})
          </button>
          <button className={tab === "attempts" ? "on" : ""} onClick={() => setTab("attempts")}>
            Publish attempts ({attempts.length})
          </button>
          <button className={tab === "audit" ? "on" : ""} onClick={() => setTab("audit")}>
            Audit log ({audit.length})
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}
      {health?.warning && (
        <div className="banner warn">
          <strong>Browser agent offline.</strong>{" "}
          {health.warning} {health.stale_count > 0 ? `${health.stale_count} handoff${health.stale_count === 1 ? "" : "s"} crossed the stale threshold.` : ""}
        </div>
      )}
      {health?.runner_online && (
        <div className="banner info">
          Browser agent is online{health.mode ? ` in ${health.mode} mode` : ""}.
          {health.current_platform ? ` Working on ${platformLabel(platformId(health.current_platform))}.` : ""}
          {health.message ? ` ${health.message}.` : ""}
        </div>
      )}

      {tab === "queue" && (
        <>
          <div className="queue-actions">
            <button className="ghost sm" disabled={openingTabs || queue.length === 0} onClick={() => openHandoffs(queue)}>
              {openingTabs ? "Opening…" : "Open due tabs"}
            </button>
            <button className="ghost sm" disabled={syncing} onClick={syncResults}>
              {syncing ? "Syncing…" : "Sync agent results"}
            </button>
            <button className="ghost sm" onClick={openOutbox}>
              Open outbox
            </button>
          </div>
          <div className="release-queue">
            {queue.length === 0 ? (
              <div className="empty-state">
                <strong>No active handoffs.</strong>
                <p className="sub">
                  Scheduled release cards appear here after Omni Release hands them to the browser agent.
                </p>
              </div>
            ) : (
              queueGroups.map((group) => (
                <section className="release-group" key={group.key}>
                  <div className="release-group-head">
                    <div>
                      <span className="release-kicker">Release Card</span>
                      <strong>{group.captionPreview ?? group.postId ?? group.key}</strong>
                      <div className="agent-meta">
                        <span>Due {fmtTime(group.scheduledFor)}</span>
                        <span>{group.mediaCount} media</span>
                        <span>{group.items.length} active handoff{group.items.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="release-counts">
                      <span><b>{group.releaseDoneCount}</b> posted</span>
                      <span><b>{group.items.length}</b> active</span>
                      <span><b>{group.releaseAttentionCount}</b> needs human</span>
                      <span><b>{Math.max(group.releasePendingCount - group.items.length, 0)}</b> waiting</span>
                    </div>
                  </div>

                  <div className="release-platform-row">
                    {group.releasePlatforms.map((p) => (
                      <span className="release-platform-pill" key={p}>
                        <PlatformLogo platform={platformId(p)} size={16} />
                        {platformLabel(platformId(p))}
                      </span>
                    ))}
                  </div>

                  <div className="agent-queue release-agent-grid">
                    {group.items.map((q) => (
                      <div className={`agent-card${q.needs_attention ? " attention" : ""}`} key={q.job_id}>
                        <div className="agent-card-head">
                          <div className="target-name">
                            <PlatformLogo platform={platformId(q.platform)} size={20} />
                            <strong>{platformLabel(platformId(q.platform))}</strong>
                          </div>
                          <span className={`status ${q.needs_attention ? "warn" : "busy"}`}>
                            {q.needs_attention ? "needs human" : "awaiting agent"}
                          </span>
                        </div>
                        <div className="agent-meta">
                          <span>Due {fmtTime(q.scheduled_for)}</span>
                          <span>{q.media_count} media</span>
                          <span>
                            Delivery {q.delivery_index ?? group.items.indexOf(q) + 1}/
                            {q.release_target_count || group.releaseTargetCount}
                          </span>
                          <span>{q.timezone ?? "local time"}</span>
                          {q.post_type && <span>{q.post_type.replace(/_/g, " ")}</span>}
                          {q.publish_surface && <span>{q.publish_surface.replace(/_/g, " ")}</span>}
                        </div>
                        {q.title && <div className="agent-title">{q.title}</div>}
                        {q.agent_brief && <p className="agent-caption">{q.agent_brief}</p>}
                        {q.caption_preview && <p className="agent-caption">{q.caption_preview}</p>}
                        {q.needs_attention && (
                          <div className="agent-attention">
                            <strong>{q.attention_code ?? "needs_attention"}</strong>
                            <span>{q.attention_message ?? "Clear the browser gate, then the agent can retry."}</span>
                          </div>
                        )}
                        <div className="agent-actions">
                          {q.platform_url && (
                            <button className="ghost sm" disabled={openingTabs} onClick={() => openHandoffs([q])}>
                              Open handoff
                            </button>
                          )}
                          {q.post_id && (
                            <button className="ghost sm" onClick={() => onOpenPost(q.post_id!)}>
                              Open card
                            </button>
                          )}
                          <button className="ghost sm" onClick={openOutbox}>
                            Open outbox
                          </button>
                          {confirmDelete !== q.job_id && (
                            <button
                              className="ghost sm danger"
                              disabled={deleting}
                              onClick={() => setConfirmDelete(q.job_id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        {confirmDelete === q.job_id && (
                          <div className="cal-confirm">
                            <span>
                              Delete this handoff? {platformLabel(platformId(q.platform))} will be
                              unscheduled and unchecked on the release card.
                            </span>
                            <button
                              className="cal-confirm-yes"
                              disabled={deleting}
                              onClick={() => deleteHandoff(q)}
                            >
                              {deleting ? "Deleting…" : "Delete"}
                            </button>
                            <button
                              className="cal-confirm-no"
                              disabled={deleting}
                              onClick={() => setConfirmDelete(null)}
                            >
                              Keep
                            </button>
                          </div>
                        )}
                        <code className="agent-id">{q.job_id}</code>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      )}

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
