import React, { useState, useEffect } from "react";
import styles from "./DateRangePickerModal.module.css";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import chevrondleft from "../assets/dashboard/chevron-left.svg";

const DateRangePickerModal = ({ isOpen, onClose, onApplyDateRange, initialStartDate, initialEndDate }) => {
  // State management
  const [startDate, setStartDate] = useState(initialStartDate || new Date());
  const [endDate, setEndDate] = useState(initialEndDate || new Date());
  const [leftCalendarDate, setLeftCalendarDate] = useState(new Date());
  const [rightCalendarDate, setRightCalendarDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1));
  const [selectedPreset, setSelectedPreset] = useState("last-week");
  const [isRangeSelection, setIsRangeSelection] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(null);

  // Date presets
  const datePresets = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "this-week", label: "This week" },
    { id: "last-week", label: "Last week" },
    { id: "this-month", label: "This month" },
    { id: "last-month", label: "Last month" },
    { id: "this-year", label: "This Year" },
    { id: "last-year", label: "Last Year" }
  ];

  // Helper functions
  const getDateFromPreset = (presetId) => {
    const today = new Date();
    const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    switch (presetId) {
      case "today":
        return { start: now, end: now };
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: yesterday };
      case "this-week":
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
        return { start: startOfWeek, end: endOfWeek };
      case "last-week":
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - now.getDay() + 1 - 7); // Previous Monday
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Previous Sunday
        return { start: lastWeekStart, end: lastWeekEnd };
      case "this-month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { start: startOfMonth, end: endOfMonth };
      case "last-month":
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start: lastMonthStart, end: lastMonthEnd };
      case "this-year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        return { start: startOfYear, end: endOfYear };
      case "last-year":
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYearStart, end: lastYearEnd };
      default:
        return { start: now, end: now };
    }
  };

  // Initialize with preset
  useEffect(() => {
    if (isOpen) {
      const { start, end } = getDateFromPreset(selectedPreset);
      setStartDate(start);
      setEndDate(end);

      // Set calendar views to show the selected date range properly
      const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

      // If the range spans multiple months, show start month on left and end month on right
      if (startMonth.getTime() !== endMonth.getTime()) {
        setLeftCalendarDate(startMonth);
        setRightCalendarDate(endMonth);
      } else {
        // If same month, show that month on left and next month on right
        setLeftCalendarDate(startMonth);
        setRightCalendarDate(new Date(start.getFullYear(), start.getMonth() + 1, 1));
      }
    }
  }, [isOpen, selectedPreset]);

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Convert Sunday = 0 to Sunday = 6
  };

  const getPreviousMonthDays = (date) => {
    const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 0);
    return prevMonth.getDate();
  };

  const formatDateForInput = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isDateInRange = (date, calendarDate) => {
    const currentDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), date);
    const start = new Date(startDate);
    const end = new Date(endDate);

    return currentDate >= start && currentDate <= end;
  };

  const isDateSelected = (date, calendarDate) => {
    const currentDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), date);
    return (
      (startDate && currentDate.toDateString() === startDate.toDateString()) ||
      (endDate && currentDate.toDateString() === endDate.toDateString())
    );
  };

  const isDateToday = (date, calendarDate) => {
    const currentDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), date);
    const today = new Date();
    return currentDate.toDateString() === today.toDateString();
  };

  // Navigation functions
  const goToPreviousMonth = (isLeftCalendar) => {
    if (isLeftCalendar) {
      setLeftCalendarDate(new Date(leftCalendarDate.getFullYear(), leftCalendarDate.getMonth() - 1, 1));
    } else {
      setRightCalendarDate(new Date(rightCalendarDate.getFullYear(), rightCalendarDate.getMonth() - 1, 1));
    }
  };

  const goToNextMonth = (isLeftCalendar) => {
    if (isLeftCalendar) {
      setLeftCalendarDate(new Date(leftCalendarDate.getFullYear(), leftCalendarDate.getMonth() + 1, 1));
    } else {
      setRightCalendarDate(new Date(rightCalendarDate.getFullYear(), rightCalendarDate.getMonth() + 1, 1));
    }
  };

  // Date selection handlers
  const handleDateClick = (day, calendarDate, isCurrentMonth = true) => {
    if (!isCurrentMonth) {
      // Handle clicks on previous/next month dates
      const clickedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);

      // Navigate to the clicked month and select the date
      if (calendarDate.getMonth() < leftCalendarDate.getMonth() ||
          (calendarDate.getMonth() === leftCalendarDate.getMonth() && calendarDate.getFullYear() < leftCalendarDate.getFullYear())) {
        // Previous month date clicked
        setLeftCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1));
        setRightCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
      } else {
        // Next month date clicked
        setRightCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1));
        setLeftCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
      }

      // Don't return early, allow the date selection to continue
    }

    const clickedDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);

    if (!isRangeSelection) {
      // Start new range selection
      setTempStartDate(clickedDate);
      setStartDate(clickedDate);
      setEndDate(clickedDate);
      setIsRangeSelection(true);
      setSelectedPreset(""); // Clear preset selection
    } else {
      // Complete range selection
      if (clickedDate < tempStartDate) {
        setStartDate(clickedDate);
        setEndDate(tempStartDate);
      } else {
        setEndDate(clickedDate);
      }
      setIsRangeSelection(false);
      setTempStartDate(null);
    }
  };

  const handlePresetClick = (presetId) => {
    setSelectedPreset(presetId);
    const { start, end } = getDateFromPreset(presetId);
    setStartDate(start);
    setEndDate(end);
    setIsRangeSelection(false);
    setTempStartDate(null);

    // Update calendar views to show the preset date range
    const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    // If the range spans multiple months, show start month on left and end month on right
    if (startMonth.getTime() !== endMonth.getTime()) {
      setLeftCalendarDate(startMonth);
      setRightCalendarDate(endMonth);
    } else {
      // If same month, show that month on left and next month on right
      setLeftCalendarDate(startMonth);
      setRightCalendarDate(new Date(start.getFullYear(), start.getMonth() + 1, 1));
    }
  };

  // Modal handlers
  const handleApply = () => {
    if (onApplyDateRange) {
      onApplyDateRange(startDate, endDate);
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Calendar rendering
  const renderCalendarDays = (calendarDate, isLeftCalendar) => {
    const daysInMonth = getDaysInMonth(calendarDate);
    const firstDayOfMonth = getFirstDayOfMonth(calendarDate);
    const previousMonthDays = getPreviousMonthDays(calendarDate);
    const days = [];

    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = previousMonthDays - i;
      const prevMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
      days.push(
        <div
          key={`prev-${day}`}
          className={`${styles.calendarCell} ${styles.previousMonth}`}
          onClick={() => handleDateClick(day, prevMonthDate, false)}
        >
          <div className={styles.calendarDay}>{day}</div>
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = isDateSelected(day, calendarDate);
      const isInRange = isDateInRange(day, calendarDate);
      const isToday = isDateToday(day, calendarDate);

      days.push(
        <div
          key={`current-${day}`}
          className={`${styles.calendarCell} ${isSelected ? styles.selected : ''} ${isInRange ? styles.inRange : ''} ${isToday ? styles.today : ''}`}
          onClick={() => handleDateClick(day, calendarDate, true)}
        >
          <div className={styles.calendarDay}>{day}</div>
        </div>
      );
    }

    // Next month days to complete the grid
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonthDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
      days.push(
        <div
          key={`next-${day}`}
          className={`${styles.calendarCell} ${styles.nextMonth}`}
          onClick={() => handleDateClick(day, nextMonthDate, false)}
        >
          <div className={styles.calendarDay}>{day}</div>
        </div>
      );
    }

    return days;
  };

  if (!isOpen) return null;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Mo", "Tu", "We", "Th", "Fr", "Sat", "Su"];

  return (
    <div className={styles.datePickerBackdrop} onClick={handleBackdropClick}>
      <div className={styles.datePickerMenu}>
        <div className={styles.leadingContent}>
          {datePresets.map((preset) => (
            <div
              key={preset.id}
              className={`${styles.datePickerListItem} ${selectedPreset === preset.id ? styles.selected : ''}`}
              onClick={() => handlePresetClick(preset.id)}
            >
              <div className={styles.text}>{preset.label}</div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.trailingContent}>
          <div className={styles.datePickers}>
            {/* Left Calendar */}
            <div className={styles.leftPicker}>
              <div className={styles.content}>
                <div className={styles.calendar}>
                  <div className={styles.calendarMonth}>
                    <div className={styles.navButton} onClick={() => goToPreviousMonth(true)}>
                      <div className={styles.buttonBase}>
                        <img
                         src={chevrondleft}
                          alt="Previous"
                          className={styles.navIcon}
                        />
                      </div>
                    </div>
                    <div className={styles.monthText}>
                      {months[leftCalendarDate.getMonth()]} {leftCalendarDate.getFullYear()}
                    </div>
                    <div className={styles.navButton} onClick={() => goToNextMonth(true)}>
                      <div className={styles.buttonBase}>
                        <img
                          src={chevrondright}
                          alt="Next"
                          className={styles.navIcon}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.calendarDates}>
                    <div className={styles.dayHeaders}>
                      {daysOfWeek.map((day) => (
                        <div key={day} className={styles.dayHeader}>
                          <div className={styles.dayHeaderText}>{day}</div>
                        </div>
                      ))}
                    </div>
                    <div className={styles.calendarGrid}>
                      {renderCalendarDays(leftCalendarDate, true)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.calendarDivider} />

            {/* Right Calendar */}
            <div className={styles.rightPicker}>
              <div className={styles.content}>
                <div className={styles.calendar}>
                  <div className={styles.calendarMonth}>
                    <div className={styles.navButton} onClick={() => goToPreviousMonth(false)}>
                      <div className={styles.buttonBase}>
                        <img
                        src={chevrondleft}
                          alt="Previous"
                          className={styles.navIcon}
                        />
                      </div>
                    </div>
                    <div className={styles.monthText}>
                      {months[rightCalendarDate.getMonth()]} {rightCalendarDate.getFullYear()}
                    </div>
                    <div className={styles.navButton} onClick={() => goToNextMonth(false)}>
                      <div className={styles.buttonBase}>
                        <img
                        src={chevrondright}
                          alt="Next"
                          className={styles.navIcon}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={styles.calendarDates}>
                    <div className={styles.dayHeaders}>
                      {daysOfWeek.map((day) => (
                        <div key={day} className={styles.dayHeader}>
                          <div className={styles.dayHeaderText}>{day}</div>
                        </div>
                      ))}
                    </div>
                    <div className={styles.calendarGrid}>
                      {renderCalendarDays(rightCalendarDate, false)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.bottomDivider} />

          <div className={styles.bottomPanel}>
            <div className={styles.inputFields}>
              <div className={styles.inputField}>
                <div className={styles.inputFieldBase}>
                  <div className={styles.inputWithLabel}>
                    <div className={styles.input}>
                      <div className={styles.inputContent}>
                        <div className={styles.inputText}>
                          {formatDateForInput(startDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.separatorText}>–</div>
              <div className={styles.inputField}>
                <div className={styles.inputFieldBase}>
                  <div className={styles.inputWithLabel}>
                    <div className={styles.input}>
                      <div className={styles.inputContent}>
                        <div className={styles.inputText}>
                          {formatDateForInput(endDate)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <div className={styles.cancelButton}>
                <div className={styles.cancelButtonText} onClick={handleCancel}>
                  Cancel
                </div>
              </div>
              <div className={styles.applyButton} onClick={handleApply}>
                <div className={styles.applyText}>Apply</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangePickerModal;
