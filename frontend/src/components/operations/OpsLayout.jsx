import React from "react";
import { Link } from "react-router-dom";
import Sidebar from "../../pages/sidebar/Sidebar";
import NotificationBell from "../NotificationBell";
import ProfileAvatar from "../ProfileAvatar";
import MobileBottomNavigation from "../MobileBottomNavigation";
import chevronright from "../../assets/dashboard/chevron-right.svg";
import styles from "./OpsLayout.module.css";

// Page shell for Vessel Operations pages (same look as the Phase 1 pages).
// breadcrumbs: [{ label, to? }] — the last item is the current page.
function OpsLayout({ title, breadcrumbs = [], actions, children }) {
  const username = localStorage.getItem("username") || "";
  const role = (localStorage.getItem("role") || "").replace(/_/g, " ");

  return (
    <div className={styles.layout}>
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.title}>{title}</div>
          <div className={styles.profile}>
            <NotificationBell />
            <div className={styles.profileRow}>
              <ProfileAvatar size={40} />
              <div className={styles.profileColumn}>
                <div className={styles.profileName}>{username.toUpperCase()}</div>
                <div className={styles.profileType}>{role.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.breadcrumbBar}>
          <div className={styles.breadcrumb}>
            <Link to="/dashboard" className={styles.crumbLink}>Home</Link>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={`${crumb.label}-${i}`}>
                <img src={chevronright} alt="" />
                {crumb.to && i < breadcrumbs.length - 1 ? (
                  <Link to={crumb.to} className={styles.crumbLink}>{crumb.label}</Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? styles.crumbActive : styles.crumbText}>{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </section>

        <div className={styles.content}>{children}</div>
      </main>
      <MobileBottomNavigation />
    </div>
  );
}

export default OpsLayout;
