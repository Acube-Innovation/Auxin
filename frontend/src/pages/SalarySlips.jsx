import React, { useState, useEffect } from "react";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";
import SalarySlipTable from "../components/salary-slip/SalarySlipTable";

function SalarySlips() {
    const [username, setUsername] = useState("");
    const [userRole, setUserRole] = useState("");

    useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
        setUserRole(localStorage.getItem("role") || "");
    }, []);

    return (
        <div className={styles["dashboard-layout"]}>
            <div className={styles["desktop-sidebar"]}>
                <Side />
            </div>

            <main>
                <header className={styles["dashboard-header"]}>
                    <div className={styles["dashboard-row"]}>
                        <div className={styles["dashboard-title"]}>Salary Slips</div>

                        <div className={styles["dashboard-profile"]}>
                            <NotificationBell />
                            <div className={styles["profile-info"]}>
                                <div className={styles["profile-row"]}>
                                    <ProfileAvatar size={40} className={styles["profile-picture"]} />
                                    <div className={styles["profile-column"]}>
                                        <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                                        <div className={styles["profile-type"]}>{userRole?.toUpperCase()}</div>
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
                        <div className={styles["breadcrumb-two"]}>Salary Slips</div>
                    </div>
                </section>

                <section className={styles["main-content"]}>
                    <SalarySlipTable userRole={userRole} />
                </section>
            </main>
            <MobileBottomNavigation />
        </div>
    );
}

export default SalarySlips;
