import React from "react";
import { formatInstant, formatInstantDate, PORT_TYPE_LABEL } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

function Block({ title, children }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: 600, color: "#0b3a6f", borderBottom: "1px solid #e4e4e4", paddingBottom: 4, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
const Row = ({ label, children }) => (
  <div style={{ display: "flex", gap: 12, padding: "3px 0", fontSize: "0.88rem" }}>
    <div style={{ width: 160, color: "#7a8699", flexShrink: 0 }}>{label}</div><div style={{ flex: 1 }}>{children}</div>
  </div>
);

// Step 6 — Review of the saved draft (like the client's OPS sheet) before activation
function StepReview({ voyage, officeTz, counts }) {
  if (!voyage) return <div className={styles.empty}>Loading…</div>;
  const f = voyage.fixture || {};
  const at = (iso, tz) => (iso ? formatInstant(iso, tz) : "—");
  return (
    <div>
      <div className={styles.readOnlyBanner}>
        Activating creates <b>{counts.included}</b> tasks{counts.excluded ? `, keeps ${counts.excluded} as Not applicable` : ""}{counts.adhoc ? ` and adds ${counts.adhoc} one-off task(s)` : ""}.
        The dates below become the <b>original plan</b>. Later changes move the due dates automatically and are logged.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div>
          <Block title="Voyage">
            <Row label="Draft number">{voyage.voyageNo}</Row>
            <Row label="Type">{voyage.voyageType === "TC_TRIP" ? "Time-charter trip" : "Voyage charter"}</Row>
            <Row label="Vessel">{voyage.vessel?.name}</Row>
            <Row label="Master">{[voyage.master?.name, voyage.master?.email, voyage.master?.phone].filter(Boolean).join(" · ") || "—"}</Row>
            <Row label="Charterer">{dash(voyage.charterers?.companyName)}</Row>
            <Row label="Owners">{dash(voyage.owners?.companyName)}</Row>
            <Row label="Brokers">{(voyage.brokers || []).map((b) => b.companyName).join(", ") || "—"}</Row>
            <Row label="Operators">{(voyage.operators || []).map((o) => o.employeeName).join(", ")}</Row>
          </Block>
          <Block title="Cargo">
            {(voyage.cargo || []).length ? voyage.cargo.map((c) => <Row key={c._id} label={c.description}>{c.quantity != null ? `${c.quantity.toLocaleString("en-IN")} ${c.unit}` : "—"}</Row>) : <div className={styles.subtle}>No cargo lines</div>}
          </Block>
        </div>
        <div>
          <Block title={`Fixture (office time)`}>
            <Row label="Cargo fixed">{at(f.cargoFixedAt, officeTz)}</Row>
            <Row label="Vessel fixed">{at(f.vesselFixedAt, officeTz)}</Row>
            <Row label="Cargo laycan">{f.cargoLaycanFrom ? `${formatInstantDate(f.cargoLaycanFrom, officeTz)} – ${formatInstantDate(f.cargoLaycanTo, officeTz) || "?"}` : "—"}</Row>
            <Row label="Vessel laycan">{f.vesselLaycanFrom ? `${formatInstantDate(f.vesselLaycanFrom, officeTz)} – ${formatInstantDate(f.vesselLaycanTo, officeTz) || "?"}` : "—"}</Row>
            <Row label="CP date">{f.cpDate ? formatInstantDate(f.cpDate, officeTz) : "—"}</Row>
          </Block>
          <Block title="Delivery, re-delivery and bunkers">
            <Row label="Delivery">{[voyage.delivery?.place, voyage.delivery?.port?.name].filter(Boolean).join(" · ") || "—"}<div className={styles.note}>{at(voyage.delivery?.estimated, voyage.delivery?.timeZone)}</div></Row>
            <Row label="Re-delivery">{[voyage.redelivery?.place, voyage.redelivery?.port?.name].filter(Boolean).join(" · ") || "—"}<div className={styles.note}>{at(voyage.redelivery?.estimated, voyage.redelivery?.timeZone)}</div></Row>
            <Row label="Bunkers">{[voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall)?.port?.name, voyage.bunker?.supplier?.companyName, voyage.bunker?.grade, voyage.bunker?.quantity != null ? `${voyage.bunker.quantity} MT` : null].filter(Boolean).join(" · ") || "—"}</Row>
          </Block>
        </div>
      </div>
      <Block title="Port rotation">
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>#</th><th>Port</th><th>Type</th><th>Agent</th><th>Qty / rate</th><th>ETA</th><th>ETB</th><th>ETC</th><th>ETS</th></tr></thead>
            <tbody>
              {voyage.portCalls.map((pc) => (
                <tr key={pc._id}>
                  <td>{pc.seq}</td>
                  <td><b>{pc.port?.name}</b></td>
                  <td>{PORT_TYPE_LABEL[pc.type]}</td>
                  <td>{dash(pc.agent?.companyName)}</td>
                  <td>{pc.cargoQty != null ? pc.cargoQty.toLocaleString("en-IN") : "—"}{pc.ratePerDay ? ` @ ${pc.ratePerDay.toLocaleString("en-IN")}/day` : ""}</td>
                  {["eta", "etb", "etc", "ets"].map((k) => (
                    <td key={k} style={{ minWidth: 115, fontStyle: k !== "eta" && pc.planned?.[k] && !pc.manual?.[k] ? "italic" : "normal" }}>
                      {pc.planned?.[k] ? formatInstant(pc.planned[k], pc.timeZone) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}

export default StepReview;
