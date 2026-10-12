import React, { useState } from "react";
import OpsLayout from "../../components/operations/OpsLayout";
import { useToast } from "../../context/ToastContext";
import styles from "./masters/Masters.module.css";
import ss from "./OpsSettings.module.css";

// Ops Settings — /operations/settings (wireframe OPS-25; features F2, F4, F5, B7).
// Stand-alone screen for now: values live only in this page and are not saved or used
// by the scheduler, the ETB/ETC suggestions or the reminders until it is connected.

const TIME_ZONES = ["Asia/Kolkata", "Asia/Dubai", "Asia/Muscat", "Asia/Singapore", "Europe/London", "UTC"];
const BEFORE_DUE = ["—", "1 day", "2 days", "3 days"];
const WHILE_OVERDUE = ["—", "Daily", "Every 2 days", "Weekly"];
const OVERDUE_LIMITS = ["1 day", "2 days", "3 days", "5 days", "7 days"];
const NOTIFY_ROLES = [
  { value: "chartering_manager", label: "Chartering Manager" },
  { value: "operations_pricing_manager", label: "Ops & Pricing Manager" },
  { value: "managing_director", label: "Managing Director" },
  { value: "director", label: "Director" },
  { value: "admin", label: "Admin" },
];
const MISSED_CHECKS = ["Include in morning summary", "Escalate to managers", "Ignore"];

const DEFAULTS = {
  general: { officeTimeZone: "Asia/Kolkata", voyageNumberFormat: "VOY-{YYYY}-{####}", morningSummaryTime: "07:30", reminderSendTime: "09:00" },
  suggestions: [
    { type: "Loading", etbHours: "4.8", etcDefault: "qty ÷ rate, else 4 days", etsHours: "0" },
    { type: "Discharging", etbHours: "4.8", etcDefault: "qty ÷ rate, else 4 days", etsHours: "0" },
    { type: "Bunkering", etbHours: "12", etcDefault: "ETB + 12 h", etsHours: "0" },
  ],
  profiles: [
    { profile: "High", beforeDue: "1 day", onDueDate: true, whileOverdue: "Daily" },
    { profile: "Medium", beforeDue: "—", onDueDate: true, whileOverdue: "Daily" },
    { profile: "Low", beforeDue: "—", onDueDate: true, whileOverdue: "—" },
  ],
  channels: { popup: true, email: true },
  escalation: { highAfter: "1 day", otherAfter: "2 days", notifyRoles: ["chartering_manager", "operations_pricing_manager"], missedChecks: "Include in morning summary" },
};

function Field({ label, hint, children }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select className={styles.select} style={{ width: "100%" }} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function OpsSettings() {
  const { showToast } = useToast();
  const [s, setS] = useState(DEFAULTS);

  const setGroup = (group, key, value) => setS((p) => ({ ...p, [group]: { ...p[group], [key]: value } }));
  const setRow = (group, i, key, value) => setS((p) => ({ ...p, [group]: p[group].map((r, j) => (j === i ? { ...r, [key]: value } : r)) }));
  const toggleRole = (role) => setGroup("escalation", "notifyRoles",
    s.escalation.notifyRoles.includes(role) ? s.escalation.notifyRoles.filter((r) => r !== role) : [...s.escalation.notifyRoles, role]);

  const save = () => showToast("Ops Settings is not connected yet. These values are not saved.", "info");

  return (
    <OpsLayout
      title="Ops Settings"
      breadcrumbs={[{ label: "Vessel Operations" }, { label: "Settings" }]}
      actions={<button className={styles.btnPrimary} onClick={save}>Save</button>}
    >
      <div className={styles.page}>
        <div className={styles.readOnlyBanner}>
          Preview screen. These settings are not saved yet and do not change how reminders, suggestions or jobs work.
        </div>

        <div className={ss.grid}>
          <div className={ss.col}>
            <section className={styles.card}>
              <div className={ss.head}><span className={styles.cardTitle}>General</span></div>
              <div className={styles.formGrid}>
                <Field label="Office time zone" hint="Decides “today” for due / overdue and when emails go out">
                  <Select value={s.general.officeTimeZone} options={TIME_ZONES} onChange={(v) => setGroup("general", "officeTimeZone", v)} />
                </Field>
                <Field label="Voyage number format">
                  <input className={styles.input} value={s.general.voyageNumberFormat} onChange={(e) => setGroup("general", "voyageNumberFormat", e.target.value)} />
                </Field>
                <Field label="Morning summary time">
                  <input type="time" className={styles.input} value={s.general.morningSummaryTime} onChange={(e) => setGroup("general", "morningSummaryTime", e.target.value)} />
                </Field>
                <Field label="Reminder send time">
                  <input type="time" className={styles.input} value={s.general.reminderSendTime} onChange={(e) => setGroup("general", "reminderSendTime", e.target.value)} />
                </Field>
              </div>
            </section>

            <section className={styles.card}>
              <div className={ss.head}>
                <span className={styles.cardTitle}>ETB / ETC suggestions</span>
                <span className={styles.subtle}>Defaults from the OPS sheet formulas</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Port type</th><th>ETB = ETA +</th><th>ETC default</th><th>ETS = ETC +</th></tr></thead>
                  <tbody>
                    {s.suggestions.map((r, i) => (
                      <tr key={r.type}>
                        <td>{r.type}</td>
                        <td><div className={ss.unit}><input className={styles.input} inputMode="decimal" value={r.etbHours} onChange={(e) => setRow("suggestions", i, "etbHours", e.target.value)} /><span>h</span></div></td>
                        <td><input className={styles.input} style={{ minWidth: 190 }} value={r.etcDefault} onChange={(e) => setRow("suggestions", i, "etcDefault", e.target.value)} /></td>
                        <td><div className={ss.unit}><input className={styles.input} inputMode="decimal" value={r.etsHours} onChange={(e) => setRow("suggestions", i, "etsHours", e.target.value)} /><span>h</span></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className={ss.col}>
            <section className={styles.card}>
              <div className={ss.head}>
                <span className={styles.cardTitle}>Reminder profiles</span>
                <span className={styles.subtle}>Adjustable per profile and per template</span>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Profile</th><th>Before due</th><th>On due date</th><th>While overdue</th></tr></thead>
                  <tbody>
                    {s.profiles.map((r, i) => (
                      <tr key={r.profile}>
                        <td>{r.profile}</td>
                        <td><Select value={r.beforeDue} options={BEFORE_DUE} onChange={(v) => setRow("profiles", i, "beforeDue", v)} /></td>
                        <td><input type="checkbox" checked={r.onDueDate} onChange={(e) => setRow("profiles", i, "onDueDate", e.target.checked)} aria-label={`${r.profile}: remind on due date`} /></td>
                        <td><Select value={r.whileOverdue} options={WHILE_OVERDUE} onChange={(v) => setRow("profiles", i, "whileOverdue", v)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={ss.channels}>
                <span className={styles.subtle}>Channels:</span>
                <label className={styles.checkRow}><input type="checkbox" checked={s.channels.popup} onChange={(e) => setGroup("channels", "popup", e.target.checked)} /> Pop-up / bell</label>
                <label className={styles.checkRow}><input type="checkbox" checked={s.channels.email} onChange={(e) => setGroup("channels", "email", e.target.checked)} /> Email</label>
              </div>
            </section>

            <section className={styles.card}>
              <div className={ss.head}>
                <span className={styles.cardTitle}>Escalation</span>
                <span className={styles.subtle}>Admin only</span>
              </div>
              <div className={styles.formGrid}>
                <Field label="High overdue more than">
                  <Select value={s.escalation.highAfter} options={OVERDUE_LIMITS} onChange={(v) => setGroup("escalation", "highAfter", v)} />
                </Field>
                <Field label="Medium / Low overdue more than">
                  <Select value={s.escalation.otherAfter} options={OVERDUE_LIMITS} onChange={(v) => setGroup("escalation", "otherAfter", v)} />
                </Field>
                <div className={`${styles.field} ${styles.full}`}>
                  <label>Notify roles</label>
                  <div className={ss.roles}>
                    {NOTIFY_ROLES.map((r) => (
                      <label key={r.value} className={styles.checkRow}>
                        <input type="checkbox" checked={s.escalation.notifyRoles.includes(r.value)} onChange={() => toggleRole(r.value)} /> {r.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Field label="Missed daily checks">
                  <Select value={s.escalation.missedChecks} options={MISSED_CHECKS} onChange={(v) => setGroup("escalation", "missedChecks", v)} />
                </Field>
              </div>
            </section>
          </div>
        </div>
      </div>
    </OpsLayout>
  );
}

export default OpsSettings;
