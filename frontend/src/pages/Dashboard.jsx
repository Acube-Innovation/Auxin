import React, { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";
import Side from "./sidebar/Sidebar";
import DashboardOverview from "../components/DashboardOverview";
import CheckIn from "../components/CheckIn";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import NotificationBell from "../components/NotificationBell";

import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";

function Dashboard() {

    const [username, setUsername] = useState("");
    const [userRole, setUserRole] = useState("");
  
    useEffect(() => {
      setUsername(localStorage.getItem("username") || "");
       setUserRole(localStorage.getItem("role") || "");
    }, []);
  

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getCurrentDate = () => {
    const now = new Date();
    const options = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    return `It's ${now.toLocaleDateString("en-US", options)}`;
  };

  return (
    <div className={styles["dashboard-layout"]}>
      {/* Desktop Sidebar */}
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>

      <main className={styles["main-container"]}>
        {/* Mobile Header */}
        {/* <div className={styles["mobile-header"]}>
          <div className={styles["mobile-header-content"]}>
            <div className={styles["mobile-welcome"]}>
              <div className={styles["mobile-greeting"]}>
                {getTimeGreeting()}, {username}
              </div>
              <div className={styles["mobile-date"]}>
                {getCurrentDate()}
              </div>
            </div>
            <div className={styles["mobile-profile"]}>
              <ProfileAvatar size={36} className={styles["mobile-profile-picture"]} />
              <div className={styles["mobile-profile-info"]}>
                <div className={styles["mobile-profile-name"]}>Larry Seth</div>
                <div className={styles["mobile-profile-role"]}>Sales Lead</div>
              </div>
              <img src={chevrondown} alt="" className={styles["mobile-dropdown"]} />
            </div>
          </div>
        </div> */}

        {/* Desktop Header */}
        <header className={styles["desktop-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Dashboard</div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>
                                         {userRole?.toUpperCase()}
                                       </div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        {/* Desktop breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Dashboard</div>
          </div>
        </section>

        {/* Main Content */}
        <section className={styles["main-content"]}>
          {/* Mobile Check In Section */}
          <DashboardOverview />
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
}

export default Dashboard;
