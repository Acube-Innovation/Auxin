import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuArrowUpRight, LuVideo, LuCalendarPlus } from "react-icons/lu";
import styles from "./DashboardWidgets.module.css";
import { dayKey, localKey, formatTime, absoluteLink } from "./dashboardUtils";

function minutesUntil(time) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return null;
  const now = new Date();
  return h * 60 + (m || 0) - (now.getHours() * 60 + now.getMinutes());
}

// Next 7 days as a strip; the chosen day's meetings and client events listed below in time order
function ScheduleCard({ meetings = [], isLoading = false }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [, tick] = useState(0);
  // keep "In 20 min" / "Now" current
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = localKey(d);
      const items = meetings.filter((m) => dayKey(m.date) === key).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      return { key, d, items };
    });
  }, [meetings]);
  const day = days[selected];
  const dayName = selected === 0 ? "today" : selected === 1 ? "tomorrow" : day.d.toLocaleDateString("en-GB", { weekday: "long" });

  const open = (m) => navigate(m.clientId ? `/salesandleadsclient/${m.clientId}` : "/yourcalendar");

  return (
    <div className={`${styles.card} ${styles.scheduleCard}`}>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>Schedule</h3>
          <div className={styles.cardSub}>Meetings and client events, next 7 days</div>
        </div>
        <button className={styles.iconButton} onClick={() => navigate("/yourcalendar")} title="Open calendar" aria-label="Open calendar"><LuArrowUpRight aria-hidden /></button>
      </div>

      <div className={styles.weekStrip} role="tablist" aria-label="Day">
        {days.map((d, i) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={selected === i}
            data-day={i}
            className={`${styles.dayCell} ${selected === i ? styles.dayActive : ""}`}
            onClick={() => setSelected(i)}
          >
            <span className={styles.dayName}>{i === 0 ? "Today" : d.d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
            <span className={styles.dayNum}>{d.d.getDate()}</span>
            <span className={styles.dayDots} aria-label={`${d.items.length} events`}>
              {d.items.slice(0, 3).map((_, j) => <i key={j} />)}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {isLoading ? (
          <div className={styles.empty}>Loading…</div>
        ) : day.items.length === 0 ? (
          <div className={styles.emptyState}>
            <div>Nothing scheduled for {dayName}.</div>
            <button className={styles.ghostBtn} onClick={() => navigate("/yourcalendar")}><LuCalendarPlus aria-hidden /> Schedule a meeting</button>
          </div>
        ) : (
          day.items.map((m, i) => {
            const mins = selected === 0 ? minutesUntil(m.time) : null;
            let status = null;
            if (mins !== null) {
              if (mins < -60) status = { label: "Earlier", cls: styles.pillGrey };
              else if (mins <= 0) status = { label: "Now", cls: styles.pillRed };
              else if (mins <= 60) status = { label: `In ${mins} min`, cls: styles.pillAmber };
            }
            const link = m.link || m.meetingLink;
            return (
              <div key={m._id || m.eventId || i} className={`${styles.event} ${status?.label === "Earlier" ? styles.eventPast : ""}`} data-agenda={m.title || m.eventName}>
                <div className={styles.eventTime}>
                  <span>{formatTime(m.time)}</span>
                </div>
                <span className={styles.eventBar} style={{ background: m.color || "#4a53cf" }} />
                <button className={styles.eventBody} onClick={() => open(m)} title={m.clientId ? "Open client" : "Open calendar"}>
                  <div className={styles.rowTitle}>{m.title || m.eventName || "Untitled"}</div>
                  <div className={styles.rowMeta}>{[m.clientName, m.eventType].filter(Boolean).join(" · ") || "Meeting"}</div>
                </button>
                <div className={styles.eventActions}>
                  {status && <span className={`${styles.pill} ${status.cls}`}>{status.label}</span>}
                  {link && <a className={styles.joinBtn} href={absoluteLink(link)} target="_blank" rel="noopener noreferrer"><LuVideo aria-hidden /> Join</a>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ScheduleCard;
