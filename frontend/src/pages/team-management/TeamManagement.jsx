import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./TeamManagement.module.css";
import Side from "../sidebar/Sidebar";
import NotificationBell from "../../components/NotificationBell";
import belldot from "../../assets/dashboard/bell-dot.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import TeamMembersTable from "../../components/team-management-components/TeamMembersTable";
import ProfileAvatar from "../../components/ProfileAvatar";
import EmployeeService from "../../services/EmployeeService";
import AttendanceService from "../../services/AttendanceService";

function TeamManagement() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  
  // Stats state
  const [stats, setStats] = useState({
    attendancePercentage: 0,
    totalAssignedProjects: 0,
    totalEmployees: 0
  });

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const employees = await EmployeeService.getEmployees();
      
      // 1. Total Employees
      const totalEmployees = employees.length;

      // 2. Today's Attendance (Percentage of 'Onsite' employees)
      // We fetch today's attendance records to be accurate
      const todayStr = new Date().toISOString().slice(0, 10);
      let presentCount = 0;
      try {
        const todayRecords = await AttendanceService.getByRange(todayStr, todayStr);
        if (Array.isArray(todayRecords)) {
          presentCount = todayRecords.filter(r => r.status === 'Onsite').length;
        }
      } catch (err) {
        console.warn("Failed to fetch today's attendance for stats:", err);
        // Fallback to employee profile status if report fails
        presentCount = employees.filter(emp => emp.attendance === 'Onsite').length;
      }

      const attendancePercentage = totalEmployees > 0 
        ? Math.round((presentCount / totalEmployees) * 100) 
        : 0;

      // 3. Total Assigned Projects (Unique projects assigned across all employees)
      const uniqueProjects = new Set();
      employees.forEach(emp => {
        if (Array.isArray(emp.assignedProjects)) {
          emp.assignedProjects.forEach(proj => {
            // Handle both populated objects and IDs
            const projectId = (typeof proj === 'object' && proj !== null) ? proj._id : proj;
            if (projectId) uniqueProjects.add(projectId.toString());
          });
        }
      });
      const totalAssignedProjects = uniqueProjects.size;

      setStats({
        attendancePercentage,
        totalAssignedProjects,
        totalEmployees
      });

    } catch (error) {
      console.error("Error fetching team stats:", error);
    }
  };

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Team Management</div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell/>
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}
                    </div>
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

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-home"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>Team Management</div>
          </div>
        </section>

        {/* Stats Cards Section */}
        <section className={styles["stats-container"]}>
          {/* Today's Attendance Card */}
          <div className={styles["attendance-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-title-section"]}>
                <div className={styles["card-title"]}>Today's Attendance</div>
                <div className={styles["card-main-stat"]}>
                  <div className={styles["percentage"]}>{stats.attendancePercentage}%</div>
                  <div className={styles["growth-chip"]}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 21 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.695 16.9132V3.7832M10.695 3.7832L5.77124 8.70694M10.695 3.7832L15.6187 8.70694"
                        stroke="#147129"
                        strokeWidth="1.64125"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {/* <span>04%</span> */}
                  </div>
                </div>
              </div>
              <div
                className={styles["iconlink"]}
                onClick={() => navigate("/attendance-management")}
                title="Go to Attendance Management"
                style={{ cursor: "pointer" }}
              >
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>

            {/* Attendance Chart */}
            <div className={styles["attendance-chart"]}>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>M</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>W</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>F</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>S</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "60px", backgroundColor: "#FF801F" }}
                ></div>
                <div className={styles["day-label"]}>Today</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>M</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>W</div>
              </div>
            </div>
          </div>

           <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Assigned Projects</h4>
                {/* <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div> */}
              </div>
              <h2>{stats.totalAssignedProjects}</h2>
              <p className={styles["success-text"]}>
                0.0% down <span>from last week</span>
              </p>
            </div>
          </div>

          <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Employees</h4>
                {/* <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div> */}
              </div>
              <h2>{stats.totalEmployees}</h2>
              <p className={styles["success-text"]}>
                Active Team Members
              </p>
            </div>
          </div>
        </section>

        {/* Team Members Table Section */}
        <section className={styles["main-content"]}>
          <TeamMembersTable />
        </section>
      </main>
    </div>
  );
}

export default TeamManagement;
