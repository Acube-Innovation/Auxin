import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./MobileBottomNavigation.module.css";

function MobileBottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      id: "sales",
      label: "Sales & Leads",
      path: "/salesandleads",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      id: "calendar",
      label: "Calendar",
      path: "/yourcalendar",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      path: "/profile",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <nav className={styles.bottomNavigation}>
      {navItems.map((item) => {
        // mark active when exact or when current path starts with the nav path (handles nested routes)
        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
        return (
          <button
            key={item.id}
            className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            onClick={() => handleNavigation(item.path)}
          >
            <div className={styles.iconContainer}>
              <div className={styles.stateLayer}>{item.icon}</div>
            </div>
            <span className={styles.labelText}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default MobileBottomNavigation;
