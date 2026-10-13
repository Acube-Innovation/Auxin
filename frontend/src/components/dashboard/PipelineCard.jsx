import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./DashboardWidgets.module.css";
import { OPEN_STAGES, CLOSED_STAGES, NO_STAGE, formatMoney, compactMoney } from "./dashboardUtils";

const STAGE_COLOR = { Won: "#147129", "Lost Lead": "#b42318", "Junk Lead": "#98a2b3" };

// Clients and leads per lead status, with opportunity value; a stage opens Sales & Leads filtered on it
function PipelineCard({ clients = [], isLoading = false }) {
  const navigate = useNavigate();
  const [measure, setMeasure] = useState("count"); // "count" | "value"

  const { stages, openValue, openCount, winRate } = useMemo(() => {
    const by = {};
    clients.forEach((c) => {
      const s = c.currentStatus || NO_STAGE;
      by[s] = by[s] || { count: 0, value: 0 };
      by[s].count++;
      by[s].value += parseFloat(c.opportunityValue) || 0;
    });
    // Known stages in pipeline order, then any other status found in the data, then "no stage"
    const others = Object.keys(by).filter((s) => s !== NO_STAGE && !OPEN_STAGES.includes(s) && !CLOSED_STAGES.includes(s)).sort();
    const list = [...OPEN_STAGES, ...others, ...CLOSED_STAGES, NO_STAGE]
      .map((s) => ({ stage: s, count: by[s]?.count || 0, value: by[s]?.value || 0, closed: CLOSED_STAGES.includes(s) }));
    const open = list.filter((s) => !s.closed && s.stage !== NO_STAGE);
    const won = by.Won?.count || 0;
    const lost = by["Lost Lead"]?.count || 0;
    return {
      stages: list,
      openValue: open.reduce((a, s) => a + s.value, 0),
      openCount: open.reduce((a, s) => a + s.count, 0),
      winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
    };
  }, [clients]);

  // Hide empty stages, except keep the open ones so the shape of the pipeline stays visible
  const shown = stages.filter((s) => s.count > 0 || (!s.closed && s.stage !== NO_STAGE));
  const max = Math.max(1, ...shown.map((s) => (measure === "count" ? s.count : s.value)));

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>Pipeline by stage</h3>
          <div className={styles.cardSub}>Click a stage to see its clients and leads</div>
        </div>
        <div className={styles.segmented} role="group" aria-label="Measure">
          <button className={measure === "count" ? styles.segActive : ""} onClick={() => setMeasure("count")} aria-pressed={measure === "count"}>Count</button>
          <button className={measure === "value" ? styles.segActive : ""} onClick={() => setMeasure("value")} aria-pressed={measure === "value"}>Value</button>
        </div>
      </div>

      <div className={styles.summary}>
        <div><div className={styles.summaryValue}>{isLoading ? "--" : openCount}</div><div className={styles.summaryLabel}>open</div></div>
        <div><div className={styles.summaryValue}><span title={formatMoney(openValue)}>{isLoading ? "--" : compactMoney(openValue)}</span></div><div className={styles.summaryLabel}>open value</div></div>
        <div><div className={styles.summaryValue}>{isLoading || winRate === null ? "--" : `${winRate}%`}</div><div className={styles.summaryLabel} title="Won ÷ (Won + Lost Lead)">win rate</div></div>
      </div>

      <div className={styles.stages}>
        {isLoading ? (
          <div className={styles.empty}>Loading…</div>
        ) : (
          shown.map((s) => {
            const v = measure === "count" ? s.count : s.value;
            const label = s.stage === NO_STAGE ? "No stage" : s.stage;
            return (
              <button
                key={s.stage}
                className={styles.stage}
                data-stage={s.stage}
                disabled={s.count === 0}
                onClick={() => navigate(`/salesandleads?status=${encodeURIComponent(s.stage)}`)}
                title={`${label}: ${s.count} · ${formatMoney(s.value)}`}
              >
                <span className={styles.stageName}>{label}</span>
                <span className={styles.stageBar}>
                  <span style={{ width: `${(v / max) * 100}%`, background: STAGE_COLOR[s.stage] || (s.stage === NO_STAGE ? "#d0d5dd" : "#4a53cf") }} />
                </span>
                <span className={styles.stageValue}>{measure === "count" ? s.count : formatMoney(s.value)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default PipelineCard;
