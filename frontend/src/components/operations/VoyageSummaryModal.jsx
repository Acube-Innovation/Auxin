import React, { useCallback, useEffect, useState } from "react";
import OpsModal from "./OpsModal";
import TaskPreview from "./TaskPreview";
import VoyageTaskList from "./VoyageTaskList";
import OpsVoyageService from "../../services/OpsVoyageService";
import { useToast } from "../../context/ToastContext";
import { formatInstant, formatInstantDate, PORT_TYPE_LABEL, VESSEL_STATUS_LABEL } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const STATUS_CLASS = { DRAFT: styles.chipNone, ACTIVE: styles.chipActive, COMPLETED: styles.chipExcel, CANCELLED: styles.chipInactive };
const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const SUGGESTED_HINT = "Suggested: ETB = ETA + waiting time, ETC = ETB + quantity ÷ rate, ETS = ETC. Typing a value replaces the suggestion.";

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 0", fontSize: "0.88rem" }}>
      <div style={{ width: 170, color: "#7a8699", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Section({ title, right, children }) {
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, color: "#0b3a6f", borderBottom: "1px solid #e4e4e4", paddingBottom: 4, marginBottom: 6 }}>
        <span>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}

// Voyage details. Drafts: preview the generated tasks and activate. Active voyages: task list and vessel status.
// (Editing voyage data arrives with the New Voyage form in step 5 and the workspace in step 6.)
function VoyageSummaryModal({ voyageId, officeTz, onClose, onChanged }) {
  const { showToast } = useToast();
  const [voyage, setVoyage] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [excluded, setExcluded] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [tasksKey, setTasksKey] = useState(0);

  const load = useCallback(() => {
    if (!voyageId) return;
    OpsVoyageService.get(voyageId).then(setVoyage).catch((e) => setError(e.message));
  }, [voyageId]);

  useEffect(() => {
    setVoyage(null);
    setError("");
    setPreview(null);
    load();
  }, [load]);

  const loadPreview = async () => {
    setBusy(true);
    try {
      const p = await OpsVoyageService.previewTasks(voyageId);
      setPreview(p);
      setExcluded(new Set(p.tasks.filter((t) => !t.included).map((t) => t.key)));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key) => setExcluded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleGroup = (keys, include) => setExcluded((prev) => {
    const next = new Set(prev);
    keys.forEach((k) => (include ? next.delete(k) : next.add(k)));
    return next;
  });

  const activate = async () => {
    const included = preview.tasks.length - excluded.size;
    if (!window.confirm(`Activate ${voyage.voyageNo}? ${included} tasks will be created${excluded.size ? ` and ${excluded.size} kept as Not applicable` : ""}. The current dates become the original plan.`)) return;
    setBusy(true);
    try {
      const ex = preview.tasks.filter((t) => excluded.has(t.key)).map((t) => ({ code: t.code, portCall: t.portCall ? t.portCall._id : null }));
      const res = await OpsVoyageService.activate(voyageId, { excluded: ex });
      showToast(`${res.voyageNo} is active: ${res.activation.created} tasks created`, "success");
      setPreview(null);
      setVoyage(res);
      onChanged && onChanged();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatusOverride = async (value) => {
    try {
      setVoyage(await OpsVoyageService.setVesselStatus(voyageId, value || null));
      showToast(value ? `Vessel status set to ${VESSEL_STATUS_LABEL[value]}` : "Vessel status follows the actual times again", "success");
      onChanged && onChanged();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const f = voyage?.fixture || {};
  const at = (iso, tz) => (iso ? formatInstant(iso, tz) : "—");
  const canEdit = voyage?.permissions?.canEdit;

  return (
    <OpsModal isOpen={Boolean(voyageId)} onClose={onClose} width={1000}
      title={voyage ? `${voyage.voyageNo} · ${voyage.vessel?.name || ""}` : "Voyage"}
      footer={<button className={styles.btnSecondary} onClick={onClose}>Close</button>}>
      {error && <div className={styles.formError}>{error}</div>}
      {!voyage && !error && <div className={styles.empty}>Loading…</div>}
      {voyage && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span className={`${styles.chip} ${STATUS_CLASS[voyage.status]}`}>{voyage.status}</span>
            <span className={`${styles.chip} ${styles.chipScope}`}>{voyage.voyageType === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"}</span>
            <span className={`${styles.chip} ${styles.chipExcel}`} title="Vessel status">
              {VESSEL_STATUS_LABEL[voyage.vesselStatusShown]}{voyage.vesselStatusOverride?.value ? " (set by hand)" : ""}
            </span>
            {voyage.remarks && <span className={styles.subtle}>{voyage.remarks}</span>}
          </div>

          <Section title="Parties">
            <Row label="Vessel">{voyage.vessel?.name}{voyage.vessel?.imo ? ` · IMO ${voyage.vessel.imo}` : ""}{voyage.vessel?.type ? ` · ${voyage.vessel.type}` : ""}</Row>
            <Row label="Master">{[voyage.master?.name, voyage.master?.email, voyage.master?.phone].filter(Boolean).join(" · ") || "—"}</Row>
            <Row label="Charterer">{dash(voyage.charterers?.companyName)}</Row>
            <Row label="Owners">{dash(voyage.owners?.companyName)}</Row>
            <Row label="Brokers">{(voyage.brokers || []).map((b) => b.companyName).join(", ") || "—"}</Row>
            <Row label="Operators">{(voyage.operators || []).map((o) => o.employeeName).join(", ") || "—"}</Row>
          </Section>

          <Section title={`Fixture (office time, ${officeTz || "office"})`}>
            <Row label="Cargo fixed">{at(f.cargoFixedAt, officeTz)}</Row>
            <Row label="Vessel fixed">{at(f.vesselFixedAt, officeTz)}</Row>
            <Row label="Cargo laycan">{f.cargoLaycanFrom ? `${formatInstantDate(f.cargoLaycanFrom, officeTz)} – ${formatInstantDate(f.cargoLaycanTo, officeTz) || "?"}` : "—"}</Row>
            <Row label="Vessel laycan">{f.vesselLaycanFrom ? `${formatInstantDate(f.vesselLaycanFrom, officeTz)} – ${formatInstantDate(f.vesselLaycanTo, officeTz) || "?"}` : "—"}</Row>
            <Row label="CP date">{f.cpDate ? formatInstantDate(f.cpDate, officeTz) : "—"}</Row>
          </Section>

          <Section title="Cargo">
            {(voyage.cargo || []).length === 0 ? <div className={styles.subtle}>No cargo lines</div> : voyage.cargo.map((c) => (
              <Row key={c._id} label={c.description}>{c.quantity != null ? `${c.quantity.toLocaleString("en-IN")} ${c.unit}` : "—"}{c.packages ? ` · ${c.packages} ${c.packageUnit || "pkgs"}` : ""}{c.remarks ? ` · ${c.remarks}` : ""}</Row>
            ))}
          </Section>

          <Section title="Delivery and re-delivery">
            {[["Delivery", voyage.delivery], ["Re-delivery", voyage.redelivery]].map(([label, h]) => (
              <Row key={label} label={label}>
                {[h?.place, h?.port?.name].filter(Boolean).join(" · ") || "—"}
                <div className={styles.note}>Estimated: {at(h?.estimated, h?.timeZone)} · Actual: {at(h?.actual, h?.timeZone)}</div>
                {h?.original && <div className={styles.note}>Original plan: {at(h.original, h.timeZone)}</div>}
              </Row>
            ))}
          </Section>

          <Section title="Port rotation" right={<span className={styles.subtle} style={{ fontWeight: 400 }} title={SUGGESTED_HINT}><i>italic</i> = suggested</span>}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>Port</th><th>Type</th><th>Agent</th><th>Cargo / rate</th><th>ETA</th><th>ETB</th><th>ETC</th><th>ETS</th><th>Actual</th></tr></thead>
                <tbody>
                  {voyage.portCalls.length === 0 && <tr><td colSpan={10} className={styles.empty}>No port calls yet</td></tr>}
                  {voyage.portCalls.map((pc) => (
                    <tr key={pc._id} className={pc.status === "CANCELLED" ? styles.inactive : ""}>
                      <td>{pc.seq}</td>
                      <td><b>{pc.port?.name}</b><div className={styles.note}>{pc.timeZone}</div>{pc.status === "CANCELLED" && <div className={styles.note}>Cancelled</div>}</td>
                      <td>{PORT_TYPE_LABEL[pc.type]}</td>
                      <td>{dash(pc.agent?.companyName)}</td>
                      <td>{pc.cargoQty != null ? pc.cargoQty.toLocaleString("en-IN") : "—"}{pc.ratePerDay ? <div className={styles.note}>{pc.ratePerDay.toLocaleString("en-IN")}/day</div> : null}</td>
                      {["eta", "etb", "etc", "ets"].map((k) => {
                        const suggested = k !== "eta" && pc.planned?.[k] && !pc.manual?.[k];
                        return (
                          <td key={k} style={{ minWidth: 120, fontStyle: suggested ? "italic" : "normal", color: suggested ? "#475467" : undefined }} title={suggested ? SUGGESTED_HINT : undefined}>
                            {pc.planned?.[k] ? formatInstant(pc.planned[k], pc.timeZone) : "—"}
                            {pc.original?.[k] && pc.planned?.[k] && pc.original[k] !== pc.planned[k] && <div className={styles.note}>was {formatInstant(pc.original[k], pc.timeZone, { withUtc: false })}</div>}
                          </td>
                        );
                      })}
                      <td style={{ minWidth: 140 }} className={styles.subtle}>
                        {[["ATA", "ata"], ["ATB", "atb"], ["ATD", "atd"]].filter(([, k]) => pc.actual?.[k]).map(([l, k]) => <div key={k}>{l} {formatInstant(pc.actual[k], pc.timeZone, { withUtc: false })}</div>)}
                        {!["ata", "atb", "atd"].some((k) => pc.actual?.[k]) && "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Bunkers">
            <Row label="Bunkering port">{voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall)?.port?.name || "—"}</Row>
            <Row label="Supplier">{dash(voyage.bunker?.supplier?.companyName)}</Row>
            <Row label="Grade / quantity">{[voyage.bunker?.grade, voyage.bunker?.quantity != null ? `${voyage.bunker.quantity} MT` : null].filter(Boolean).join(" · ") || "—"}</Row>
          </Section>

          {voyage.status === "DRAFT" && (
            <Section title="Tasks">
              {!preview && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span className={styles.subtle}>Tasks are generated from the task templates when the voyage is activated.</span>
                  {canEdit && <button className={styles.btnPrimary} onClick={loadPreview} disabled={busy}>{busy ? "Loading…" : "Preview tasks"}</button>}
                </div>
              )}
              {preview && (
                <>
                  <div className={styles.toolbar}>
                    <span className={styles.subtle}>
                      {preview.totals.total} tasks generated · <b>{preview.totals.total - excluded.size}</b> ticked · {excluded.size} unticked (kept as Not applicable) · {preview.totals.awaitingDate} awaiting a date
                    </span>
                    <div className={styles.toolbarLeft}>
                      <button className={styles.btnSecondary} onClick={() => setPreview(null)}>Cancel</button>
                      <button className={styles.btnPrimary} onClick={activate} disabled={busy}>{busy ? "Activating…" : "Activate voyage"}</button>
                    </div>
                  </div>
                  <TaskPreview tasks={preview.tasks} excluded={excluded} onToggle={toggle} onToggleGroup={toggleGroup} />
                </>
              )}
            </Section>
          )}

          {voyage.status !== "DRAFT" && (
            <Section
              title={`Tasks (${voyage.tasks?.total ?? 0})`}
              right={canEdit && voyage.status === "ACTIVE" && (
                <label className={styles.subtle} style={{ fontWeight: 400 }}>
                  Vessel status:{" "}
                  <select className={styles.select} value={voyage.vesselStatusOverride?.value || ""} onChange={(e) => setStatusOverride(e.target.value)} aria-label="Vessel status override">
                    <option value="">Automatic — {VESSEL_STATUS_LABEL[voyage.vesselStatus]}</option>
                    {Object.entries(VESSEL_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>Set by hand: {l}</option>)}
                  </select>
                </label>
              )}
            >
              <VoyageTaskList voyageId={voyage._id} refreshKey={tasksKey} />
              <div className={styles.toolbar} style={{ marginTop: 8 }}>
                <span className={styles.subtle}>Editing tasks, dates and actual times arrives in the voyage workspace (steps 6–7).</span>
                <button className={styles.btnLink} onClick={() => { load(); setTasksKey((k) => k + 1); }}>Refresh</button>
              </div>
            </Section>
          )}

          <div className={styles.subtle}>
            Created by {voyage.createdBy?.username || "—"} · last updated by {voyage.updatedBy?.username || "—"} on {formatInstant(voyage.updatedAt, officeTz, { withUtc: false })}
          </div>
        </>
      )}
    </OpsModal>
  );
}

export default VoyageSummaryModal;
