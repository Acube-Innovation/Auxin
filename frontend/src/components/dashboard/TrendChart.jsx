import React, { useEffect, useMemo, useRef, useState } from "react";
import { LuTable, LuChartSpline } from "react-icons/lu";
import styles from "./DashboardWidgets.module.css";
import UserService from "../../services/UserService";
import { lastMonths, monthlySeries, niceScale, compactMoney, compactNumber, formatMoney, refId } from "./dashboardUtils";

const isWon = (c) => String(c.currentStatus) === "Won" && String(c.relationshipStatus) === "Active";

// One measure at a time: revenue and counts never share an axis
const METRICS = {
  revenue: { label: "Revenue", money: true, note: "Opportunity value of won, active clients, by month created", pick: (list) => list.filter(isWon), value: (c) => parseFloat(c.opportunityValue) || 0 },
  won: { label: "Won deals", note: "Won, active clients, by month created", pick: (list) => list.filter(isWon) },
  added: { label: "New records", note: "Clients and leads added each month", pick: (list) => list.filter((c) => ["Lead", "Client"].includes(String(c.leadType))) },
};

const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 52 };

function TrendChart({ clients = [], isLoading = false }) {
  const [metric, setMetric] = useState("revenue");
  const [months, setMonths] = useState(12);
  const [view, setView] = useState("chart");
  const [hover, setHover] = useState(null);
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState("");
  const isAdmin = localStorage.getItem("role") === "admin";
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    if (isAdmin) UserService.getAllUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 700));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  const m = METRICS[metric];
  const buckets = useMemo(() => lastMonths(months), [months]);
  const seriesByMetric = useMemo(() => {
    const scoped = user ? clients.filter((c) => refId(c.assignedTo) === user) : clients;
    return Object.fromEntries(Object.entries(METRICS).map(([key, def]) => [key, monthlySeries(def.pick(scoped), buckets, def.value)]));
  }, [clients, user, buckets]);
  const values = seriesByMetric[metric];

  const total = values.reduce((a, v) => a + v, 0);
  const best = values.reduce((bi, v, i) => (v > values[bi] ? i : bi), 0);
  const fmt = (v) => (m.money ? formatMoney(v) : v.toLocaleString("en-IN"));
  const fmtTick = (v) => (m.money ? compactMoney(v) : compactNumber(v));

  // Geometry
  let { max, step } = niceScale(Math.max(...values, 0));
  if (!m.money) { step = Math.max(1, Math.ceil(step)); max = step * 4; }
  const plotW = Math.max(120, width - PAD.left - PAD.right);
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (values.length === 1 ? plotW / 2 : (i / (values.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const ticks = Array.from({ length: 5 }, (_, i) => i * step);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const i = Math.round(((px - PAD.left) / plotW) * (values.length - 1));
    setHover(Math.min(values.length - 1, Math.max(0, i)));
  };
  const hi = hover ?? null;
  const tipLeft = hi !== null ? x(hi) : 0;

  return (
    <div className={`${styles.card} ${styles.trendCard}`}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>Sales performance</h3>
          <div className={styles.cardSub}>{m.note}</div>
        </div>
        <div className={styles.filters}>
          {isAdmin && (
            <select className={styles.select} value={user} onChange={(e) => setUser(e.target.value)} aria-label="Employee">
              <option value="">All employees</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.username}</option>)}
            </select>
          )}
          <div className={styles.segmented} role="group" aria-label="Period">
            {[6, 12].map((n) => (
              <button key={n} className={months === n ? styles.segActive : ""} aria-pressed={months === n} onClick={() => setMonths(n)}>{n}M</button>
            ))}
          </div>
          <button className={styles.iconButton} onClick={() => setView(view === "chart" ? "table" : "chart")} title={view === "chart" ? "Show as table" : "Show as chart"} aria-label={view === "chart" ? "Show as table" : "Show as chart"}>
            {view === "chart" ? <LuTable aria-hidden /> : <LuChartSpline aria-hidden />}
          </button>
        </div>
      </div>

      <div className={styles.metricTabs} role="tablist">
        {Object.entries(METRICS).map(([key, def]) => (
          <button key={key} role="tab" aria-selected={metric === key} data-metric={key} className={`${styles.metricTab} ${metric === key ? styles.metricTabActive : ""}`} onClick={() => setMetric(key)}>
            <span className={styles.metricTabLabel}>{def.label}</span>
            <span className={styles.metricTabValue}>
              {isLoading ? "—" : (() => {
                const t = seriesByMetric[key].reduce((a, v) => a + v, 0);
                return def.money ? compactMoney(t) : t.toLocaleString("en-IN");
              })()}
            </span>
          </button>
        ))}
      </div>

      {view === "table" ? (
        <div className={styles.tableWrap} ref={wrapRef}>
          <table className={styles.dataTable}>
            <thead><tr><th>Month</th><th>{m.label}</th></tr></thead>
            <tbody>
              {buckets.map((b, i) => <tr key={i}><td>{b.label} {b.year}</td><td>{fmt(values[i])}</td></tr>)}
              <tr className={styles.totalRow}><td>Total</td><td>{fmt(total)}</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.chartWrap} ref={wrapRef}>
          {isLoading ? (
            <div className={styles.empty} style={{ height: H }}>Loading…</div>
          ) : (
            <>
              <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className={styles.chartSvg} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`${m.label} by month, last ${months} months`}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a53cf" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#4a53cf" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#d0d5dd" : "#eef0f4"} strokeWidth="1" />
                    <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className={styles.axisText}>{fmtTick(t)}</text>
                  </g>
                ))}
                {buckets.map((b, i) => (
                  (months <= 6 || i % 2 === (values.length - 1) % 2) && (
                    <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={`${styles.axisText} ${i === hi ? styles.axisTextActive : ""}`}>{b.label}</text>
                  )
                ))}
                <path d={area} fill="url(#trendFill)" />
                <path d={line} fill="none" stroke="#4a53cf" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {hi !== null && (
                  <>
                    <line x1={x(hi)} x2={x(hi)} y1={PAD.top} y2={y(0)} stroke="#98a2b3" strokeDasharray="3 3" />
                    <circle cx={x(hi)} cy={y(values[hi])} r="5" fill="#4a53cf" stroke="#fff" strokeWidth="2" />
                  </>
                )}
                {hi === null && <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="4.5" fill="#4a53cf" stroke="#fff" strokeWidth="2" />}
                <rect x={PAD.left - 8} y={0} width={plotW + 16} height={H} fill="transparent" />
              </svg>
              {hi !== null && (
                <div className={styles.tooltip} style={{ left: tipLeft, top: y(values[hi]) }} data-flip={tipLeft > width * 0.7 ? "left" : "right"}>
                  <div className={styles.tooltipLabel}>{buckets[hi].label} {buckets[hi].year}</div>
                  <div className={styles.tooltipValue}>{fmt(values[hi])}</div>
                  <div className={styles.tooltipNote}>{m.label}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.trendFoot}>
        <span><b>{isLoading ? "—" : fmt(total)}</b> {m.label.toLowerCase()} in the last {months} months</span>
        {!isLoading && total > 0 && <span>Best month: <b>{buckets[best].label} {buckets[best].year}</b> ({fmt(values[best])})</span>}
      </div>
    </div>
  );
}

export default TrendChart;
