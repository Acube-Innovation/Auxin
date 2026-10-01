import React, { useEffect, useState } from "react";
import OpsModal from "./OpsModal";
import OpsVoyageService from "../../services/OpsVoyageService";
import { formatInstant, formatInstantDate, PORT_TYPE_LABEL } from "../../utils/opsFormat";
import styles from "../../pages/operations/masters/Masters.module.css";

const STATUS_CLASS = { DRAFT: styles.chipNone, ACTIVE: styles.chipActive, COMPLETED: styles.chipExcel, CANCELLED: styles.chipInactive };
const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

function Row({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "4px 0", fontSize: "0.88rem" }}>
      <div style={{ width: 170, color: "#7a8699", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ fontWeight: 600, color: "#0b3a6f", borderBottom: "1px solid #e4e4e4", paddingBottom: 4, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

// Read-only view of a voyage (editing arrives with the New Voyage form in step 5)
function VoyageSummaryModal({ voyageId, officeTz, onClose }) {
  const [voyage, setVoyage] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!voyageId) return;
    setVoyage(null);
    setError("");
    OpsVoyageService.get(voyageId).then(setVoyage).catch((e) => setError(e.message));
  }, [voyageId]);

  const f = voyage?.fixture || {};
  const at = (iso, tz) => (iso ? formatInstant(iso, tz) : "—");

  return (
    <OpsModal isOpen={Boolean(voyageId)} onClose={onClose} width={900}
      title={voyage ? `${voyage.voyageNo} · ${voyage.vessel?.name || ""}` : "Voyage"}
      footer={<button className={styles.btnSecondary} onClick={onClose}>Close</button>}>
      {error && <div className={styles.formError}>{error}</div>}
      {!voyage && !error && <div className={styles.empty}>Loading…</div>}
      {voyage && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span className={`${styles.chip} ${STATUS_CLASS[voyage.status]}`}>{voyage.status}</span>
            <span className={`${styles.chip} ${styles.chipScope}`}>{voyage.voyageType === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"}</span>
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
              </Row>
            ))}
          </Section>

          <Section title="Port rotation">
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>#</th><th>Port</th><th>Type</th><th>Agent</th><th>Cargo / rate</th><th>ETA</th><th>ETB</th><th>ETC</th><th>ETS</th></tr></thead>
                <tbody>
                  {voyage.portCalls.length === 0 && <tr><td colSpan={9} className={styles.empty}>No port calls yet</td></tr>}
                  {voyage.portCalls.map((pc) => (
                    <tr key={pc._id} className={pc.status === "CANCELLED" ? styles.inactive : ""}>
                      <td>{pc.seq}</td>
                      <td><b>{pc.port?.name}</b><div className={styles.note}>{pc.timeZone}</div>{pc.status === "CANCELLED" && <div className={styles.note}>Cancelled</div>}</td>
                      <td>{PORT_TYPE_LABEL[pc.type]}</td>
                      <td>{dash(pc.agent?.companyName)}</td>
                      <td>{pc.cargoQty != null ? pc.cargoQty.toLocaleString("en-IN") : "—"}{pc.ratePerDay ? <div className={styles.note}>{pc.ratePerDay.toLocaleString("en-IN")}/day</div> : null}</td>
                      {["eta", "etb", "etc", "ets"].map((k) => <td key={k} style={{ minWidth: 120 }}>{pc.planned?.[k] ? formatInstant(pc.planned[k], pc.timeZone) : "—"}</td>)}
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

          <div className={styles.subtle}>
            Created by {voyage.createdBy?.username || "—"} · last updated by {voyage.updatedBy?.username || "—"} on {formatInstant(voyage.updatedAt, officeTz, { withUtc: false })}
          </div>
        </>
      )}
    </OpsModal>
  );
}

export default VoyageSummaryModal;
