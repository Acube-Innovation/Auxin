import React, { useState } from "react";
import { DATE_FIELD_LABEL, VESSEL_STATUS_LABEL, formatInstant } from "../../utils/opsFormat";
import styles from "./DailyCheckList.module.css";

const linkedLabel = (path) => {
  const parts = path.split(".");
  const port = { LOADING: "load port", DISCHARGING: "discharge port", BUNKERING: "bunkering port" }[parts[1]];
  const label = DATE_FIELD_LABEL[parts.slice(-2).join(".")] || path;
  return port ? `${label} (${port})` : label;
};

export function CheckProgress({ items }) {
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className={styles.progress} data-testid="checks-progress">
      <b>{done} / {items.length} done</b>
      <div className={styles.bar}><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

// The items of one day's checklist (E1). Grouped by vessel status when the status changed during the day.
// onToggle(item, done) / onRemark(item, text) are only given when the list can be edited.
function DailyCheckList({ items, officeTz, onToggle, onRemark, showRemarks = true }) {
  const [editing, setEditing] = useState(null); // { id, text }
  const statuses = [...new Set(items.map((i) => i.vesselStatus))];
  const editable = Boolean(onToggle);

  const saveRemark = (item) => {
    if (editing && editing.id === item._id && editing.text !== (item.remark || "")) onRemark(item, editing.text);
    setEditing(null);
  };

  return (
    <div>
      {statuses.map((st) => (
        <div key={st || "none"}>
          {statuses.length > 1 && <div className={styles.group}>{VESSEL_STATUS_LABEL[st] || st}</div>}
          {items.filter((i) => i.vesselStatus === st).map((item) => (
            <div key={item._id || item.code} className={`${styles.item} ${item.done ? styles.done : ""}`} data-check={item.name}>
              <input type="checkbox" checked={Boolean(item.done)} disabled={!editable} aria-label={item.name}
                onChange={(e) => onToggle(item, e.target.checked)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className={styles.name}>{item.name}</span>
                {item.linkedField && <span className={styles.linked} title="Ticks itself when this date is entered on the voyage">auto: {linkedLabel(item.linkedField)}</span>}
                {item.done && (
                  <div className={styles.meta}>
                    {item.auto ? item.autoNote : "Ticked"}{item.doneBy?.username ? ` · ${item.doneBy.username}` : ""}{item.doneAt ? ` · ${formatInstant(item.doneAt, officeTz, { withUtc: false })}` : ""}
                  </div>
                )}
                {showRemarks && (editing && editing.id === item._id ? (
                  <input className={styles.remarkInput} autoFocus value={editing.text} aria-label={`Remark for ${item.name}`}
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })} onBlur={() => saveRemark(item)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRemark(item); if (e.key === "Escape") setEditing(null); }} />
                ) : (
                  <>
                    {item.remark && <div className={styles.meta}>💬 {item.remark}{item.remarkBy?.username ? ` — ${item.remarkBy.username}` : ""}</div>}
                    {editable && onRemark && item._id && (
                      <button type="button" onClick={() => setEditing({ id: item._id, text: item.remark || "" })}
                        style={{ display: "block", marginTop: 2, background: "none", border: "none", color: "#1570ef", padding: 0, fontSize: "0.78rem", cursor: "pointer" }}>
                        {item.remark ? "Edit remark" : "Add remark"}
                      </button>
                    )}
                  </>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default DailyCheckList;
