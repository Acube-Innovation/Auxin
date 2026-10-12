import React, { useCallback, useEffect, useState } from "react";
import OpsVoyageService from "../../../services/OpsVoyageService";
import { formatInstant, formatDelay, PORT_TYPE_LABEL, DATE_FIELD_LABEL } from "../../../utils/opsFormat";
import { zoneLabel } from "../../../utils/opsTime";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const PLANNED = [["eta", "ETA"], ["etb", "ETB"], ["etc", "ETC"], ["ets", "ETS"]];
const ACTUALS = [["ata", "ATA"], ["norTendered", "NOR"], ["pob", "POB"], ["atb", "ATB"], ["commenced", "Commenced"], ["completed", "Completed"], ["atd", "ATD"]];
const TYPE_COLOR = { LOADING: "#067647", DISCHARGING: "#b54708", BUNKERING: "#3538cd" };

function Delay({ from, to, label }) {
  const d = formatDelay(from, to);
  if (!d) return null;
  return (
    <span className={`${styles.chip} ${d.minutes > 0 ? styles.chipHigh : styles.chipLow}`} style={{ marginRight: 6 }} title={label}>
      {label}: {d.minutes === 0 ? "on plan" : `${d.text} ${d.minutes > 0 ? "late" : "early"}`}
    </span>
  );
}

// Port Calls & SOF tab (features C1–C5, B6): planned / original / actual per port call, key dates, revision log
function PortCallsTab({ voyage, officeTz, editable, refreshKey, onAction }) {
  const [revisions, setRevisions] = useState(null);
  const loadRevisions = useCallback(() => {
    OpsVoyageService.getRevisions(voyage._id).then(setRevisions).catch(() => setRevisions([]));
  }, [voyage._id]);
  useEffect(() => { loadRevisions(); }, [loadRevisions, refreshKey]);

  const active = voyage.portCalls.filter((p) => p.status !== "CANCELLED");
  const lt = (iso, tz) => (iso ? formatInstant(iso, tz) : "—");
  const zoneOfRevision = (r) => r.portCall?.timeZone
    || (r.field.startsWith("delivery.") ? voyage.delivery?.timeZone : r.field.startsWith("redelivery.") ? voyage.redelivery?.timeZone : officeTz);

  return (
    <div>
      {voyage.status === "DRAFT" && <div className={styles.readOnlyBanner}>This voyage is a draft: change its rotation in the New Voyage form (Edit draft). Once active, dates are changed here and every change is logged.</div>}

      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={styles.toolbar} style={{ marginBottom: 6 }}>
          <div className={ws.sectionTitle} style={{ margin: 0 }}>Delivery, re-delivery and bunker dates</div>
          {editable && <button className={styles.btnSecondary} onClick={() => onAction("keyDates")}>Edit key dates</button>}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Point</th><th>Estimated</th><th>Original plan</th><th>Actual</th><th>Against plan</th></tr></thead>
            <tbody>
              {[["Delivery", voyage.delivery], ["Re-delivery", voyage.redelivery]].map(([label, h]) => (
                <tr key={label}>
                  <td><b>{label}</b><div className={styles.note}>{[h?.place, h?.port?.name].filter(Boolean).join(" · ") || "—"} · {zoneLabel(h?.timeZone || officeTz)}</div></td>
                  <td>{lt(h?.estimated, h?.timeZone)}</td>
                  <td className={styles.subtle}>{lt(h?.original, h?.timeZone)}</td>
                  <td>{lt(h?.actual, h?.timeZone)}</td>
                  <td><Delay from={h?.original} to={h?.actual || h?.estimated} label={h?.actual ? "Actual" : "Estimate"} /></td>
                </tr>
              ))}
              <tr>
                <td><b>Bunkers</b><div className={styles.note}>{voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall)?.port?.name || "—"}</div></td>
                <td colSpan={4}>
                  Booked on: {lt(voyage.bunker?.bookedOn, officeTz)} · Bunkering date: {lt(voyage.bunker?.bunkeringDate, voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall)?.timeZone || officeTz)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {voyage.portCalls.map((pc, i) => {
        const cancelled = pc.status === "CANCELLED";
        const state = cancelled ? "Cancelled" : pc.actual?.atd ? "Sailed" : pc.actual?.atb ? "Berthed" : pc.actual?.ata ? "Arrived" : "";
        const posInActive = active.findIndex((p) => p._id === pc._id);
        return (
          <div key={pc._id} className={styles.card} style={{ marginBottom: 14, borderLeft: `4px solid ${TYPE_COLOR[pc.type]}`, opacity: cancelled ? 0.6 : 1 }} data-testid={`sof-${pc.seq}`}>
            <div className={styles.toolbar} style={{ marginBottom: 6 }}>
              <div className={styles.toolbarLeft}>
                <b style={{ fontSize: "1.05rem" }}>{pc.seq}. {pc.port?.name}</b>
                <span className={styles.chip} style={{ background: "#f2f4f7", color: TYPE_COLOR[pc.type] }}>{PORT_TYPE_LABEL[pc.type]}</span>
                {state && <span className={`${styles.chip} ${cancelled ? styles.chipInactive : styles.chipExcel}`}>{state}</span>}
                <span className={styles.subtle}>{zoneLabel(pc.timeZone)}</span>
              </div>
              {editable && !cancelled && (
                <div className={styles.toolbarLeft}>
                  <button className={styles.btnPrimary} onClick={() => onAction("planned", pc)}>Update ETA</button>
                  <button className={styles.btnSecondary} onClick={() => onAction("actual", pc)}>Actual times</button>
                  <button className={styles.btnSecondary} onClick={() => onAction("details", pc)}>Details</button>
                  <button className={styles.btnLink} disabled={posInActive <= 0} onClick={() => onAction("move", pc, -1)} aria-label={`Move ${pc.port?.name} up`}>▲</button>
                  <button className={styles.btnLink} disabled={posInActive === active.length - 1} onClick={() => onAction("move", pc, 1)} aria-label={`Move ${pc.port?.name} down`}>▼</button>
                  <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => onAction("cancel", pc)}>Cancel call</button>
                </div>
              )}
            </div>
            <div className={styles.subtle} style={{ marginBottom: 8 }}>
              Agent: {pc.agent?.companyName || "—"} · {pc.type === "BUNKERING" ? "Quantity" : "Cargo"}: {pc.cargoQty != null ? pc.cargoQty.toLocaleString("en-IN") : "—"}{pc.ratePerDay ? ` @ ${pc.ratePerDay.toLocaleString("en-IN")}/day` : ""}{pc.remarks ? ` · ${pc.remarks}` : ""}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th style={{ width: 120 }} />{PLANNED.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
                <tbody>
                  <tr>
                    <td><b>Planned</b></td>
                    {PLANNED.map(([k]) => {
                      const suggested = k !== "eta" && pc.planned?.[k] && !pc.manual?.[k];
                      return <td key={k} style={{ fontStyle: suggested ? "italic" : "normal" }} title={suggested ? "Suggested" : undefined}>{lt(pc.planned?.[k], pc.timeZone)}</td>;
                    })}
                  </tr>
                  <tr className={styles.inactive}>
                    <td>Original plan</td>
                    {PLANNED.map(([k]) => <td key={k}>{lt(pc.original?.[k], pc.timeZone)}</td>)}
                  </tr>
                  <tr>
                    <td>Change</td>
                    {PLANNED.map(([k]) => {
                      const d = formatDelay(pc.original?.[k], pc.planned?.[k]);
                      return <td key={k}>{d && d.minutes !== 0 ? <span style={{ color: d.minutes > 0 ? "#b42318" : "#067647", fontWeight: 600 }}>{d.text}</span> : <span className={styles.subtle}>—</span>}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={ws.actualGrid}>
              {ACTUALS.map(([k, l]) => (
                <div key={k} className={pc.actual?.[k] ? ws.actualSet : ws.actualEmpty}>
                  <div className={ws.actualLabel}>{l}</div>
                  <div>{pc.actual?.[k] ? formatInstant(pc.actual[k], pc.timeZone) : "—"}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              <Delay from={pc.original?.eta} to={pc.actual?.ata} label="Arrival vs original ETA" />
              <Delay from={pc.original?.etb} to={pc.actual?.atb} label="Berthing vs original ETB" />
              <Delay from={pc.original?.etc} to={pc.actual?.completed} label="Completion vs original ETC" />
              <Delay from={pc.original?.ets} to={pc.actual?.atd} label="Sailing vs original ETS" />
            </div>
          </div>
        );
      })}
      {editable && <button className={styles.btnSecondary} onClick={() => onAction("add")}>+ Add port call</button>}

      <div className={styles.card} style={{ marginTop: 14 }}>
        <div className={ws.sectionTitle}>Revision log <span className={styles.subtle} style={{ fontWeight: 400 }}>· every key-date change after activation</span></div>
        {!revisions ? <div className={styles.empty}>Loading…</div> : revisions.length === 0 ? <div className={styles.empty}>No changes yet</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>When</th><th>Who</th><th>Where</th><th>Date</th><th>From</th><th>To</th><th>Tasks moved</th><th>Reason</th></tr></thead>
              <tbody>
                {revisions.map((r) => {
                  const tz = zoneOfRevision(r);
                  return (
                    <tr key={r._id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatInstant(r.at, officeTz, { withUtc: false })}</td>
                      <td>{r.by?.username || "—"}</td>
                      <td>{r.portCall?.port?.name || "Voyage"}</td>
                      <td>{DATE_FIELD_LABEL[r.field] || r.field}</td>
                      <td className={styles.subtle}>{r.from ? formatInstant(r.from, tz) : "—"}</td>
                      <td>{r.to ? formatInstant(r.to, tz) : "cleared"}</td>
                      <td>{r.tasksMoved}</td>
                      <td>{r.reason || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PortCallsTab;
