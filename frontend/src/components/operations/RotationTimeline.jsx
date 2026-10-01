import React from "react";
import { formatInstant, formatDelay, PORT_TYPE_LABEL } from "../../utils/opsFormat";
import styles from "./RotationTimeline.module.css";

const TYPE_COLOR = { LOADING: "#067647", DISCHARGING: "#b54708", BUNKERING: "#3538cd", HANDOVER: "#0b3a6f" };

// Delivery → port calls → re-delivery with planned vs actual and the delay against the original plan (feature C4)
function RotationTimeline({ voyage }) {
  const calls = (voyage.portCalls || []).filter((p) => p.status !== "CANCELLED");
  const lt = (iso, tz) => (iso ? formatInstant(iso, tz, { withUtc: false }) : "—");

  const stops = [
    {
      key: "delivery", title: "Delivery", sub: [voyage.delivery?.place, voyage.delivery?.port?.name].filter(Boolean).join(" · "), color: TYPE_COLOR.HANDOVER,
      plannedLabel: "Estimated", planned: voyage.delivery?.estimated, actualLabel: "Actual", actual: voyage.delivery?.actual,
      original: voyage.delivery?.original, tz: voyage.delivery?.timeZone, done: Boolean(voyage.delivery?.actual),
    },
    ...calls.map((pc) => ({
      key: pc._id, title: pc.port?.name, sub: PORT_TYPE_LABEL[pc.type], color: TYPE_COLOR[pc.type],
      plannedLabel: "ETA", planned: pc.planned?.eta, actualLabel: "ATA", actual: pc.actual?.ata,
      original: pc.original?.eta, tz: pc.timeZone, sailed: pc.actual?.atd, sailPlanned: pc.planned?.ets,
      done: Boolean(pc.actual?.atd), inPort: Boolean((pc.actual?.ata || pc.actual?.atb) && !pc.actual?.atd),
    })),
    {
      key: "redelivery", title: "Re-delivery", sub: [voyage.redelivery?.place, voyage.redelivery?.port?.name].filter(Boolean).join(" · "), color: TYPE_COLOR.HANDOVER,
      plannedLabel: "Estimated", planned: voyage.redelivery?.estimated, actualLabel: "Actual", actual: voyage.redelivery?.actual,
      original: voyage.redelivery?.original, tz: voyage.redelivery?.timeZone, done: Boolean(voyage.redelivery?.actual),
    },
  ];
  const nextIndex = stops.findIndex((s) => !s.done && !s.inPort);

  return (
    <div className={styles.timeline} role="list" aria-label="Rotation timeline">
      {stops.map((s, i) => {
        const state = s.done ? "done" : s.inPort ? "current" : i === nextIndex ? "next" : "upcoming";
        // Arrival delay: actual (or latest estimate) against the original plan
        const delay = s.original ? formatDelay(s.original, s.actual || s.planned) : null;
        return (
          <React.Fragment key={s.key}>
            {i > 0 && <div className={`${styles.connector} ${stops[i - 1].done ? styles.connectorDone : ""}`} />}
            <div className={`${styles.stop} ${styles[state]}`} role="listitem" style={{ "--accent": s.color }}>
              <div className={styles.dot} />
              <div className={styles.title}>{s.title || "—"}</div>
              <div className={styles.sub}>{s.sub || " "}</div>
              <div className={styles.state}>{{ done: s.key === "delivery" ? "Delivered" : s.key === "redelivery" ? "Re-delivered" : "Sailed", current: "In port", next: "Next", upcoming: "" }[state]}</div>
              <div className={styles.row}><span>{s.plannedLabel}</span>{lt(s.planned, s.tz)}</div>
              <div className={styles.row}><span>{s.actualLabel}</span>{lt(s.actual, s.tz)}</div>
              {s.sailed !== undefined && <div className={styles.row}><span>{s.sailed ? "ATD" : "ETS"}</span>{lt(s.sailed || s.sailPlanned, s.tz)}</div>}
              {delay && (
                <div className={`${styles.delay} ${delay.minutes > 0 ? styles.late : styles.early}`} title="Against the original plan frozen at activation">
                  {delay.minutes === 0 ? "on plan" : `${delay.text} ${delay.minutes > 0 ? "late" : "early"}`}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default RotationTimeline;
