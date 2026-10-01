import React, { useCallback, useEffect, useState } from "react";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { formatInstant, formatLocalDate, DATE_FIELD_LABEL } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const KIND = { voyage: { label: "Voyage", color: "#0b3a6f" }, date: { label: "Date change", color: "#b54708" }, task: { label: "Task", color: "#067647" } };
const TASK_FIELD = { status: "status", dueDate: "due date", assignedTo: "assignee", priority: "priority", remarks: "remarks" };
const showValue = (v) => (v === null || v === undefined || v === "" ? "—" : /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatLocalDate(v) : String(v));

// Activity tab (feature D10, C3): everything that happened to the voyage, newest first
function ActivityTab({ voyageId, officeTz, refreshKey }) {
  const [items, setItems] = useState(null);
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    OpsVoyageService.getActivity(voyageId).then((d) => setItems(d.items)).catch((e) => setError(e.message));
  }, [voyageId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (error) return <div className={styles.formError}>{error}</div>;
  if (!items) return <div className={styles.empty}>Loading…</div>;
  const shown = items.filter((i) => !kind || i.kind === kind);

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Activity</div>
          <select className={styles.select} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Activity type">
            <option value="">Everything</option>
            <option value="voyage">Voyage changes</option>
            <option value="date">Date changes</option>
            <option value="task">Task changes</option>
          </select>
        </div>
        <span className={styles.subtle}>{shown.length} entr{shown.length === 1 ? "y" : "ies"} · times in office time</span>
      </div>
      {shown.length === 0 && <div className={styles.empty}>Nothing recorded yet</div>}
      <ul className={ws.activity}>
        {shown.map((i, n) => (
          <li key={n}>
            <span className={ws.activityKind} style={{ color: KIND[i.kind].color, borderColor: KIND[i.kind].color }}>{KIND[i.kind].label}</span>
            <div style={{ flex: 1 }}>
              {i.kind === "voyage" && <div>{i.text}</div>}
              {i.kind === "date" && (
                <div>
                  {i.port && <b>{i.port} · </b>}{DATE_FIELD_LABEL[i.field] || i.field}: {i.from ? formatInstant(i.from, i.zone) : "—"} → <b>{i.to ? formatInstant(i.to, i.zone) : "cleared"}</b>
                  {i.tasksMoved > 0 && <span className={styles.defaulted}>{i.tasksMoved} task due date(s) moved</span>}
                  {i.reason && <div className={styles.note}>Reason: {i.reason}</div>}
                </div>
              )}
              {i.kind === "task" && (
                <div>
                  <b>{i.code ? `${i.code} ` : ""}{i.task}</b>: {TASK_FIELD[i.field] || i.field} {showValue(i.from)} → {showValue(i.to)}
                  {i.note && <div className={styles.note}>{i.note}</div>}
                </div>
              )}
              <div className={styles.note}>{formatInstant(i.at, officeTz, { withUtc: false })} · {i.by}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ActivityTab;
