import React from "react";
import RotationTimeline from "../../../components/operations/RotationTimeline";
import ActivatePanel from "./ActivatePanel";
import { BUCKETS, formatInstant, formatInstantDate } from "../../../utils/opsFormat";
import styles from "../masters/Masters.module.css";
import ws from "./Workspace.module.css";

const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const Row = ({ label, children }) => (
  <div className={ws.kv}><div>{label}</div><div>{children}</div></div>
);

// Overview tab: rotation timeline, task counts, parties, fixture, cargo, delivery / re-delivery, bunkers
function OverviewTab({ voyage, officeTz, canEdit, onOpenTasks, onActivated }) {
  const f = voyage.fixture || {};
  const at = (iso, tz) => (iso ? formatInstant(iso, tz) : "—");
  const counts = voyage.tasks?.byBucket || {};
  return (
    <div>
      <div className={styles.card} style={{ marginBottom: 14 }}>
        <div className={ws.sectionTitle}>Rotation</div>
        <RotationTimeline voyage={voyage} />
      </div>

      {voyage.status === "DRAFT" ? (
        <div className={styles.card} style={{ marginBottom: 14 }}>
          <div className={ws.sectionTitle}>Tasks</div>
          <ActivatePanel voyage={voyage} canEdit={canEdit} onActivated={onActivated} />
        </div>
      ) : (
        <div className={styles.card} style={{ marginBottom: 14 }}>
          <div className={ws.sectionTitle}>Tasks <span className={styles.subtle} style={{ fontWeight: 400 }}>· {voyage.tasks?.total || 0} in total</span></div>
          <div className={ws.bucketRow}>
            {BUCKETS.map((b) => (
              <button key={b.key} className={ws.bucketCard} style={{ borderColor: b.border || b.color, color: b.color, background: b.bg }} onClick={() => onOpenTasks(b.key)} aria-label={`${b.label}: ${counts[b.key] || 0}`}>
                <div className={ws.bucketCount}>{counts[b.key] || 0}</div>
                <div>{b.label}</div>
              </button>
            ))}
          </div>
          <div className={styles.hint} style={{ marginTop: 8 }}>Daily checks for the vessel's status arrive in Step 8; working the tasks (done, re-date, assign) in Step 7.</div>
        </div>
      )}

      <div className={ws.grid2}>
        <div className={styles.card}>
          <div className={ws.sectionTitle}>Parties</div>
          <Row label="Vessel">{voyage.vessel?.name}{voyage.vessel?.imo ? ` · IMO ${voyage.vessel.imo}` : ""}{voyage.vessel?.type ? ` · ${voyage.vessel.type}` : ""}</Row>
          <Row label="Master">{[voyage.master?.name, voyage.master?.email, voyage.master?.phone].filter(Boolean).join(" · ") || "—"}</Row>
          <Row label="Charterer">{dash(voyage.charterers?.companyName)}</Row>
          <Row label="Owners">{dash(voyage.owners?.companyName)}</Row>
          <Row label="Brokers">{(voyage.brokers || []).map((b) => b.companyName).join(", ") || "—"}</Row>
          <Row label="Operators">{(voyage.operators || []).map((o) => o.employeeName).join(", ") || "—"}</Row>
        </div>
        <div className={styles.card}>
          <div className={ws.sectionTitle}>Fixture <span className={styles.subtle} style={{ fontWeight: 400 }}>· office time</span></div>
          <Row label="Cargo fixed">{at(f.cargoFixedAt, officeTz)}</Row>
          <Row label="Vessel fixed">{at(f.vesselFixedAt, officeTz)}</Row>
          <Row label="Cargo laycan">{f.cargoLaycanFrom ? `${formatInstantDate(f.cargoLaycanFrom, officeTz)} – ${formatInstantDate(f.cargoLaycanTo, officeTz) || "?"}` : "—"}</Row>
          <Row label="Vessel laycan">{f.vesselLaycanFrom ? `${formatInstantDate(f.vesselLaycanFrom, officeTz)} – ${formatInstantDate(f.vesselLaycanTo, officeTz) || "?"}` : "—"}</Row>
          <Row label="CP date">{f.cpDate ? formatInstantDate(f.cpDate, officeTz) : "—"}</Row>
        </div>
        <div className={styles.card}>
          <div className={ws.sectionTitle}>Cargo</div>
          {(voyage.cargo || []).length === 0 ? <div className={styles.subtle}>No cargo lines</div> : voyage.cargo.map((c) => (
            <Row key={c._id} label={c.description}>{c.quantity != null ? `${c.quantity.toLocaleString("en-IN")} ${c.unit}` : "—"}{c.packages ? ` · ${c.packages} ${c.packageUnit || "pkgs"}` : ""}</Row>
          ))}
        </div>
        <div className={styles.card}>
          <div className={ws.sectionTitle}>Delivery, re-delivery and bunkers</div>
          {[["Delivery", voyage.delivery], ["Re-delivery", voyage.redelivery]].map(([label, h]) => (
            <Row key={label} label={label}>
              {[h?.place, h?.port?.name].filter(Boolean).join(" · ") || "—"}
              <div className={styles.note}>Est. {at(h?.estimated, h?.timeZone)}{h?.actual ? ` · Actual ${at(h.actual, h.timeZone)}` : ""}</div>
            </Row>
          ))}
          <Row label="Bunkers">
            {[voyage.portCalls.find((p) => p._id === voyage.bunker?.portCall)?.port?.name, voyage.bunker?.supplier?.companyName, voyage.bunker?.grade, voyage.bunker?.quantity != null ? `${voyage.bunker.quantity} MT` : null].filter(Boolean).join(" · ") || "—"}
            <div className={styles.note}>Booked: {voyage.bunker?.bookedOn ? at(voyage.bunker.bookedOn, officeTz) : "not yet"}</div>
          </Row>
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;
