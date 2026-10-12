import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OpsLayout from "../../components/operations/OpsLayout";
import TaskDrawer from "../../components/operations/TaskDrawer";
import EtaChangeModal from "../../components/operations/EtaChangeModal";
import useTaskActions from "../../components/operations/useTaskActions";
import { PriorityTag } from "../../components/operations/OperationsView";
import OpsReportService from "../../services/OpsReportService";
import EmployeeService from "../../services/EmployeeService";
import { TASK_STATUS_LABEL } from "../../services/OpsTaskService";
import { OPS_EDITOR_ROLES, hasRole } from "../../config/opsRoles";
import { useToast } from "../../context/ToastContext";
import { PORT_TYPE_LABEL, VESSEL_STATUS_LABEL, formatInstant, formatLocalDate } from "../../utils/opsFormat";
import styles from "./masters/Masters.module.css";
import ov from "../../components/operations/OperationsView.module.css";
import db from "./OpsDashboard.module.css";

const REFRESH_MS = 60000;

function VoyageCard({ v, onOpen }) {
  const place = v.currentPort
    ? <>In port: <b>{v.currentPort.port}</b> <span className={styles.subtle}>({PORT_TYPE_LABEL[v.currentPort.type]})</span>{v.currentPort.ets && <div className={styles.note}>ETS {formatInstant(v.currentPort.ets, v.currentPort.timeZone)}</div>}</>
    : null;
  const next = v.nextPort
    ? <>{v.currentPort ? "Then" : "Next"}: <b>{v.nextPort.port}</b> <span className={styles.subtle}>({PORT_TYPE_LABEL[v.nextPort.type]})</span><div className={styles.note}>ETA {v.nextPort.eta ? formatInstant(v.nextPort.eta, v.nextPort.timeZone) : "not set"}</div></>
    : v.redelivery ? <>Next: <b>Re-delivery</b>{v.redelivery.place ? ` — ${v.redelivery.place}` : ""}<div className={styles.note}>{v.redelivery.at ? formatInstant(v.redelivery.at, v.redelivery.timeZone) : "date not set"}</div></> : null;
  const c = v.counts;
  return (
    <button className={db.card} onClick={onOpen} data-voyage={v.voyageNo}>
      <div className={db.cardTop}>
        <div>
          <div className={db.vessel}>{v.vessel}</div>
          <div className={styles.subtle}>{v.voyageNo} · {v.operators.join(", ")}</div>
        </div>
        <span className={`${styles.chip} ${styles.chipExcel}`} style={{ whiteSpace: "nowrap" }}>{VESSEL_STATUS_LABEL[v.vesselStatus]}{v.vesselStatusManual ? " *" : ""}</span>
      </div>
      {place && <div className={db.port}>{place}</div>}
      {next && <div className={db.port}>{next}</div>}
      <div className={db.counts}>
        <span className={db.count} style={{ background: c.overdue ? "#fee4e2" : "#f2f4f7", color: c.overdue ? "#b42318" : "#667085" }}>{c.overdue} overdue</span>
        <span className={db.count} style={{ background: c.today ? "#fef0c7" : "#f2f4f7", color: c.today ? "#b54708" : "#667085" }}>{c.today} due today</span>
        <span className={db.count} style={{ background: "#ecfdf3", color: "#067647" }}>{c.next7} next 7 days</span>
      </div>
      {v.checks && (
        <div>
          <div className={styles.note} style={{ marginBottom: 3 }}>Today's checks {v.checks.done} / {v.checks.total}</div>
          <div className={db.checksBar}><div style={{ width: `${v.checks.total ? (v.checks.done / v.checks.total) * 100 : 0}%` }} /></div>
        </div>
      )}
    </button>
  );
}

// Ops Dashboard — /operations (G3): all active voyages and today's work across vessels
function OpsDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [operator, setOperator] = useState("");
  const [scope, setScope] = useState(""); // "" = default, "all" / "mine"
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [openTask, setOpenTask] = useState(null);
  const [moved, setMoved] = useState(null);
  const canAct = hasRole(OPS_EDITOR_ROLES);

  const load = useCallback(async () => {
    try {
      setData(await OpsReportService.dashboard({ operator, tasks: scope }));
      setError("");
    } catch (e) { setError(e.message); }
  }, [operator, scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    EmployeeService.getEmployees().then((l) => setEmployees(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);

  const changed = async (res) => {
    await load();
    if (res && res.movedTasks && res.movedTasks.length) setMoved({ ...res, title: "Due dates moved" });
  };
  const { setStatus, dialogs } = useTaskActions(changed);

  const k = data?.kpis;
  return (
    <OpsLayout title="Ops Dashboard" breadcrumbs={[{ label: "Vessel Operations" }, { label: "Dashboard" }]}>
      <div className={styles.page}>
        {error && <div className={styles.formError}>{error}</div>}
        {!data && !error && <div className={styles.empty}>Loading…</div>}
        {data && (
          <>
            <div className={styles.toolbar}>
              <div className={styles.subtle}>Today (office time): <b>{formatLocalDate(data.today)}</b> · refreshes every minute</div>
              <div className={styles.toolbarLeft}>
                {data.canFilterOperator && (
                  <select className={styles.select} value={operator} onChange={(e) => setOperator(e.target.value)} aria-label="Operator">
                    <option value="">All operators</option>
                    {employees.map((e) => <option key={e._id} value={e._id}>{e.employeeName}</option>)}
                  </select>
                )}
                <button className={styles.btnSecondary} onClick={load}>Refresh</button>
              </div>
            </div>

            <div className={db.kpis}>
              <div className={db.kpi}><div className={db.kpiValue} data-testid="kpi-active">{k.activeVoyages}</div><div className={db.kpiLabel}>active voyages</div></div>
              <div className={db.kpi}><div className={db.kpiValue} style={{ color: k.overdue ? "#b42318" : undefined }} data-testid="kpi-overdue">{k.overdue}</div><div className={db.kpiLabel}>overdue tasks</div></div>
              <div className={db.kpi}><div className={db.kpiValue} style={{ color: k.dueToday ? "#b54708" : undefined }} data-testid="kpi-today">{k.dueToday}</div><div className={db.kpiLabel}>due today</div></div>
              <div className={db.kpi}><div className={db.kpiValue} style={{ color: "#067647" }}>{k.next7}</div><div className={db.kpiLabel}>due in the next 7 days</div></div>
              <div className={db.kpi}><div className={db.kpiValue} style={{ color: "#667085" }}>{k.awaitingDate}</div><div className={db.kpiLabel}>awaiting a date</div></div>
            </div>

            {data.voyages.length === 0 ? (
              <div className={styles.card}><div className={styles.empty}>No active voyages{operator ? " for this operator" : ""}.</div></div>
            ) : (
              <div className={db.cards}>
                {data.voyages.map((v) => <VoyageCard key={v._id} v={v} onOpen={() => navigate(`/operations/voyages/${v._id}`)} />)}
              </div>
            )}

            <div className={styles.card}>
              <div className={styles.toolbar}>
                <div className={styles.cardTitle}>
                  {data.tasksScope === "mine" ? "My tasks due today" : data.tasksScope === "operator" ? `Tasks due today — ${(employees.find((e) => e._id === operator) || {}).employeeName || "operator"}` : "Tasks due today — all vessels"}
                  <span className={styles.subtle} style={{ fontWeight: 400 }}> ({data.tasksToday.length})</span>
                </div>
                {!operator && data.myEmployeeId && (
                  <div className={styles.toolbarLeft}>
                    <button className={styles.btnLink} style={{ fontWeight: data.tasksScope === "mine" ? 700 : 400 }} onClick={() => setScope("mine")}>Mine</button>
                    <button className={styles.btnLink} style={{ fontWeight: data.tasksScope === "all" ? 700 : 400 }} onClick={() => setScope("all")}>All</button>
                  </div>
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Vessel / voyage</th><th>Task</th><th>Status</th><th className={ov.hideSm}>Priority</th><th className={ov.hideSm}>Assigned</th><th /></tr></thead>
                  <tbody>
                    {data.tasksToday.length === 0 && <tr><td colSpan={6} className={styles.empty}>Nothing due today.</td></tr>}
                    {data.tasksToday.map((t) => (
                      <tr key={t._id} data-task={t.code || t.baseName}>
                        <td style={{ whiteSpace: "nowrap" }}><b>{t.voyage.vessel}</b><div className={styles.note}>{t.voyage.voyageNo}</div></td>
                        <td>
                          <button className={ov.taskName} onClick={() => setOpenTask(t._id)}>{t.baseName || t.name}</button>
                          <div className={styles.note}>{[t.code, t.portCall?.port?.name].filter(Boolean).join(" · ")}</div>
                        </td>
                        <td>{TASK_STATUS_LABEL[t.status]}</td>
                        <td className={ov.hideSm}><PriorityTag value={t.priority} /></td>
                        <td className={`${styles.subtle} ${ov.hideSm}`}>{(t.assignedTo || []).map((a) => a.employeeName).join(", ") || "—"}</td>
                        <td>{canAct && <button className={ov.doneBtn} onClick={() => setStatus(t, "DONE")} aria-label={`Mark ${t.baseName || t.name} done`}>✓ Done</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.hint} style={{ marginTop: 8 }}>Overdue tasks are in My Tasks and in each voyage's Operations View. * = vessel status set by hand.</div>
            </div>
          </>
        )}
      </div>
      {openTask && <TaskDrawer taskId={openTask} employees={employees} onClose={() => setOpenTask(null)} onChanged={async (res) => { await changed(res); if (res) showToast("Updated", "success"); }} />}
      <EtaChangeModal result={moved} onClose={() => setMoved(null)} />
      {dialogs}
    </OpsLayout>
  );
}

export default OpsDashboard;
