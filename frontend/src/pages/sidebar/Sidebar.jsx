import React, { useState } from "react";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarAlt,
  FaChartBar,
  FaCog,
  FaFolder,
  FaQuestionCircle,
  FaSignOutAlt,
} from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./Sidebar.module.css";
import DateRangePickerModal from "../../components/DateRangePickerModal";
import useDateRange from "../../hooks/useDateRange";

import auxin_logo from "../../assets/auxin_logo.png";
import users from "../../assets/dashboard/users.svg";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import arrowdownup from "../../assets/dashboard/arrow-down-up.svg";
import belldot from "../../assets/dashboard/bell-dot.svg";
import calendar from "../../assets/dashboard/calendar.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import circlehelp from "../../assets/dashboard/circle-help.svg";
import cloud from "../../assets/dashboard/cloud.svg";
import filechartcolumn from "../../assets/dashboard/file-chart-column.svg";
import icons from "../../assets/dashboard/Icons.svg";
import layoutdashboard from "../../assets/dashboard/layout-dashboard.svg";
import packageicon from "../../assets/dashboard/package.svg";
import scaneye from "../../assets/dashboard/scan-eye.svg";
import settings2 from "../../assets/dashboard/settings-2.svg";
import settings from "../../assets/dashboard/settings.svg";
import userplus from "../../assets/dashboard/user-plus.svg";
import addcontact from "../../assets/dashboard/add-contact.png";
import logout from "../../assets/dashboard/log-out.svg";
import offbutton from "../../assets/dashboard/off-button.png";

function Sidebar() {
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);
  const navigate = useNavigate();
  

  // Fix: Get role directly from localStorage
  const userRole = localStorage.getItem("role"); // This returns a string like "sales_executive"

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role"); // Also clear role on logout
    // Redirect to login page
    navigate("/login", { replace: true });
  };

  // Use the custom date range hook for backend functionality
  const {
    dateRange,
    updateDateRange,
    getFormattedDateRange,
    getCurrentPreset,
  } = useDateRange();

  const handleDateRangeClick = () => {
    setIsDateRangeModalOpen(true);
  };

  const handleDateRangeModalClose = () => {
    setIsDateRangeModalOpen(false);
  };

  const handleDateRangeApply = (startDate, endDate) => {
    updateDateRange(startDate, endDate);
    console.log("Date range selected:", {
      start: startDate,
      end: endDate,
      formatted: getFormattedDateRange(),
      preset: getCurrentPreset(),
    });
    // Here you can add logic to filter data based on the selected date range
    // Example: triggerDataRefresh(startDate, endDate);
  };

  return (
    <div className={styles["sidebar-layout"]}>
      <div className={styles["sidebar-content"]}>
        <div className={styles["auxin-logo"]}>
          <img
            src={auxin_logo}
            alt="Auxin Logo"
            className={styles["auxinlogo-img"]}
          />
        </div>
        <div className={styles["line"]}></div>

        <div className={styles["menu-sections"]}>
          <div className={styles["menu-section-one"]}>
            <p className={styles["section-title"]}>MAIN</p>
            <ul>
              <li className={isActive("/dashboard") ? styles.active : ""}>
                <Link to="/dashboard" className={styles["sidebar-link"]}>
                  <img
                    src={layoutdashboard}
                    alt="Dashboard"
                    className={styles.icon}
                  />
                  Dashboard
                </Link>
              </li>

              {/* */}
                {/* Fixed: Compare userRole directly, not userRole.role */}
              
                <li className={isActive("/teammanagement") ? styles.active : ""}>
                  <Link to="/teammanagement" className={styles["sidebar-link"]}>
                    <img
                      src={users}
                      alt="teamManagement"
                      className={styles.icon}
                    />{" "}
                    Team Management
                  </Link>
                </li>
             

             

              {/* <li>
                <img src={packageicon} alt="Sales" className={styles.icon} /> Sales &
                Leads
              </li>  */}

              <li className={isActive("/salesandleads") ? styles.active : ""}>
                <Link to="/salesandleads" className={styles["sidebar-link"]}>
                  <img
                    src={packageicon}
                    alt="salesandleads"
                    className={styles.icon}
                  />
                  Sales & Leads
                </Link>
              </li>

              <li
                style={{ cursor: "pointer" }}
                className={isActive("/yourcalendar") ? styles.active : ""}
              >
                <Link to="/yourcalendar" className={styles["sidebar-link"]}>
                  <img src={calendar} alt="Calendar" className={styles.icon} />{" "}
                  Calendar
                </Link>
              </li>

              <li className={isActive("/reports") ? styles.active : ""}>
                <Link to="/reports" className={styles["sidebar-link"]}>
                  <img
                    src={filechartcolumn}
                    alt="Reports"
                    className={styles.icon}
                  />
                  Reports
                </Link>
              </li>
              
              <li className={isActive("/checkin-history") ? styles.active : ""}>
                <Link to="/checkin-history" className={styles["sidebar-link"]}>
                  <img
                    src={scaneye}
                    alt="Check-in History"
                    className={styles.icon}
                  />
                  Check-in History
                </Link>
              </li>

               {/* User Management - Admin Only */}
              {userRole === "admin" && (
                <li className={isActive("/user-management") ? styles.active : ""}>
                  <Link to="/user-management" className={styles["sidebar-link"]}>
                    <img
                      src={addcontact}
                      alt="User Management"
                      className={styles.icon}
                    />{" "}
                    User Management
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div className={styles["menu-section-two"]}>
            <p className={styles["section-title"]}>ADDITIONAL</p>
            <ul>
              <li className={isActive("/profile") ? styles.active : ""}>
                <Link to="/profile" className={styles["sidebar-link"]}>
                  <img src={settings} alt="Profile" className={styles.icon} />{" "}
                  Settings
                </Link>
              </li>
              <li>
                <Link to="" className={styles["sidebar-link"]}>
                <img src={cloud} alt="My Files" className={styles.icon} /> My
                Files
               </Link>
              </li>
              <li className={isActive("/help-support") ? styles.active : ""}>
                <Link to="/help-support" className={styles["sidebar-link"]}>
                <img
                  src={circlehelp}
                  alt="Help & Support"
                  className={styles.icon}
                />{" "}
                Help & Support
                </Link>
              </li>
              <li className={styles["logout"]} onClick={handleLogout}>
                 <Link to="" className={styles["sidebar-link"]}>
                <img src={logout} alt="Log Out" className={styles.icon} /> Log
                Out
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className={styles["sidebar-footer-content"]}>
        {/* <div className={styles["view-as-executive"]}>
          <div className={styles["view-as-executive-row"]}>
            <img src={scaneye} alt="View as Executive" />
            <div className={styles["label"]}>View as Executive</div>
          </div>
          <img src={offbutton} alt="View as Executive" height={28} />
        </div> */}

        <div className={styles["line"]}></div>
        <div className={styles["sidebar-footer-text"]}>
          2025 | Powered by <span>Ryzenforge</span>
        </div>
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        isOpen={isDateRangeModalOpen}
        onClose={handleDateRangeModalClose}
        onApplyDateRange={handleDateRangeApply}
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
      />
    </div>
  );
}

export default Sidebar;
