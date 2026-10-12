import React, { useCallback, useEffect, useState } from "react";
import OpsModal from "../../../components/operations/OpsModal";
import OpsJobService from "../../../services/OpsJobService";
import { useToast } from "../../../context/ToastContext";
import { formatInstant } from "../../../utils/opsFormat";
import styles from "./Masters.module.css";

const KIND_LABEL = { REMINDER: "Reminder", DIGEST: "Morning summary", ESCALATION: "Escalation", ETA_CHANGE: "ETA change" };
const STATUS_CLASS = { SENT: styles.chipActive, SKIPPED: styles.chipNone, FAILED: styles.chipHigh };

const resultText = (r) => {
  if (!r) return "—";
  return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" · ");
};

// Ops Masters → Scheduled Jobs (admin; features F1–F6): job status, Run now, and every email produced
function ScheduledJobs() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [mails, setMails] = useState([]);
  const [kind, setKind] = useState("");
  const [running, setRunning] = useState("");
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const [jobs, list] = await Promise.all([OpsJobService.list(), OpsJobService.emails({ kind, limit: 100 })]);
      setData(jobs);
      setMails(list);
    } catch (e) { showToast(e.message, "error"); }
  }, [kind, showToast]);
  useEffect(() => { load(); }, [load]);

  const run = async (job) => {
    setRunning(job.name);
    try {
      const r = await OpsJobService.run(job.name);
      if (r.error) showToast(`${job.label}: failed — ${r.error}`, "error");
      else showToast(`${job.label}: done — ${resultText(r.result)}`, "success");
      await load();
    } catch (e) { showToast(e.message, "error"); } finally { setRunning(""); }
  };

  const open = async (m) => {
    try { setPreview(await OpsJobService.email(m._id)); } catch (e) { showToast(e.message, "error"); }
  };

  if (!data) return <div className={styles.empty}>Loading…</div>;
  const tz = data.officeTimeZone;
  const s = data.settings;
  return (
    <div>
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.cardTitle}>Scheduled jobs <span className={styles.subtle} style={{ fontWeight: 400 }}>· times in office time ({tz})</span></div>
          <button className={styles.btnSecondary} onClick={load}>Refresh</button>
        </div>
        {!data.schedulerEnabled && <div className={styles.readOnlyBanner}>The scheduler is switched off on this server (OPS_JOBS_DISABLED=1). Jobs run only with “Run now”.</div>}
        {!data.emailConfigured && (
          <div className={styles.readOnlyBanner}>Email is not configured (EMAIL_USER / EMAIL_PASS), so emails are recorded below as “Skipped” instead of being sent. Bell notifications work.</div>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Job</th><th>When</th><th>Last run</th><th>Result</th><th>Next run</th><th /></tr></thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.name} data-job={j.name}>
                  <td><b>{j.label}</b><div className={styles.note}><span className={styles.mono}>{j.name}</span> · {j.feature}</div></td>
                  <td style={{ whiteSpace: "nowrap" }}>{j.schedule}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {j.lastFinishedAt ? formatInstant(j.lastFinishedAt, tz, { withUtc: false }) : "never"}
                    {j.lastTrigger && <div className={styles.note}>{j.lastTrigger === "manual" ? "run by hand" : j.lastTrigger === "catch-up" ? "caught up after a restart" : "on schedule"}{j.lastDurationMs != null ? ` · ${j.lastDurationMs} ms` : ""}</div>}
                  </td>
                  <td>{j.lastError ? <span style={{ color: "#b42318" }}>Failed: {j.lastError}</span> : <span className={styles.subtle}>{resultText(j.lastResult)}</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{j.nextRunAt ? formatInstant(j.nextRunAt, tz, { withUtc: false }) : "—"}</td>
                  <td><button className={styles.btnSecondary} disabled={Boolean(running) || j.running} onClick={() => run(j)}>{running === j.name || j.running ? "Running…" : "Run now"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.hint} style={{ marginTop: 8 }}>
          Reminders from {s.reminderTime}: High — the day before, on the day and daily while overdue; Medium — on the day and daily while overdue; Low — on the day. Each person gets one email and one bell entry per run, listing all their tasks; a reminder is never sent twice.
          Escalation to {s.escalationRoles.join(", ")} (admins if nobody has those roles) when High tasks are more than {s.escalateHighDays} day overdue, others more than {s.escalateOtherDays} days, once per task.
          Schedules and last runs are kept in the database; a run missed while the server was down happens once after it restarts.
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={styles.toolbar}>
          <div className={styles.cardTitle}>Emails <span className={styles.subtle} style={{ fontWeight: 400 }}>· last 100, kept 60 days</span></div>
          <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Email kind">
            <option value="">All kinds</option>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div className={styles.tableWrap} style={{ maxHeight: 460, overflowY: "auto" }}>
          <table className={styles.table}>
            <thead><tr><th>When</th><th>Kind</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>
              {mails.length === 0 && <tr><td colSpan={5} className={styles.empty}>No emails yet</td></tr>}
              {mails.map((m) => (
                <tr key={m._id} className={styles.clickable} onClick={() => open(m)} data-mail={m.kind}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatInstant(m.at, tz, { withUtc: false })}</td>
                  <td>{KIND_LABEL[m.kind] || m.kind}</td>
                  <td>{m.toName ? <>{m.toName}<div className={styles.note}>{m.to}</div></> : m.to}</td>
                  <td>{m.subject}</td>
                  <td><span className={`${styles.chip} ${STATUS_CLASS[m.status]}`}>{m.status === "SKIPPED" ? "Skipped" : m.status === "SENT" ? "Sent" : "Failed"}</span>{m.error && <div className={styles.note}>{m.error}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <OpsModal isOpen={Boolean(preview)} title={preview ? preview.subject : ""} onClose={() => setPreview(null)} width={860}
        footer={<button className={styles.btnPrimary} onClick={() => setPreview(null)}>Close</button>}>
        {preview && <>
          <div className={styles.subtle} style={{ marginBottom: 8 }}>To {preview.toName ? `${preview.toName} <${preview.to}>` : preview.to} · {formatInstant(preview.at, tz, { withUtc: false })}</div>
          <iframe title="Email preview" srcDoc={preview.html} sandbox="" style={{ width: "100%", height: 520, border: "1px solid #eaecf0", borderRadius: 6 }} />
        </>}
      </OpsModal>
    </div>
  );
}

export default ScheduledJobs;
