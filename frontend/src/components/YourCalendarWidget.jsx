import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./YourCalendarWidget.module.css";
import arrowupright from "../assets/dashboard/arrow-up-right.svg";

function YourCalendarWidget({ meetings = [], isLoading = false }) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("Today");
  const [displayMeetings, setDisplayMeetings] = useState([]);

  useEffect(() => {
    filterMeetingsByView();
  }, [activeView, meetings]);

  const calculateTimeLeft = (meetingTime) => {
    if (!meetingTime) return null;
    const now = new Date();
    const [hours, minutes] = meetingTime.split(":").map(Number);
    const meetingDateTime = new Date();
    meetingDateTime.setHours(hours, minutes, 0, 0);

    const diffMs = meetingDateTime.getTime() - now.getTime();
    if (diffMs <= 0) return null;

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m left`;
    } else {
      return `${diffMinutes}m left`;
    }
  };

  const filterMeetingsByView = () => {
    const now = new Date();
    const currentDate = new Date(now);
    currentDate.setHours(0, 0, 0, 0);

    let filtered = [];

    if (activeView === "Today") {
      // Today's meetings that are upcoming (meeting time is after current time)
      filtered = meetings.filter((meeting) => {
        if (!meeting.date || !meeting.time) return false;
        const meetingDate = new Date(meeting.date);
        meetingDate.setHours(0, 0, 0, 0);
        if (meetingDate.getTime() !== currentDate.getTime()) return false;

        // Check if meeting time is upcoming
        const [hours, minutes] = meeting.time.split(":").map(Number);
        const meetingDateTime = new Date(meeting.date);
        meetingDateTime.setHours(hours, minutes, 0, 0);
        return meetingDateTime.getTime() > now.getTime();
      });

      // Sort by time ascending
      filtered.sort((a, b) => {
        const timeA = a.time || "23:59";
        const timeB = b.time || "23:59";
        return timeA.localeCompare(timeB);
      });
    } else if (activeView === "Week") {
      // Current week (Monday to Sunday)
      const weekStart = new Date(currentDate);
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
      weekStart.setDate(currentDate.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      filtered = meetings.filter((meeting) => {
        if (!meeting.date) return false;
        const meetingDate = new Date(meeting.date);
        meetingDate.setHours(0, 0, 0, 0);
        return meetingDate >= weekStart && meetingDate <= weekEnd;
      });

      // Sort by date and time
      filtered.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        const timeA = a.time || "23:59";
        const timeB = b.time || "23:59";
        return timeA.localeCompare(timeB);
      });
    } else if (activeView === "Month") {
      // Current month
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0
      );
      monthEnd.setHours(23, 59, 59, 999);

      filtered = meetings.filter((meeting) => {
        if (!meeting.date) return false;
        const meetingDate = new Date(meeting.date);
        meetingDate.setHours(0, 0, 0, 0);
        return meetingDate >= monthStart && meetingDate <= monthEnd;
      });

      // Sort by date and time
      filtered.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        const timeA = a.time || "23:59";
        const timeB = b.time || "23:59";
        return timeA.localeCompare(timeB);
      });
    }

    setDisplayMeetings(filtered.slice(0, 3));
  };

  const handleCalendarNavigate = () => {
    navigate("/yourcalendar");
  };

  const handleTabClick = (view) => {
    setActiveView(view);
  };

  const getTimeSlots = () => {
    return [
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
    ];
  };

  return (
    <div className={styles.calendarWidget}>
      <div className={styles.calendarHeader}>
        <h3 className={styles.calendarTitle}>Your Calendar</h3>
        <button
          className={styles.expandButton}
          onClick={handleCalendarNavigate}
        >
          <img src={arrowupright} alt="expand calendar" />
        </button>
      </div>

      <div className={styles.calendarControls}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleButton} ${
              activeView === "Today" ? styles.active : ""
            }`}
            onClick={() => handleTabClick("Today")}
          >
            Today
          </button>
          <button
            className={`${styles.toggleButton} ${
              activeView === "Week" ? styles.active : ""
            }`}
            onClick={() => handleTabClick("Week")}
          >
            Week
          </button>
          <button
            className={`${styles.toggleButton} ${
              activeView === "Month" ? styles.active : ""
            }`}
            onClick={() => handleTabClick("Month")}
          >
            Month
          </button>
        </div>
      </div>

      <div className={styles.calendarContent}>
        <div className={styles.timeHeaders}>
          <div className={styles.timeLabel}>Morning</div>
          <div className={styles.timeLabel}>Lunch</div>
        </div>

        <div className={styles.timeGrid}>
          {getTimeSlots().map((time) => (
            <div key={time} className={styles.timeSlot}>
              <span className={styles.timeText}>{time}</span>
              <div className={styles.timeDivider}></div>
            </div>
          ))}
        </div>

        <div className={styles.verticalLines}>
          {Array.from({ length: 0 }).map((_, i) => (
            <div key={i} className={styles.verticalLine}></div>
          ))}
        </div>

        <div className={styles.meetingsContainer}>
          {isLoading ? (
            <div className={styles.loadingState}>Loading meetings...</div>
          ) : displayMeetings.length === 0 ? (
            <div className={styles.emptyState}>
              No meetings scheduled for {activeView.toLowerCase()}
            </div>
          ) : (
            displayMeetings.map((meeting, index) => {
              const colors = ["#FF9500", "#007AFF", "#34C759"];
              const bgColor = meeting.color || colors[index % colors.length];
              const meetingLink = meeting.link || meeting.meetingLink;

              const timeLeft =
                activeView === "Today" ? calculateTimeLeft(meeting.time) : null;
              return (
                <div
                  key={meeting._id || meeting.eventId || index}
                  className={styles.meetingCard}
                  style={{
                    backgroundColor: bgColor,
                  }}
                >
                  <div className={styles.meetingBadgeContainer}>
                    <div className={styles.meetingBadge}>Meeting</div>
                    <div className={styles.meetingBadgeTime}>
                      Time: {meeting.time || "N/A"}
                    </div>
                  </div>
                  <div className={styles.meetingTitle}>
                    {meeting.title || meeting.eventName || "Untitled Meeting"}
                  </div>

                  {activeView === "Today" && timeLeft ? (
                    <div className={styles.upcomingInfo}>
                      <div className={styles.meetingBadgeContainer}>
                        <span className={styles.upcomingLabel}>Upcoming</span>
                        <span className={styles.timeLeft}>{timeLeft}</span>
                      </div>
                      {/* Show link in Today view as well */}
                      {meetingLink && (
                        <a
                          href={
                            meetingLink.startsWith("http")
                              ? meetingLink
                              : `https://${meetingLink}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.meetingLink}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {meetingLink}
                        </a>
                      )}
                    </div>
                  ) : meetingLink ? (
                    <a
                      href={
                        meetingLink.startsWith("http")
                          ? meetingLink
                          : `https://${meetingLink}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.meetingLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {meetingLink}
                    </a>
                  ) : (
                    <div className={styles.meetingTime}>
                      {meeting.time || "N/A"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default YourCalendarWidget;
