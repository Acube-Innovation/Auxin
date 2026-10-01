import React, { useState, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import getDay from "date-fns/getDay";
import isSameDay from "date-fns/isSameDay";
import isSameWeek from "date-fns/isSameWeek";
import isSameMonth from "date-fns/isSameMonth";
import "react-big-calendar/lib/css/react-big-calendar.css";
import styles from "../../components/team-management-components/MeetingsTable.module.css";
import MobileBottomNavigation from "../../components/MobileBottomNavigation";
import DateRangePickerModal from "../../components/DateRangePickerModal";
import { getAllEvents } from "../../services/MeetingService";

const locales = {
  "en-US": require("date-fns/locale/en-US"),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const YourCalendarMeetings = ({ events: externalEvents, onEdit, onDelete }) => {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: new Date(),
    end: new Date(),
  });

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    switch (view) {
      case Views.DAY:
        return isSameDay(date, now);
      case Views.WEEK:
        return isSameWeek(date, now);
      case Views.MONTH:
        return isSameMonth(date, now);
      default:
        return false;
    }
  }, [view, date]);

  const [events, setEvents] = useState([]);

  useEffect(() => {
    // If parent provided events (merged client events + meetings), map them into calendar shape.
    if (externalEvents && externalEvents.length) {
      try {
        const mapped = (externalEvents || []).map((e, idx) => {
          // support multiple possible shapes: { date, time } or { start } or meeting.meta
          let dateObj = null;
          if (e.date) dateObj = new Date(e.date);
          else if (e.start) dateObj = new Date(e.start);
          else if (e.meta?.meeting?.date)
            dateObj = new Date(e.meta.meeting.date);
          else dateObj = new Date();

          const timeStr =
            e.time ||
            e.meta?.meeting?.time ||
            (e.start ? new Date(e.start).toTimeString().slice(0, 5) : "09:00");
          const [hh, mm] = (timeStr || "09:00").split(":");
          const start = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate(),
            parseInt(hh || "9", 10),
            parseInt(mm || "0", 10)
          );
          const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour

          // determine color (prefer top-level color, then meta.meeting.color, then default)
          const chosenColor =
            e.color || e.meta?.meeting?.color || e.meta?.color || "#FF9500";
          // set light border; calendar libraries often use backgroundColor/textColor
          const bg = chosenColor;
          const border = chosenColor;
          // basic text color contrast: use white for dark-ish swatches
          const textColor = [
            "#007AFF",
            "#34C759",
            "#30B0C7",
            "#FF9500",
          ].includes(chosenColor)
            ? "#ffffff"
            : "#000000";

          return {
            id: e._id || e.eventId || e.id || idx,
            title:
              e.eventName ||
              e.title ||
              (e.clientName ? `${e.clientName} - Event` : "Event"),
            start,
            end,
            color: chosenColor,
            backgroundColor: bg,
            borderColor: border,
            textColor,
            extendedProps: {
              color: chosenColor,
              raw: e,
              clientId: e.clientId || e.meta?.meeting?.clientId || null,
            },
            link: e.link || e.meta?.meeting?.link || null,
            clientId: e.clientId || e.meta?.meeting?.clientId || null,
            clientName: e.clientName || e.meta?.meeting?.clientName || null,
            notes:
              e.notes || e.meta?.meeting?.notes || e.meta?.event?.notes || "",
            assignedTeamMembers:
              e.assignedTeamMembers ||
              e.meta?.meeting?.assignedTeamMembers ||
              e.meta?.event?.assignedTeamMembers ||
              [],
          };
        });
        setEvents(mapped);
      } catch (err) {
        console.error("Failed to map external events for calendar:", err);
        setEvents([]);
      }
      return;
    }

    // Fallback: fetch aggregated client events when no external events passed
    (async () => {
      try {
        const all = await getAllEvents();
        const mapped = (all || []).map((e, idx) => {
          const date = e.date ? new Date(e.date) : new Date();
          const [hh, mm] = (e.time || "09:00").split(":");
          const start = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            parseInt(hh || "9", 10),
            parseInt(mm || "0", 10)
          );
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          return {
            id: e._id || idx,
            title:
              e.eventName ||
              e.title ||
              (e.clientName ? `${e.clientName} - Event` : "Event"),
            start,
            end,
            color: e.color || "#FF9500",
            link: e.link,
            clientId: e.clientId,
            clientName: e.clientName,
            notes: e.notes || e.meta?.event?.notes || "",
          };
        });
        setEvents(mapped);
      } catch (err) {
        console.error("Failed to fetch client events for calendar:", err);
        setEvents([]);
      }
    })();
  }, [externalEvents]);

  const handleNavigate = (newDate) => {
    setDate(newDate);
  };

  const handleView = (newView) => {
    setView(newView);
  };

  const handleSelectEvent = (event) => {
    setSelectedMeeting(event);
  };

  const closeMeetingModal = () => {
    setSelectedMeeting(null);
  };

  const handlePeriodClick = () => {
    setIsDateRangeModalOpen(true);
  };

  const handleDateRangeModalClose = () => {
    setIsDateRangeModalOpen(false);
  };

  const handleApplyDateRange = (startDate, endDate) => {
    setDateRange({ start: startDate, end: endDate });
    setDate(startDate); // Update the calendar view to the start date
    // You can add additional logic here to filter events based on the date range
    console.log("Applied date range:", startDate, "to", endDate);
  };

  const eventStyleGetter = (event, start, end, isSelected) => {
    if (view === Views.MONTH) {
      return {
        style: {
          backgroundColor: "transparent",
          color: event.color,
          border: "none",
          padding: "0",
          boxShadow: "none",
        },
      };
    } else {
      return {
        style: {
          backgroundColor: event.color,
          color: "white",
          borderRadius: "4px",
          border: "none",
          padding: "4px 8px",
          opacity: 0.9,
        },
      };
    }
  };

  const dayPropGetter = (date) => {
    const isCurrentDate = date.toDateString() === new Date().toDateString();
    return {
      style: {
        backgroundColor: isCurrentDate ? "white" : "white",
      },
    };
  };

  const customComponents = {
    event: ({ event }) => (
      <div className={styles["rbc-custom-event"]}>
        {view === Views.MONTH ? (
          <div className={styles["meetingcontent"]}>
            <span style={{ backgroundColor: event.color }}></span>
            <div className={styles["event-title"]}>{event.title}</div>
          </div>
        ) : (
          <div className={styles["event-content"]}>
            <div className={styles["event-title"]}>{event.title}</div>
            {event.link && (
              <div className={styles["event-link"]}>{event.link}</div>
            )}
          </div>
        )}
      </div>
    ),
    timeSlotWrapper: (props) => {
      if (view === Views.DAY) {
        return (
          <div className={styles["rbc-time-slot-wrapper"]}>
            {props.children}
          </div>
        );
      }
      return props.children;
    },
    toolbar: (props) => (
      <div className={styles["calendar-header"]}>
        <div className={styles["calendar-navigation"]}>
          <button
            className={styles["nav-button"]}
            onClick={() => props.onNavigate("PREV")}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.0732 8.67289C16.8988 8.49812 16.6621 8.3999 16.4152 8.3999C16.1683 8.3999 15.9316 8.49812 15.7572 8.67289L11.4732 12.9569C11.1092 13.3209 11.1092 13.9089 11.4732 14.2729L15.7572 18.5569C16.1212 18.9209 16.7092 18.9209 17.0732 18.5569C17.4372 18.1929 17.4372 17.6049 17.0732 17.2409L13.4519 13.6102L17.0732 9.98889C17.4372 9.62489 17.4279 9.02756 17.0732 8.67289Z"
                fill="#C3CAD9"
              />
            </svg>
          </button>
          <div className={styles["current-period"]} onClick={handlePeriodClick}>
            {view === Views.MONTH &&
              (isCurrentPeriod ? "This Month" : format(date, "MMMM yyyy"))}
            {view === Views.WEEK &&
              (isCurrentPeriod
                ? "This Week"
                : `${format(startOfWeek(date), "MMMM d")} - ${format(
                    endOfWeek(date),
                    "MMMM d, yyyy"
                  )}`)}
            {view === Views.DAY &&
              (isCurrentPeriod ? "Today" : format(date, "EEEE, MMMM d"))}
          </div>
          <button
            className={styles["nav-button"]}
            onClick={() => props.onNavigate("NEXT")}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11.4732 8.67408C11.1092 9.03808 11.1092 9.62608 11.4732 9.99008L15.0945 13.6114L11.4732 17.2327C11.1092 17.5967 11.1092 18.1847 11.4732 18.5487C11.8372 18.9127 12.4252 18.9127 12.7892 18.5487L17.0732 14.2647C17.4372 13.9007 17.4372 13.3127 17.0732 12.9487L12.7892 8.66475C12.4345 8.31008 11.8372 8.31008 11.4732 8.67408Z"
                fill="#C3CAD9"
              />
            </svg>
          </button>
        </div>
        <div className={styles["view-toggle"]}>
          <button
            className={`${styles["toggle-button"]} ${
              view === Views.DAY ? styles["active"] : ""
            }`}
            onClick={() => handleView(Views.DAY)}
          >
            Day
          </button>
          <button
            className={`${styles["toggle-button"]} ${
              view === Views.WEEK ? styles["active"] : ""
            }`}
            onClick={() => handleView(Views.WEEK)}
          >
            Week
          </button>
          <button
            className={`${styles["toggle-button"]} ${
              view === Views.MONTH ? styles["active"] : ""
            }`}
            onClick={() => handleView(Views.MONTH)}
          >
            Month
          </button>
        </div>
      </div>
    ),
    timeGutterHeader: () => (
      <div className={styles["time-header"]}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M9.99 0C4.47 0 0 4.48 0 10C0 15.52 4.47 20 9.99 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 9.99 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18ZM9.78 5H9.72C9.32 5 9 5.32 9 5.72V10.44C9 10.79 9.18 11.12 9.49 11.3L13.64 13.79C13.98 13.99 14.42 13.89 14.62 13.55C14.83 13.21 14.72 12.76 14.37 12.56L10.5 10.26V5.72C10.5 5.32 10.18 5 9.78 5Z"
            fill="#C3CAD9"
          />
        </svg>
      </div>
    ),
    week: {
      header: ({ date }) => (
        <div className={styles["week-day-name"]}>{format(date, "EEEE d")}</div>
      ),
    },
    day: {
      header: ({ date }) => (
        <div className={styles["day-name-header"]}>
          {format(date, "EEEE d")}
        </div>
      ),
    },
  };

  return (
    <div className={styles["calendar-container"]}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        view={view}
        onView={handleView}
        date={date}
         min={new Date(0, 0, 0, 9, 0, 0)} // Set minimum time to 9:00 AM
         max={new Date(0, 0, 0, 23, 0, 0)} // Set maximum time to 8:00 PM
        onNavigate={handleNavigate}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        components={customComponents}
        defaultView={Views.MONTH}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
      />

      {selectedMeeting && (
        <div className={styles["meeting-modal"]} onClick={closeMeetingModal}>
          <div
            className={styles["meeting-modal-content"]}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles["modal-header"]}>
              <div className={styles["meeting-chip"]}>
                <span>Meeting</span>
                <span style={{ margin: '0 8px', opacity: 0.7 }}>|</span>
                <span>
                                  {format(selectedMeeting.start, 'h:mm a')}
                                </span>
              </div>
              <div className={styles["modal-actions"]}>
                {/* Edit: close small popup first, then ask parent to open edit modal */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  onClick={() => {
                    closeMeetingModal();
                    onEdit && onEdit(selectedMeeting);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d="M8.00031 13.3332H14.0003M10.0003 3.33316L12.0003 5.33316M10.9176 2.41449C11.183 2.1491 11.543 2 11.9183 2C12.2936 2 12.6536 2.1491 12.919 2.41449C13.1844 2.67988 13.3335 3.03983 13.3335 3.41516C13.3335 3.79048 13.1844 4.15043 12.919 4.41582L4.91231 12.4232C4.75371 12.5818 4.55766 12.6978 4.34231 12.7605L2.42764 13.3192C2.37028 13.3359 2.30947 13.3369 2.25158 13.3221C2.1937 13.3072 2.14086 13.2771 2.09861 13.2349C2.05635 13.1926 2.02624 13.1398 2.01141 13.0819C1.99658 13.024 1.99758 12.9632 2.01431 12.9058L2.57298 10.9912C2.63579 10.776 2.75181 10.5802 2.91031 10.4218L10.9176 2.41449Z"
                    stroke="#FF9500"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                {/* Delete: close small popup and request parent delete (opens confirmation) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  onClick={() => {
                    closeMeetingModal();
                    onDelete && onDelete(selectedMeeting);
                  }}
                  style={{ cursor: "pointer", marginLeft: 8 }}
                >
                  <path
                    d="M2 3.99967H14M12.6667 3.99967V13.333C12.6667 13.9997 12 14.6663 11.3333 14.6663H4.66667C4 14.6663 3.33333 13.9997 3.33333 13.333V3.99967M5.33333 3.99967V2.66634C5.33333 1.99967 6 1.33301 6.66667 1.33301H9.33333C10 1.33301 10.6667 1.99967 10.6667 2.66634V3.99967M6.66667 7.33301V11.333M9.33333 7.33301V11.333"
                    stroke="#ED5E56"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  onClick={closeMeetingModal}
                  style={{ cursor: "pointer", marginLeft: 8 }}
                >
                  <path
                    d="M12 4L4 12M4 4L12 12"
                    stroke="#007AFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className={styles["modal-body"]}>
              <div className={styles["meeting-title"]}>
                {selectedMeeting.title}
              </div>
              <div className={styles["meeting-notes"]}>
                {selectedMeeting.notes || "No Notes Added"}
              </div>
              {selectedMeeting.link ? (
                <a
                  href={
                    selectedMeeting.link.startsWith("http")
                      ? selectedMeeting.link
                      : `https://${selectedMeeting.link}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles["meeting-link"]}
                >
                  {selectedMeeting.link}
                </a>
              ) : (
                <div className={styles["no-link"]}>No Link Added</div>
              )}
            </div>
            <div className={styles["color-selector"]}>
              <div
                className={`${styles["color-option"]} ${styles["active"]}`}
                style={{ backgroundColor: "#FF9500" }}
              />
              <div
                className={styles["color-option"]}
                style={{ backgroundColor: "#007AFF" }}
              />
              <div
                className={styles["color-option"]}
                style={{ backgroundColor: "#34C759" }}
              />
              <div
                className={styles["color-option"]}
                style={{ backgroundColor: "#30B0C7" }}
              />
            </div>
          </div>
        </div>
      )}

      <DateRangePickerModal
        isOpen={isDateRangeModalOpen}
        onClose={handleDateRangeModalClose}
        onApplyDateRange={handleApplyDateRange}
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
      />
      {/* Mobile Bottom Navigation */}
      <MobileBottomNavigation />
    </div>
  );
};

export default YourCalendarMeetings;
