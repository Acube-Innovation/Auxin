import React, { useState, useEffect } from "react";
import "./DatePickerModal.css";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import chevrondleft from "../assets/dashboard/chevron-left.svg";

function DatePickerModal({ isOpen, onClose, onSelectDate, selectedDate }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      setCurrentDate(date);
      setSelectedDay(date.getDate());
    }
  }, [selectedDate]);

  if (!isOpen) return null;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Mo", "Tu", "We", "Th", "Fr", "Sat", "Su"];

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

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayClick = (day, isCurrentMonth = true, isNextMonth = false) => {
    if (!isCurrentMonth) {
      if (isNextMonth) {
        // Move to next month and select the day
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
        setCurrentDate(nextMonth);
        setSelectedDay(day);
      } else {
        // Move to previous month and select the day
        const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
        setCurrentDate(prevMonth);
        setSelectedDay(day);
      }
      return;
    }
    setSelectedDay(day);
  };

  const handleApply = () => {
    if (selectedDay) {
      const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay);
      onSelectDate(selectedDate);
    }
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getFirstDayOfMonth(currentDate);
    const previousMonthDays = getPreviousMonthDays(currentDate);
    const days = [];

    // Previous month days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const day = previousMonthDays - i;
      days.push(
        <div
          key={`prev-${day}`}
          className="calendar-cell previous-month"
          onClick={() => handleDayClick(day, false, false)}
        >
          <div className="calendar-day">{day}</div>
        </div>
      );
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDay;
      const isToday = 
        day === new Date().getDate() && 
        currentDate.getMonth() === new Date().getMonth() && 
        currentDate.getFullYear() === new Date().getFullYear();

      days.push(
        <div
          key={`current-${day}`}
          className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
          onClick={() => handleDayClick(day, true)}
        >
          <div className="calendar-day">{day}</div>
        </div>
      );
    }

    // Next month days to complete the grid (6 rows × 7 days = 42 total)
    const totalCells = 42;
    const remainingCells = totalCells - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <div
          key={`next-${day}`}
          className="calendar-cell next-month"
          onClick={() => handleDayClick(day, false, true)}
        >
          <div className="calendar-day">{day}</div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="date-picker-backdrop" onClick={handleBackdropClick}>
      <div className="date-picker-menu">
        <div className="trailing-content">
          <div className="date-pickers">
            <div className="right-picker">
              <div className="picker-content">
                <div className="calendar">
                  <div className="calendar-month">
                      <div className="date-nav-button" onClick={goToPreviousMonth}>
                      <div className="button-base">
                        <img
                         src={chevrondleft}
                          alt="Previous month"
                          className="nav-icon"
                        />
                      </div> 
                    </div> 
                    <div className="month-text">
                      {months[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </div>
                    <div className="date-nav-button" onClick={goToNextMonth}>
                      <div className="button-base">
                        <img
                         src={chevrondright}
                          alt="Next month"
                          className="nav-icon"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="calendar-dates">
                    <div className="day-headers">
                      {daysOfWeek.map((day) => (
                        <div key={day} className="day-header">
                          <div className="day-header-text">{day}</div>
                        </div>
                      ))}
                    </div>
                    <div className="calendar-grid">
                      {renderCalendarDays()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="divider" />
          <div className="bottom-panel">
            <div className="actions">
              <div className="cancel-btn">
                <div className="cancel-btn-base" onClick={onClose}>
                  <div className="cancel-text">Cancel</div>
                </div>
              </div>
              <div className="apply-btn" onClick={handleApply}>
                <div className="apply-text">Apply</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default DatePickerModal;