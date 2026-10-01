import React, { useCallback, useEffect, useMemo, useState } from "react";
import OpsMasterService from "../../../services/OpsMasterService";
import { useToast } from "../../../context/ToastContext";
import styles from "./Masters.module.css";

// Daily check sets per vessel status (feature A5)
function DailyCheckSetsMaster({ canEdit, meta }) {
  const { showToast } = useToast();
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const statuses = useMemo(() => meta?.vesselStatuses?.filter((s) => s.value !== "REDELIVERED") || [], [meta]);
  const linkedLabel = useMemo(() => new Map((meta?.linkedFields || []).map((f) => [f.value, f.label])), [meta]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSets(await OpsMasterService.getDailyCheckSets());
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!status && statuses.length) setStatus(statuses[0].value); }, [status, statuses]);

  useEffect(() => {
    const set = sets.find((s) => s.vesselStatus === status);
    setItems(set ? set.items.map((i) => ({ ...i })) : []);
    setDirty(false);
  }, [sets, status]);

  const choose = (value) => {
    if (dirty && !window.confirm("You have unsaved changes on this checklist. Discard them?")) return;
    setStatus(value);
  };

  const update = (index, patch) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    setDirty(true);
  };
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setDirty(true);
  };
  const remove = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };
  const add = () => {
    setItems((prev) => [...prev, { name: "", linkedField: null, isActive: true, sourceTag: "USER" }]);
    setDirty(true);
  };

  const save = async () => {
    if (items.some((i) => !i.name || !i.name.trim())) return showToast("Every check needs a name (or remove the empty row)", "error");
    setSaving(true);
    try {
      await OpsMasterService.saveDailyCheckSet(status, items.map((i) => ({ _id: i._id, code: i.code, name: i.name.trim(), linkedField: i.linkedField || null, isActive: i.isActive })));
      showToast("Daily checks saved", "success");
      await load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const countFor = (value) => (sets.find((s) => s.vesselStatus === value)?.items || []).filter((i) => i.isActive).length;
  const label = statuses.find((s) => s.value === status)?.label || "";

  return (
    <div className={styles.card}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.cardTitle}>Daily Check Sets</div>
          <span className={styles.subtle}>Each day, every active vessel shows the checks for its current status.</span>
        </div>
      </div>
      {!canEdit && <div className={styles.readOnlyBanner}>View only. Only an admin can change the daily checks.</div>}

      <div className={styles.split}>
        <div className={styles.statusList}>
          {statuses.map((s) => (
            <button key={s.value} className={`${styles.statusItem} ${status === s.value ? styles.statusItemActive : ""}`} onClick={() => choose(s.value)}>
              <span>{s.label}</span>
              <span className={styles.subtle}>{loading ? "" : countFor(s.value)}</span>
            </button>
          ))}
        </div>

        <div>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <b>{label}</b>
              {dirty && <span className={styles.unsaved}>Unsaved changes</span>}
            </div>
            {canEdit && (
              <div className={styles.toolbarLeft}>
                <button className={styles.btnSecondary} onClick={add}>+ Add check</button>
                <button className={styles.btnPrimary} onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            )}
          </div>

          <div className={`${styles.itemRow} ${styles.itemRowHead}`}>
            <span>#</span><span>Check</span><span>Ticks itself when this is updated</span><span>Active</span><span />
          </div>
          {items.length === 0 && <div className={styles.empty}>No checks for this status</div>}
          {items.map((item, i) => (
            <div key={item._id || `new-${i}`} className={styles.itemRow} style={item.isActive ? undefined : { opacity: 0.55 }}>
              <span className={styles.itemNo}>{i + 1}</span>
              <div>
                {canEdit ? (
                  <input className={styles.input} value={item.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Check name" aria-label={`Check ${i + 1}`} />
                ) : item.name}
                {item.sourceNote && <div className={styles.note}>{item.sourceNote}</div>}
              </div>
              <div>
                {canEdit ? (
                  <select className={`${styles.select} ${styles.input}`} value={item.linkedField || ""} onChange={(e) => update(i, { linkedField: e.target.value || null })} aria-label="Linked field">
                    <option value="">— (tick manually)</option>
                    {(meta?.linkedFields || []).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                ) : <span className={styles.subtle}>{item.linkedField ? linkedLabel.get(item.linkedField) : "—"}</span>}
              </div>
              <div>
                <input type="checkbox" checked={item.isActive} disabled={!canEdit} onChange={(e) => update(i, { isActive: e.target.checked })} aria-label="Active" />
              </div>
              <div>
                {canEdit && (
                  <>
                    <button className={styles.btnLink} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">▲</button>
                    <button className={styles.btnLink} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">▼</button>
                    <button className={styles.btnLink} style={{ color: "#d92d20" }} onClick={() => remove(i)} aria-label="Remove">✕</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DailyCheckSetsMaster;
