import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";
import SalesSummaryService from "../services/SalesSummaryService";

// Sales Summary: the daily Sales & Leads summaries sent to this login (the same content as the email).
const fmt = (d) => new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function SalesSummary() {
  const username = localStorage.getItem("username") || "";
  const userRole = localStorage.getItem("role") || "";
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(null);
  const [current, setCurrent] = useState(null);
  const [error, setError] = useState("");
  const selected = params.get("id");

  useEffect(() => {
    SalesSummaryService.list()
      .then((d) => setItems(d.items || []))
      .catch((e) => { setItems([]); setError(e.message); });
  }, []);

  useEffect(() => {
    const id = selected || (items && items[0] && items[0]._id);
    if (!id) { setCurrent(null); return; }
    SalesSummaryService.get(id).then(setCurrent).catch((e) => setError(e.message));
  }, [selected, items]);

  const activeId = current && current._id;

  return (
    <div className={styles["dashboard-layout"]}>
      <div className={styles["desktop-sidebar"]}><Side /></div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Sales Summary</div>
            <div className={styles["dashboard-profile"]}>
              <NotificationBell />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>{userRole.toUpperCase()}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Sales Summary</div>
          </div>
        </section>

        <section className={styles["main-content"]}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 280px", maxWidth: "100%", background: "#fff", border: "1px solid #eaecf0", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", fontWeight: 600, borderBottom: "1px solid #eaecf0" }}>Daily summaries</div>
              {items === null && <div style={{ padding: 14, color: "#667085" }}>Loading…</div>}
              {items && items.length === 0 && (
                <div style={{ padding: 14, color: "#667085", fontSize: 14 }}>
                  No summaries yet. A summary of the sales team's changes arrives here (and by email) every morning.
                </div>
              )}
              {items && items.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => setParams({ id: m._id })}
                  style={{
                    display: "block", width: "100%", textAlign: "left", padding: "10px 14px", border: "none",
                    borderBottom: "1px solid #f2f4f7", cursor: "pointer",
                    background: m._id === activeId ? "#eff8ff" : "#fff",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#101828" }}>{m.subject.replace(/^Sales & Leads daily summary – /, "")}</div>
                  <div style={{ fontSize: 12, color: "#667085" }}>{fmt(m.at)}</div>
                </button>
              ))}
            </div>
            <div style={{ flex: "1 1 520px", minWidth: 0 }}>
              {error && <div style={{ color: "#b42318", marginBottom: 8 }}>{error}</div>}
              {current && (
                <iframe
                  title="Sales summary"
                  srcDoc={current.html}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  style={{ width: "100%", height: "75vh", border: "1px solid #eaecf0", borderRadius: 10, background: "#fff" }}
                />
              )}
            </div>
          </div>
        </section>
      </main>
      <MobileBottomNavigation />
    </div>
  );
}

export default SalesSummary;
