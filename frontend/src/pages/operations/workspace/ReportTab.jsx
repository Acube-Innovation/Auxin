import React, { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import OpsReportService from "../../../services/OpsReportService";
import { TASK_STATUS_LABEL } from "../../../services/OpsTaskService";
import { useToast } from "../../../context/ToastContext";
import { formatDelay, formatInstant, formatLocalDate, VESSEL_STATUS_LABEL } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";
import rp from "./Report.module.css";

const STATUS_COLORS = { DONE: "#12b76a", INITIATED: "#2e90fa", AWAITING: "#f79009", NOT_STARTED: "#d0d5dd" };
const STATUS_ORDER = ["DONE", "INITIATED", "AWAITING", "NOT_STARTED"];
const KIND_LABEL = { DELIVERY: "Delivery", LOADING: "Load port", BUNKERING: "Bunkering port", DISCHARGING: "Discharge port", REDELIVERY: "Re-delivery" };

// Donut of task counts by status (hand-drawn SVG, like the Phase 1 charts)
function Donut({ byStatus, total, pctComplete }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label={`Tasks by status, ${pctComplete ?? 0}% complete`}>
      <circle cx="75" cy="75" r={r} fill="none" stroke="#f2f4f7" strokeWidth="20" />
      {total > 0 && STATUS_ORDER.map((s) => {
        const len = (byStatus[s] / total) * c;
        const el = <circle key={s} cx="75" cy="75" r={r} fill="none" stroke={STATUS_COLORS[s]} strokeWidth="20" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 75 75)" />;
        offset += len;
        return el;
      })}
      <text x="75" y="72" textAnchor="middle" fontSize="22" fontWeight="700" fill="#0b3a6f">{pctComplete ?? 0}%</text>
      <text x="75" y="92" textAnchor="middle" fontSize="11" fill="#667085">complete</text>
    </svg>
  );
}

function Delay({ from, to }) {
  const d = formatDelay(from, to);
  if (!d) return null;
  return <span className={d.minutes > 0 ? rp.late : d.minutes < 0 ? rp.early : styles.subtle}>{d.text}</span>;
}

// Report View (G2): status of tasks for one voyage, with Excel export and print
function ReportTab({ voyage, refreshKey }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    OpsReportService.voyageReport(voyage._id).then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, [voyage._id]);
  useEffect(() => { load(); }, [load, refreshKey]);

  if (voyage.status === "DRAFT") return <div className={styles.card}><div className={styles.empty}>The report is available once the voyage is activated.</div></div>;
  if (error) return <div className={styles.card}><div className={styles.formError}>{error}</div></div>;
  if (!data) return <div className={styles.card}><div className={styles.empty}>Loading…</div></div>;
  const t = data.totals;
  const at = (iso, tz) => (iso ? formatInstant(iso, tz, { withUtc: false }) : "—");

  const exportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const summary = [
        ["Voyage", data.voyage.voyageNo], ["Vessel", data.voyage.vessel], ["Vessel status", VESSEL_STATUS_LABEL[data.voyage.vesselStatus] || ""],
        ["Report date (office)", data.today], [],
        ["Tasks counted (excl. N/A)", t.counted], ["Not applicable", t.notApplicable], ["Done", t.done], ["Open", t.open], ["Overdue", t.overdue],
        ["% complete", t.pctComplete], ["Done on time", t.onTime], ["Done late", t.late], ["On-time %", t.onTimePct], [],
        ["Status", "Tasks"], ...STATUS_ORDER.map((s) => [TASK_STATUS_LABEL[s], data.byStatus[s]]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.byStage.map((g) => ({
        Stage: g.stage, Port: g.port || "", Tasks: g.total, Done: g.done, Open: g.open, Overdue: g.overdue, "% complete": g.pctComplete,
      }))), "By stage");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.overdue.map((o) => ({
        Code: o.code || "", Task: o.name, Stage: o.stage || "", Port: o.port || "", "Due date": o.dueDate, "Days overdue": o.overdueDays,
        Status: TASK_STATUS_LABEL[o.status], Priority: o.priority, "Assigned to": o.assignedTo.join(", "),
      }))), "Overdue");
      const lt = (iso, tz) => (iso ? formatInstant(iso, tz, { withUtc: false }).replace(" LT", "") : "");
      const utc = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.portTimeline.flatMap((p) => p.events.map((e) => ({
        Place: p.name, Type: KIND_LABEL[p.kind] || p.kind, Event: e.label, "Time zone": p.timeZone,
        "Original plan (LT)": lt(e.original, p.timeZone), "Planned (LT)": lt(e.planned, p.timeZone), "Actual (LT)": lt(e.actual, p.timeZone),
        "Actual (UTC)": utc(e.actual), "Delay vs original (h)": e.delayMinutes == null ? "" : Math.round(e.delayMinutes / 6) / 10,
      })))), "Port timeline");
      XLSX.writeFile(wb, `${data.voyage.voyageNo}_report_${data.today}.xlsx`);
      showToast("Report exported", "success");
    } catch (e) { showToast(`Export failed: ${e.message}`, "error"); }
  };

  return (
    <div className={rp.printArea}>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles.toolbar}>
          <div className={ws.sectionTitle} style={{ margin: 0 }}>Status of tasks — {data.voyage.voyageNo} · {data.voyage.vessel} <span className={styles.subtle} style={{ fontWeight: 400 }}>· {formatLocalDate(data.today)} · {VESSEL_STATUS_LABEL[data.voyage.vesselStatus]}</span></div>
          <div className={`${styles.toolbarLeft} ${rp.noPrint}`}>
            <button className={styles.btnSecondary} onClick={exportExcel}>Export to Excel</button>
            <button className={styles.btnSecondary} onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <div className={rp.kpis}>
          <div className={rp.kpi}><div className={rp.kpiValue} data-testid="kpi-complete">{t.pctComplete ?? 0}%</div><div className={rp.kpiLabel}>complete · {t.done} of {t.counted} tasks</div></div>
          <div className={rp.kpi}><div className={rp.kpiValue} data-testid="kpi-ontime">{t.onTimePct == null ? "—" : `${t.onTimePct}%`}</div><div className={rp.kpiLabel}>done on time · {t.onTime} on time, {t.late} late</div></div>
          <div className={rp.kpi}><div className={rp.kpiValue} style={{ color: t.overdue ? "#b42318" : undefined }} data-testid="kpi-overdue">{t.overdue}</div><div className={rp.kpiLabel}>overdue</div></div>
          <div className={rp.kpi}><div className={rp.kpiValue}>{t.open}</div><div className={rp.kpiLabel}>open · {data.byBucket.AWAITING_DATE || 0} awaiting a date</div></div>
          <div className={rp.kpi}><div className={rp.kpiValue} style={{ color: "#667085" }}>{t.notApplicable}</div><div className={rp.kpiLabel}>not applicable (left out)</div></div>
        </div>
        <div className={rp.twoCol}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", alignSelf: "start" }}>
            <Donut byStatus={data.byStatus} total={t.counted} pctComplete={t.pctComplete} />
            <div className={rp.legend} data-testid="status-legend">
              {STATUS_ORDER.map((s) => <div key={s}><span className={rp.dot} style={{ background: STATUS_COLORS[s] }} />{TASK_STATUS_LABEL[s]} <b>{data.byStatus[s]}</b></div>)}
            </div>
          </div>
          <div>
            <div className={ws.sectionTitle}>Progress by stage</div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {data.byStage.map((g) => (
                <div key={g.key} className={rp.stageRow} data-stage={g.stage}>
                  <div>{g.stage}{g.port && <span className={styles.subtle}> — {g.port}</span>}</div>
                  <div className={rp.track} title={`${g.done} done, ${g.overdue} overdue, ${g.open - g.overdue} open`}>
                    <div style={{ width: `${(g.done / g.total) * 100}%`, background: "#12b76a" }} />
                    <div style={{ width: `${(g.overdue / g.total) * 100}%`, background: "#f04438" }} />
                  </div>
                  <div style={{ whiteSpace: "nowrap" }}><b>{g.done}/{g.total}</b>{g.overdue > 0 && <span className={rp.late}> · {g.overdue} overdue</span>}</div>
                </div>
              ))}
            </div>
            <div className={styles.hint} style={{ marginTop: 6 }}><span className={rp.dot} style={{ background: "#12b76a" }} />done <span className={rp.dot} style={{ background: "#f04438", marginLeft: 10 }} />overdue <span className={rp.dot} style={{ background: "#eaecf0", marginLeft: 10 }} />open, not yet due</div>
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={ws.sectionTitle}>Overdue tasks ({data.overdue.length})</div>
        {data.overdue.length === 0 ? <div className={styles.subtle}>Nothing overdue.</div> : (
          <div className={styles.tableWrap} style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className={styles.table}>
              <thead><tr><th>Code</th><th>Task</th><th>Stage / port</th><th>Due</th><th>Overdue</th><th>Status</th><th>Assigned</th></tr></thead>
              <tbody>
                {data.overdue.map((o) => (
                  <tr key={o._id}>
                    <td className={styles.mono}>{o.code || "—"}</td>
                    <td>{o.name}</td>
                    <td className={styles.subtle}>{o.stage}{o.port ? ` — ${o.port}` : ""}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatLocalDate(o.dueDate)}</td>
                    <td className={rp.late} style={{ whiteSpace: "nowrap" }}>{o.overdueDays} day(s)</td>
                    <td>{TASK_STATUS_LABEL[o.status]}</td>
                    <td className={styles.subtle}>{o.assignedTo.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={ws.sectionTitle}>Planned vs actual — port timeline <span className={styles.subtle} style={{ fontWeight: 400 }}>· local time of each place</span></div>
        <div className={styles.tableWrap}>
          <table className={styles.table} data-testid="port-timeline">
            <thead><tr><th>Place</th><th>Event</th><th>Original plan</th><th>Planned now</th><th>Actual</th><th>Actual vs original</th></tr></thead>
            <tbody>
              {data.portTimeline.map((p) => p.events.map((e, i) => (
                <tr key={`${p.portCallId || p.kind}-${e.key}`} className={p.status === "CANCELLED" ? styles.inactive : ""}>
                  {i === 0 && <td rowSpan={p.events.length} style={{ verticalAlign: "top" }}><b>{p.name}</b><div className={styles.note}>{KIND_LABEL[p.kind]}{p.status === "CANCELLED" ? " · cancelled" : ""}</div></td>}
                  <td>{e.label}</td>
                  <td className={styles.subtle} style={{ whiteSpace: "nowrap" }}>{at(e.original, p.timeZone)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{at(e.planned, p.timeZone)}{e.planChangeMinutes ? <div className={styles.note}>plan <Delay from={e.original} to={e.planned} /></div> : null}</td>
                  <td style={{ whiteSpace: "nowrap", fontWeight: e.actual ? 600 : 400 }}>{at(e.actual, p.timeZone)}</td>
                  <td>{e.actual ? <Delay from={e.original || e.planned} to={e.actual} /> : <span className={styles.subtle}>—</span>}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <div className={styles.hint} style={{ marginTop: 6 }}>Original plan = dates when the voyage was activated. Red = later than the original plan, green = earlier. Not applicable tasks are left out of every count; colour groups match the Operations View.</div>
      </div>
    </div>
  );
}

export default ReportTab;
