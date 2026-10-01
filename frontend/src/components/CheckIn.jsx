import React, { useState } from "react";
import styles from "./CheckIn.module.css";
import CheckInModal from "./CheckInModal";

function CheckIn({ lastCheckInTime, onCheckInLogged }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogVisit = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleCheckInSubmit = (checkInData) => {
    console.log("Check-in submitted:", checkInData);
    if (onCheckInLogged) {
      onCheckInLogged(); // This will trigger the parent to refresh the last check-in time
    }
    setIsModalOpen(false);
  };

  // Function to calculate time ago
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    
    const now = new Date();
    const checkInTime = new Date(timestamp);
    const diffMs = now - checkInTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ${diffMins % 60}m ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  // Check if there's a check-in today - FIXED LOGIC
  const hasCheckInToday = () => {
    if (!lastCheckInTime) return false;
    
    const checkInDate = new Date(lastCheckInTime);
    const today = new Date();
    
    return (
      checkInDate.getDate() === today.getDate() &&
      checkInDate.getMonth() === today.getMonth() &&
      checkInDate.getFullYear() === today.getFullYear()
    );
  };

  const shouldShowLoggedStatus = hasCheckInToday();

  return (
    <>
      <div className={styles.checkInCard}>
        <div className={styles.checkInHeader}>
          <h3 className={styles.checkInTitle}>Check In</h3>
          <button className={styles.actionButton}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className={styles.checkInContent}>
          {shouldShowLoggedStatus ? (
            // Show logged status when there's a check-in today
            <div className={styles.loggedStatus}>
              <div className={styles.statusIndicator}>
                <div className={styles.statusDot}></div>
                <span className={styles.statusText}>Logged</span>
              </div>
              <h4 className={styles.lastCheckInTitle}>Last Check-in</h4>
              <p className={styles.timeAgo}>{getTimeAgo(lastCheckInTime)}</p>
              <p className={styles.statusDescription}>
                Your location was recorded during the last check-in
              </p>
            </div>
          ) : (
            // Show no entries when no check-in today
            <div className={styles.statusSection}>
              <h4 className={styles.statusTitle}>No Entries today</h4>
              <p className={styles.statusDescription}>
                Click on the button below to log a site visit.
                <br />
                Your location will be collected
              </p>
            </div>
          )}

          <button className={styles.logButton} onClick={handleLogVisit}>
            <span>{shouldShowLoggedStatus ? "Log another visit" : "Log onsite visit"}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="21" viewBox="0 0 20 21" fill="none">
              <path d="M1.72729 10.2407H4.18184M4.18184 10.2407C4.18184 13.4037 6.74603 15.9679 9.90911 15.9679M4.18184 10.2407C4.18184 7.07757 6.74603 4.51338 9.90911 4.51338M15.6364 10.2407H18.0909M15.6364 10.2407C15.6364 13.4037 13.0722 15.9679 9.90911 15.9679M15.6364 10.2407C15.6364 7.07757 13.0722 4.51338 9.90911 4.51338M9.90911 2.05884V4.51338M9.90911 15.9679V18.4225M12.3637 10.2407C12.3637 11.5963 11.2647 12.6952 9.90911 12.6952C8.55351 12.6952 7.45457 11.5963 7.45457 10.2407C7.45457 8.88505 8.55351 7.78611 9.90911 7.78611C11.2647 7.78611 12.3637 8.88505 12.3637 10.2407Z" stroke="white" strokeOpacity="0.9" strokeWidth="1.22727" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <CheckInModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleCheckInSubmit}
      />
    </>
  );
}

export default CheckIn;