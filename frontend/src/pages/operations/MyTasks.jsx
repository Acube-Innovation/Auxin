import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import OpsLayout from "../../components/operations/OpsLayout";
import TaskDrawer from "../../components/operations/TaskDrawer";
import EtaChangeModal from "../../components/operations/EtaChangeModal";
import useTaskActions from "../../components/operations/useTaskActions";
import { BucketChip, PriorityTag } from "../../components/operations/OperationsView";
import OpsTaskService, { TASK_STATUS_LABEL } from "../../services/OpsTaskService";
import OpsMasterService from "../../services/OpsMasterService";
import EmployeeService from "../../services/EmployeeService";
import { useToast } from "../../context/ToastContext";
import { BUCKETS, formatLocalDate, VESSEL_STATUS_LABEL } from "../../utils/opsFormat";
import styles from "./masters/Masters.module.css";
import ov from "../../components/operations/OperationsView.module.css";

const OPEN_STATUSES = ["NOT_STARTED", "INITIATED", "AWAITING"];

// My Tasks — /operations/my-tasks: open tasks assigned to me on all active voyages, earliest due first (G1)
function MyTasks() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [bucket, setBucket] = useState("");
  const [voyage, setVoyage] = useState("");
  const [priority, setPriority] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [officeTz, setOfficeTz] = useState("Asia/Kolkata");
  const [moved, setMoved] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await OpsTaskService.mine({ priority }));
      setError("");
    } catch (e) { setError(e.message); }
  }, [priority]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    EmployeeService.getEmployees().then((l) => setEmployees(Array.isArray(l) ? l : [])).catch(() => {});
    OpsMasterService.getMeta().then((m) => setOfficeTz(m.officeTimeZone)).catch(() => {});
  }, []);

  const changed = async (res) => {
    await load();
    if (res && res.movedTasks && res.movedTasks.length) setMoved({ ...res, title: "Due dates moved" });
  };
  const { setStatus, dialogs } = useTaskActions(changed);

  const voyages = useMemo(() => {
    const m = new Map();
    for (const t of data?.tasks || []) m.set(t.voyage._id, t.voyage);
    return [...m.values()].sort((a, b) => a.voyageNo.localeCompare(b.voyageNo));
  }, [data]);
  const inVoyage = useMemo(() => (data?.tasks || []).filter((t) => !voyage || t.voyage._id === voyage), [data, voyage]);
  const counts = useMemo(() => {
    const c = {};
    for (const t of inVoyage) c[t.bucket] = (c[t.bucket] || 0) + 1;
    return c;
  }, [inVoyage]);
  const rows = inVoyage.filter((t) => !bucket || t.bucket === bucket);

  return (
    <OpsLayout title="My Tasks" breadcrumbs={[{ label: "Vessel Operations" }, { label: "My Tasks" }]}>
      <div className={styles.page}>
        <div className={styles.card}>
          {error && <div className={styles.formError}>{error}</div>}
          {data?.notLinked && (
            <div className={styles.readOnlyBanner}>
              Your login is not linked to an employee, so no tasks can be assigned to you. Ask an admin to link it in User Management.
            </div>
          )}
          {!data && !error && <div className={styles.empty}>Loading…</div>}
          {data && !data.notLinked && (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                <button className={styles.btnLink} style={{ fontWeight: bucket ? 400 : 700 }} onClick={() => setBucket("")}>All open ({inVoyage.length})</button>
                {BUCKETS.filter((b) => b.key !== "CLOSED").map((b) => (
                  <button key={b.key} onClick={() => setBucket(bucket === b.key ? "" : b.key)} className={styles.chip}
                    style={{ cursor: "pointer", background: b.bg, color: b.color, border: bucket === b.key ? `2px solid ${b.color}` : b.border ? `1px dashed ${b.border}` : "1px solid transparent" }}>
                    {b.label} {counts[b.key] || 0}
                  </button>
                ))}
                <span className={styles.subtle}>Today (office time): {formatLocalDate(data.today)}</span>
              </div>
              <div className={ov.filters}>
                <select className={styles.select} value={voyage} onChange={(e) => setVoyage(e.target.value)} aria-label="Voyage filter">
                  <option value="">All my voyages ({voyages.length})</option>
                  {voyages.map((v) => <option key={v._id} value={v._id}>{v.voyageNo} — {v.vessel?.name}</option>)}
                </select>
                <select className={styles.select} value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority filter">
                  <option value="">Any priority</option>
                  {["HIGH", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Due</th><th>Task</th><th>Voyage</th><th>Status</th><th>When</th><th className={ov.hideSm}>Priority</th><th /></tr></thead>
                  <tbody>
                    {rows.length === 0 && <tr><td colSpan={7} className={styles.empty}>Nothing here — well done.</td></tr>}
                    {rows.map((t) => (
                      <tr key={t._id} data-task={t.code || t.baseName}>
                        <td style={{ whiteSpace: "nowrap" }}>{t.dueDate ? formatLocalDate(t.dueDate) : <span className={styles.subtle}>—</span>}</td>
                        <td>
                          <button className={ov.taskName} onClick={() => setOpenTask(t._id)}>{t.baseName || t.name}</button>
                          {t.linkedField && <span className={styles.defaulted}>records time</span>}
                          <div className={styles.note}>{[t.code, t.stage?.name, t.portCall?.port?.name].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <Link to={`/operations/voyages/${t.voyage._id}?tab=tasks`}>{t.voyage.voyageNo}</Link>
                          <div className={styles.note}>{t.voyage.vessel?.name} · {VESSEL_STATUS_LABEL[t.voyage.vesselStatusOverride?.value || t.voyage.vesselStatus] || ""}</div>
                        </td>
                        <td>
                          <select className={ov.rowSelect} value={t.status} onChange={(e) => setStatus(t, e.target.value)} aria-label={`Status of ${t.baseName || t.name}`}>
                            {[...OPEN_STATUSES, "DONE", "NA"].map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                          </select>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <BucketChip bucket={t.bucket} />
                          {t.overdueDays > 0 && <div className={styles.note}>{t.overdueDays} day(s) overdue</div>}
                          {t.dueInDays != null && <div className={styles.note}>due in {t.dueInDays} day(s)</div>}
                        </td>
                        <td className={ov.hideSm}><PriorityTag value={t.priority} /></td>
                        <td><button className={ov.doneBtn} onClick={() => setStatus(t, "DONE")} aria-label={`Mark ${t.baseName || t.name} done`}>✓ Done</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.hint} style={{ marginTop: 8 }}>Open tasks of active voyages assigned to you. Done and N/A tasks leave this list; find them in the voyage’s Operations View.</div>
            </>
          )}
        </div>
      </div>
      {openTask && <TaskDrawer taskId={openTask} employees={employees} officeTz={officeTz} onClose={() => setOpenTask(null)}
        onChanged={async (res) => { await changed(res); if (res) showToast("Updated", "success"); }} />}
      <EtaChangeModal result={moved} onClose={() => setMoved(null)} />
      {dialogs}
    </OpsLayout>
  );
}

export default MyTasks;
