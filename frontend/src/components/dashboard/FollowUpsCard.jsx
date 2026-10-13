import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./DashboardWidgets.module.css";
import { LuArrowUpRight, LuCircleCheck } from "react-icons/lu";
import { followUpBuckets, formatDay, initials } from "./dashboardUtils";

const TABS = ["Overdue", "Today", "Next 7 days"];
const MAX_ROWS = 6;

function dueLabel(days, key) {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "Today";
  if (days === 1) return `Tomorrow · ${formatDay(key)}`;
  return `In ${days} days · ${formatDay(key)}`;
}

// Clients and leads whose follow-up date is overdue, today or in the next 7 days
function FollowUpsCard({ clients = [], isLoading = false }) {
  const navigate = useNavigate();

  const groups = useMemo(() => followUpBuckets(clients), [clients]);

  // Open on the most urgent tab that has something in it
  const [tab, setTab] = useState(null);
  useEffect(() => {
    if (tab === null && !isLoading && clients.length) setTab(TABS.find((t) => groups[t].length) || "Overdue");
  }, [tab, isLoading, clients.length, groups]);
  const activeTab = tab || "Overdue";
  const rows = groups[activeTab];

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>Follow-ups</h3>
          <div className={styles.cardSub}>Next contact date on clients and leads</div>
        </div>
        <button className={styles.iconButton} onClick={() => navigate("/salesandleads")} title="Open Sales & Leads" aria-label="Open Sales & Leads"><LuArrowUpRight aria-hidden /></button>
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            data-fu-tab={t}
            aria-selected={activeTab === t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
            <span className={`${styles.tabCount} ${t === "Overdue" && groups[t].length ? styles.tabCountAlert : ""}`}>{isLoading ? "–" : groups[t].length}</span>
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.empty}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className={styles.emptyState}>
            <LuCircleCheck className={styles.emptyIcon} aria-hidden />
            <div>{activeTab === "Overdue" ? "Nothing overdue. Well done!" : activeTab === "Today" ? "No follow-ups due today." : "No follow-ups in the next 7 days."}</div>
            <div className={styles.emptyHint}>Set a follow-up date on a client or lead to see it here.</div>
          </div>
        ) : (
          rows.slice(0, MAX_ROWS).map(({ client: c, key, days }) => (
            <button key={c._id} className={styles.row} onClick={() => navigate(`/salesandleadsclient/${c._id}`)} data-followup={c.companyName}>
              <span className={`${styles.avatar} ${days < 0 ? styles.avatarRed : ""}`} aria-hidden>{initials(c.companyName)}</span>
              <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{c.companyName}</div>
                <div className={styles.rowMeta}>
                  {[c.leadType, c.currentStatus, c.primaryContactName].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <span className={`${styles.pill} ${days < 0 ? styles.pillRed : days === 0 ? styles.pillAmber : styles.pillGreen}`}>{dueLabel(days, key)}</span>
            </button>
          ))
        )}
        {!isLoading && rows.length > MAX_ROWS && (
          <button className={styles.moreLink} onClick={() => navigate("/salesandleads")}>+{rows.length - MAX_ROWS} more in Sales & Leads</button>
        )}
      </div>
    </div>
  );
}

export default FollowUpsCard;
