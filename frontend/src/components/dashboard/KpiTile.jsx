import React, { useEffect, useMemo, useRef, useState } from "react";
import { LuArrowUpRight, LuArrowDownRight, LuMinus, LuChevronDown, LuCheck } from "react-icons/lu";
import styles from "./DashboardWidgets.module.css";
import { BREAKDOWNS, breakdown } from "./dashboardUtils";

// 12-point trend line: history in the de-emphasis grey, the current month marked in the accent
function Sparkline({ values = [], label }) {
  const w = 96;
  const h = 32;
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const x = (i) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v) => h - 3 - (v / max) * (h - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg className={styles.spark} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path d={d} fill="none" stroke="#c4cad6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r="4" fill="#4a53cf" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}

// Delta vs last month: up is good for every KPI on this dashboard
function Delta({ change }) {
  if (!change) return null;
  const { cur, prev, pct } = change;
  if (pct === null && cur === 0) {
    return <span className={`${styles.delta} ${styles.deltaFlat}`} title="None added this month or last month"><LuMinus aria-hidden /> No change</span>;
  }
  if (pct === null) {
    return <span className={`${styles.delta} ${styles.deltaUp}`} title={`${cur} added this month, none last month`}><LuArrowUpRight aria-hidden /> {cur} new this month</span>;
  }
  const Icon = pct > 0 ? LuArrowUpRight : pct < 0 ? LuArrowDownRight : LuMinus;
  const cls = pct > 0 ? styles.deltaUp : pct < 0 ? styles.deltaDown : styles.deltaFlat;
  return (
    <span className={`${styles.delta} ${cls}`} title={`${cur} added this month vs ${prev} last month`}>
      <Icon aria-hidden /> {pct > 0 ? "+" : ""}{pct}% <span className={styles.deltaNote}>vs last month</span>
    </span>
  );
}

// Total / Daily / Weekly / Month / Yearly / Employee-wise switch with its table (clients and leads tiles)
function BreakdownMenu({ value, onChange, noun }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = BREAKDOWNS.find((b) => b.value === value) || BREAKDOWNS[0];
  return (
    <div className={styles.kpiMenu} ref={ref}>
      <button className={styles.kpiMenuBtn} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} data-breakdown-btn>
        {current.value === "total" ? "Total" : current.label} <LuChevronDown aria-hidden className={open ? styles.flip : undefined} />
      </button>
      {open && (
        <ul className={styles.kpiMenuList} role="listbox" aria-label={`${noun} breakdown`}>
          {BREAKDOWNS.map((b) => (
            <li key={b.value} role="option" aria-selected={value === b.value} data-breakdown={b.value}
              className={value === b.value ? styles.kpiMenuActive : undefined}
              onClick={() => { onChange(b.value); setOpen(false); }}>
              {value === b.value ? <LuCheck aria-hidden /> : <span className={styles.kpiMenuSpacer} />}
              {b.value === "total" ? `Total ${noun.toLowerCase()}` : b.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KpiTile({ id, icon: Icon, tone = "blue", label, value, change, note, trend, trendLabel, onClick, loading, records, noun }) {
  const [view, setView] = useState("total");
  const rows = useMemo(() => (records && view !== "total" ? breakdown(records, view) : []), [records, view]);
  const header = (BREAKDOWNS.find((b) => b.value === view) || {}).header;

  return (
    <div className={styles.kpi} data-kpi-tile={id}>
      {records && <BreakdownMenu value={view} onChange={setView} noun={noun} />}
      <button className={styles.kpiOpen} data-kpi={id} onClick={onClick} title={`Open ${label.toLowerCase()}`}>
        <div className={styles.kpiTop}>
          <span className={`${styles.kpiIcon} ${styles[`tone_${tone}`]}`}><Icon aria-hidden /></span>
          <span className={styles.kpiLabel}>{label}</span>
        </div>
        <div className={styles.kpiMid}>
          <span className={styles.kpiValue}>{loading ? "—" : value}</span>
          {!loading && trend && view === "total" && <Sparkline values={trend} label={trendLabel} />}
        </div>
        {view === "total" && (
          <div className={styles.kpiBottom}>
            {loading ? <span className={styles.deltaNote}>Loading…</span> : change ? <Delta change={change} /> : <span className={styles.kpiNote}>{note}</span>}
          </div>
        )}
      </button>
      {view !== "total" && !loading && (
        <div className={styles.breakdown} data-breakdown-table>
          <div className={styles.breakdownHead}><span>{header}</span><span>{noun}</span></div>
          <div className={styles.breakdownList}>
            {rows.length === 0 ? (
              <div className={styles.breakdownEmpty}>No data available</div>
            ) : rows.map((r, i) => (
              <div key={i} className={styles.breakdownRow}><span>{r.label}</span><b>{r.count}</b></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default KpiTile;
