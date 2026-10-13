import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LuPlus, LuCalendarPlus, LuChartColumn, LuMapPin, LuRefreshCw, LuCircleCheck } from "react-icons/lu";
import styles from "./DashboardWidgets.module.css";
import CheckInModal from "../CheckInModal";
import weather from "../../assets/dashboard/weather.png";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

function sameDay(ts) {
  if (!ts) return false;
  const d = new Date(ts);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// Welcome banner: greeting, what needs attention today, quick actions, site-visit check-in, refresh
function HeroBanner({ username, summary, lastCheckInTime, onCheckInLogged, lastUpdated, isRefreshing, onRefresh, loading }) {
  const navigate = useNavigate();
  const [checkInOpen, setCheckInOpen] = useState(false);
  const checkedIn = sameDay(lastCheckInTime);
  const name = username ? username.charAt(0).toUpperCase() + username.slice(1) : "";
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <section className={styles.hero}>
      <div className={styles.heroGlow} aria-hidden />
      <div className={styles.heroMain}>
        <div className={styles.heroTopLine}>
          <span className={styles.heroDate}>{date}</span>
          <span className={styles.heroUpdated}>
            <span data-testid="dashboard-updated">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Loading…"}</span>
            <button className={styles.heroRefresh} onClick={onRefresh} disabled={isRefreshing} title="Refresh" aria-label="Refresh dashboard">
              <LuRefreshCw className={isRefreshing ? styles.spinning : undefined} aria-hidden />
            </button>
          </span>
        </div>
        <h2 className={styles.heroTitle}>{greeting()}, {name}</h2>
        <p className={styles.heroSummary}>{loading ? "Getting your day ready…" : summary}</p>
        <div className={styles.heroActions}>
          <button className={styles.heroBtnPrimary} onClick={() => navigate("/salesandleads?add=1")}><LuPlus aria-hidden /> Add client / lead</button>
          <button className={styles.heroBtn} onClick={() => navigate("/yourcalendar")}><LuCalendarPlus aria-hidden /> Schedule meeting</button>
          <button className={styles.heroBtn} onClick={() => navigate("/reports")}><LuChartColumn aria-hidden /> Reports</button>
        </div>
      </div>

      <div className={styles.heroSide}>
        <img src={weather} alt="" className={styles.heroArt} />
        <div className={styles.checkPanel} data-testid="checkin-panel">
          <div className={styles.checkStatus}>
            <span className={`${styles.checkDot} ${checkedIn ? styles.checkDotOn : ""}`} aria-hidden />
            {checkedIn ? <>Site visit logged <b>{timeAgo(lastCheckInTime)}</b></> : "No site visit logged today"}
          </div>
          <button className={styles.checkBtn} onClick={() => setCheckInOpen(true)}>
            {checkedIn ? <LuCircleCheck aria-hidden /> : <LuMapPin aria-hidden />} {checkedIn ? "Log another visit" : "Log site visit"}
          </button>
          <div className={styles.checkHint}>Your location is recorded with the visit</div>
        </div>
      </div>

      <CheckInModal
        isOpen={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        onSubmit={() => { setCheckInOpen(false); if (onCheckInLogged) onCheckInLogged(); }}
      />
    </section>
  );
}

export default HeroBanner;
