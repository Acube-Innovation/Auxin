import React, { useState, useEffect } from "react";
import styles from "./SalesAndLeads.module.css";
import Side from "./sidebar/Sidebar";
import LeaveRequestTable from "../components/leave-request/LeaveRequestTable";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";
import NotificationBell from "../components/NotificationBell";
import leaveRequestService from "../services/LeaveRequestService";
import UserService from "../services/UserService";

function LeaveRequests() {
    const [username, setUsername] = useState("");
    const [userRole, setUserRole] = useState("");
    const [leaveBalance, setLeaveBalance] = useState("--");
    const [metrics, setMetrics] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);

    useEffect(() => {
        setUsername(localStorage.getItem("username") || "");
        setUserRole(localStorage.getItem("role") || "");
        fetchMetrics();
        fetchLeaveBalance();
    }, []);

    const fetchLeaveBalance = async () => {
        try {
            const user = await UserService.getMe();
            setLeaveBalance(user.leaveBalance !== undefined ? user.leaveBalance : 21);
        } catch (error) {
            console.error("Error fetching leave balance:", error);
        }
    };

    const fetchMetrics = async () => {
        setIsLoadingMetrics(true);
        try {
            const data = await leaveRequestService.getLeaveRequests();
            const total = data.length;
            const pending = data.filter(r => r.status === "Pending").length;
            const approvedRequests = data.filter(r => r.status === "Approved");
            const approved = approvedRequests.length;
            const rejected = data.filter(r => r.status === "Rejected").length;

            setMetrics({ total, pending, approved, rejected });
        } catch (error) {
            console.error("Error fetching leave metrics:", error);
        } finally {
            setIsLoadingMetrics(false);
        }
    };

    return (
        <div className={styles["dashboard-layout"]}>
            <div className={styles["desktop-sidebar"]}>
                <Side />
            </div>

            <main>
                <header className={styles["dashboard-header"]}>
                    <div className={styles["dashboard-row"]}>
                        <div className={styles["dashboard-title"]}>Leave Management</div>

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
                        <div className={styles["breadcrumb-two"]}>Leave Management</div>
                    </div>
                </section>

                <section className={styles.cardcontainer}>
                    {!(userRole === "admin" || userRole === "hod") && (
                        <div className={styles.cardbox}>
                            <div className={styles.cardboxcontent}>
                                <div className={styles.cardheader}>
                                    <h4>Leave Balance</h4>
                                </div>
                                <h2 style={{ color: "#3b82f6" }}>
                                    {leaveBalance === "--" ? "--" : `${leaveBalance} Days`}
                                </h2>
                            </div>
                        </div>
                    )}

                    <div className={styles.cardbox}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Total Requests</h4>
                            </div>
                            <h2>{isLoadingMetrics ? "--" : metrics.total}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Pending</h4>
                            </div>
                            <h2 style={{ color: "#f97316" }}>{isLoadingMetrics ? "--" : metrics.pending}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Approved</h4>
                            </div>
                            <h2 style={{ color: "#16a34a" }}>{isLoadingMetrics ? "--" : metrics.approved}</h2>
                        </div>
                    </div>

                    <div className={styles.cardbox}>
                        <div className={styles.cardboxcontent}>
                            <div className={styles.cardheader}>
                                <h4>Rejected</h4>
                            </div>
                            <h2 style={{ color: "#dc2626" }}>{isLoadingMetrics ? "--" : metrics.rejected}</h2>
                        </div>
                    </div>
                </section>

                <section className={styles["main-content"]}>
                    <LeaveRequestTable onUpdate={() => { fetchMetrics(); fetchLeaveBalance(); }} />
                </section>
            </main>
            <MobileBottomNavigation />
        </div>
    );
}

export default LeaveRequests;

