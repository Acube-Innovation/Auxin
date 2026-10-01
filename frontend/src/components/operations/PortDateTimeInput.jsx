import React from "react";
import { toLocalInput, fromLocalInput, toDateInput, fromDateInput, utcHint } from "../../utils/opsTime";
import styles from "../../pages/operations/masters/Masters.module.css";

// Date-time entered in a port's (or the office's) local time; the value is a UTC ISO string (feature C2).
// `suggested` shows the value in italics as a suggestion that typing replaces.
export function PortDateTimeInput({ value, zone, onChange, suggested = false, ariaLabel, disabled = false, onReset }) {
  return (
    <div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="datetime-local"
          className={styles.input}
          style={{ fontStyle: suggested ? "italic" : "normal", color: suggested ? "#475467" : undefined, minWidth: 0 }}
          value={toLocalInput(value, zone)}
          onChange={(e) => onChange(fromLocalInput(e.target.value, zone))}
          aria-label={ariaLabel}
          disabled={disabled || !zone}
          title={suggested ? "Suggested — type a value to replace it" : undefined}
        />
        {onReset && !suggested && value && (
          <button type="button" className={styles.btnLink} onClick={onReset} title="Clear and use the suggestion again" aria-label={`Reset ${ariaLabel || ""} to suggested`}>↺</button>
        )}
      </div>
      <div className={styles.hint} style={{ marginTop: 2 }}>
        {!zone ? "Choose the port first" : value ? `${suggested ? "suggested · " : ""}LT = ${utcHint(value, zone)}` : " "}
      </div>
    </div>
  );
}

// Calendar date in a zone (laycans, CP date); value is the UTC ISO of local midnight
export function ZoneDateInput({ value, zone, onChange, ariaLabel }) {
  return (
    <input type="date" className={styles.input} value={toDateInput(value, zone)} onChange={(e) => onChange(fromDateInput(e.target.value, zone))} aria-label={ariaLabel} />
  );
}

export default PortDateTimeInput;
