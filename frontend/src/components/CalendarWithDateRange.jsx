import React, { useState, useEffect } from 'react';
import CalendarComponent from './sales-and-leads/CalendarComponent';
import DateRangePickerModal from './DateRangePickerModal';
import useDateRange from '../hooks/useDateRange';
import styles from './CalendarWithDateRange.module.css';

/**
 * Example component showing how to integrate DateRangePickerModal with CalendarComponent
 * and use the useDateRange hook for backend functionality
 */
const CalendarWithDateRange = () => {
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  
  // Use the custom date range hook
  const {
    dateRange,
    updateDateRange,
    getFormattedDateRange,
    getCurrentPreset,
    filterDataByDateRange,
    getDateRangeAnalytics
  } = useDateRange();

  // Sample events data (in real app, this would come from an API)
  const allEvents = [
    {
      id: 1,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 0, 2, 10, 0), // January 2, 2025
      end: new Date(2025, 0, 2, 12, 0),
      color: '#FF9500',
      date: '2025-01-02'
    },
    {
      id: 2,
      title: "Team Lunch Meeting",
      start: new Date(2025, 0, 7, 12, 0), // January 7, 2025
      end: new Date(2025, 0, 7, 14, 0),
      color: '#34C759',
      date: '2025-01-07'
    },
    {
      id: 3,
      title: "Client Presentation",
      start: new Date(2025, 0, 12, 15, 0), // January 12, 2025
      end: new Date(2025, 0, 12, 17, 0),
      color: '#007AFF',
      date: '2025-01-12'
    },
    {
      id: 4,
      title: "Project Review",
      start: new Date(2025, 0, 15, 9, 0), // January 15, 2025
      end: new Date(2025, 0, 15, 11, 0),
      color: '#30B0C7',
      date: '2025-01-15'
    },
    {
      id: 5,
      title: "Weekly Standup",
      start: new Date(2025, 0, 20, 10, 0), // January 20, 2025
      end: new Date(2025, 0, 20, 11, 0),
      color: '#FF9500',
      date: '2025-01-20'
    }
  ];

  // Filter events based on selected date range
  useEffect(() => {
    const filteredEvents = filterDataByDateRange(allEvents, 'date');
    setCalendarEvents(filteredEvents);
  }, [dateRange]);

  const handleDateRangeClick = () => {
    setIsDateRangeModalOpen(true);
  };

  const handleDateRangeModalClose = () => {
    setIsDateRangeModalOpen(false);
  };

  const handleDateRangeApply = (startDate, endDate) => {
    updateDateRange(startDate, endDate);
    setIsDateRangeModalOpen(false);
  };

  // Get analytics for the current date range
  const analytics = getDateRangeAnalytics(allEvents, 'date');
  const currentPreset = getCurrentPreset();

  return (
    <div className={styles.calendarContainer}>
      {/* Header with date range selector */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Calendar Events</h2>
          <div className={styles.analytics}>
            <span className={styles.eventCount}>
              {analytics.totalRecords} events in {analytics.dateRange.days} days
            </span>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <button 
            className={styles.dateRangeButton}
            onClick={handleDateRangeClick}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className={styles.calendarIcon}
            >
              <path 
                d="M12.6667 2.66634H3.33333C2.59695 2.66634 2 3.26329 2 3.99967V12.6663C2 13.4027 2.59695 13.9997 3.33333 13.9997H12.6667C13.403 13.9997 14 13.4027 14 12.6663V3.99967C14 3.26329 13.403 2.66634 12.6667 2.66634Z" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M10.6667 1.33301V3.99967" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M5.33333 1.33301V3.99967" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M2 7.33301H14" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.dateRangeText}>
              {currentPreset ? currentPreset.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : getFormattedDateRange()}
            </span>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className={styles.chevronIcon}
            >
              <path 
                d="M4 6L8 10L12 6" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar component with filtered events */}
      <div className={styles.calendarWrapper}>
        <CalendarComponent events={calendarEvents} />
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
};

export default CalendarWithDateRange;
