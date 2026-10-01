import React, { useState, useMemo, useEffect } from "react";
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import endOfWeek from 'date-fns/endOfWeek';
import getDay from 'date-fns/getDay';
import isSameDay from 'date-fns/isSameDay';
import isSameWeek from 'date-fns/isSameWeek';
import isSameMonth from 'date-fns/isSameMonth';
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./CalendarComponent.css";
import DateRangePickerModal from "../DateRangePickerModal";
import EditEventModal from "./EditEventModal";
import DeleteModal from "../delete-modal/DeleteModal";
import { getEventsByClientId, deleteEvent } from "../../services/CreateEventService";

const locales = {
  'en-US': require('date-fns/locale/en-US'),
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CalendarComponent = ({ clientId, key: calendarKey }) => {
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [eventToDelete, setEventToDelete] = useState(null);


  // Check if current view shows today's date
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

  // Fetch events from backend
  useEffect(() => {
    const fetchEvents = async () => {
      if (!clientId) return;

      try {
        setIsLoading(true);
        const fetchedEvents = await getEventsByClientId(clientId);

        // Transform backend events to react-big-calendar format
        const transformedEvents = fetchedEvents.map(event => {
          // Create proper start date from date and time
          let startDate = new Date(event.date);
          if (event.time) {
            const [hours, minutes] = event.time.split(':');
            startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          }

          // Create end date (default 2 hours duration)
          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

          return {
            id: event._id || event.id,
            title: event.eventName,
            start: startDate,
            end: endDate,
            color: event.color || '#007AFF',
            eventType: event.eventType,
            notes: event.notes,
            link: event.link,
            assignedTeamMembers: event.assignedTeamMembers
          };
        });

        setEvents(transformedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        // Fallback to sample events for demonstration
        setEvents(sampleEvents);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [clientId, calendarKey]); // Add calendarKey to dependencies for refresh

  // Sample events for fallback/demonstration
  const sampleEvents = [
    {
      id: 1,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 2, 10, 0), // August 2, 2025, 10:00 AM
      end: new Date(2025, 7, 2, 12, 0),
      color: '#FF9500'
    },
    {
      id: 2,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 7, 10, 0),
      end: new Date(2025, 7, 7, 12, 0),
      color: '#FF9500'
    },
    {
      id: 3,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 12, 10, 0),
      end: new Date(2025, 7, 12, 12, 0),
      color: '#FF9500'
    },
    {
      id: 4,
      title: "Meeting with dev team...",
      start: new Date(2025, 7, 17, 10, 0),
      end: new Date(2025, 7, 17, 12, 0),
      color: '#34C759'
    },
    {
      id: 5,
      title: "Meeting with dev team...",
      start: new Date(2025, 7, 17, 13, 0),
      end: new Date(2025, 7, 17, 15, 0),
      color: '#FF9500'
    },
    {
      id: 6,
      title: "Meeting with dev +1",
      start: new Date(2025, 7, 17, 16, 0),
      end: new Date(2025, 7, 17, 17, 0),
      color: '#007AFF'
    },
    {
      id: 7,
      title: "Meeting with dev team...",
      start: new Date(2025, 7, 26, 10, 0),
      end: new Date(2025, 7, 26, 12, 0),
      color: '#30B0C7'
    },
    {
      id: 8,
      title: "Meeting with dev team...",
      start: new Date(2025, 7, 26, 13, 0),
      end: new Date(2025, 7, 26, 15, 0),
      color: '#34C759'
    },
    {
      id: 9,
      title: "Meeting with dev team...",
      start: new Date(2025, 7, 29, 10, 0),
      end: new Date(2025, 7, 29, 12, 0),
      color: '#007AFF'
    },
    // Week view meetings
    {
      id: 10,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 17, 9, 0), // Saturday 17th
      end: new Date(2025, 7, 17, 11, 0),
      color: '#FF9500'
    },
    {
      id: 11,
      title: "Team Lunch with Client to propose new ideas for...",
      start: new Date(2025, 7, 14, 12, 30), // Wednesday 14th
      end: new Date(2025, 7, 14, 16, 0),
      color: '#34C759'
    },
    {
      id: 12,
      title: "Cargo Summit 2025",
      start: new Date(2025, 7, 18, 14, 30), // Sunday 18th
      end: new Date(2025, 7, 18, 20, 30),
      color: '#00C7BE'
    },
    // Day view meeting
    {
      id: 13,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 17, 10, 0), // Saturday 17th
      end: new Date(2025, 7, 17, 12, 0),
      color: '#FF9500',
      link: "https://meet.google.com/dic-frg-svu"
    },
      {
      id: 14,
      title: "Meeting with dev team on Issue #47",
      start: new Date(2025, 7, 2, 13, 0), // August 2, 2025, 10:00 AM
      end: new Date(2025, 7, 2, 14, 0),
      color: '#FF9500'
    },
  ];

  // Show loading state
  if (isLoading) {
    return (
      <div className="calendar-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <div>Loading events...</div>
        </div>
      </div>
    );
  }

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

  const handleEditEvent = () => {
    setEventToEdit(selectedMeeting);
    setIsEditModalOpen(true);
    setSelectedMeeting(null);
  };

  const handleDeleteEvent = () => {
    setEventToDelete(selectedMeeting);
    setIsDeleteModalOpen(true);
    setSelectedMeeting(null);
  };

  const handleEventUpdated = (updatedEvent) => {
    // Refresh events after update
    const fetchEvents = async () => {
      try {
        const fetchedEvents = await getEventsByClientId(clientId);
        const transformedEvents = fetchedEvents.map(event => {
          let startDate = new Date(event.date);
          if (event.time) {
            const [hours, minutes] = event.time.split(':');
            startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          }
          const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

          return {
            id: event._id || event.id,
            title: event.eventName,
            start: startDate,
            end: endDate,
            color: event.color || '#007AFF',
            eventType: event.eventType,
            notes: event.notes,
            link: event.link,
            assignedTeamMembers: event.assignedTeamMembers
          };
        });
        setEvents(transformedEvents);
      } catch (error) {
        console.error('Error refreshing events:', error);
      }
    };
    fetchEvents();
    setIsEditModalOpen(false);
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      await deleteEvent(clientId, eventToDelete.id);
      // Refresh events after deletion
      const fetchEvents = async () => {
        try {
          const fetchedEvents = await getEventsByClientId(clientId);
          const transformedEvents = fetchedEvents.map(event => {
            let startDate = new Date(event.date);
            if (event.time) {
              const [hours, minutes] = event.time.split(':');
              startDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }
            const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

            return {
              id: event._id || event.id,
              title: event.eventName,
              start: startDate,
              end: endDate,
              color: event.color || '#007AFF',
              eventType: event.eventType,
              notes: event.notes,
              link: event.link,
              assignedTeamMembers: event.assignedTeamMembers
            };
          });
          setEvents(transformedEvents);
        } catch (error) {
          console.error('Error refreshing events:', error);
        }
      };
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    } finally {
      setIsDeleteModalOpen(false);
      setEventToDelete(null);
    }
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
    console.log('Applied date range:', startDate, 'to', endDate);
  };

  const eventStyleGetter = (event, start, end, isSelected) => {
    if (view === Views.MONTH) {
      return {
        style: {
          backgroundColor: 'transparent',
          color: event.color,
          border: 'none',
          padding: '0',
          boxShadow: 'none'
        }
      };
    } else {
      return {
        style: {
          backgroundColor: event.color,
          color: 'white',
          borderRadius: '4px',
          border: 'none',
          padding: '4px 8px',
          opacity: 0.9
        }
      };
    }
  };

  const dayPropGetter = (date) => {
    const isCurrentDate = date.toDateString() === new Date().toDateString();
    return {
      style: {
        backgroundColor: isCurrentDate ? 'white' : 'white',
        // borderRight: '2px solid #F5F6F7',
        // borderBottom: '2px solid #F5F6F7'
      }
    };
  };

  const customComponents = {
    event: ({ event }) => (
      <div className="rbc-custom-event">
        {view === Views.MONTH ? (
          <div className="meetingcontent">
            <span style={{ backgroundColor: event.color }}></span>
            <div className="event-title">{event.title}</div>
          </div>
        ) : (
          <div className="event-content">
            <div className="event-title">{event.title}</div>
            {event.link && <div className="event-link">{event.link}</div>}
          </div>
        )}
      </div>
    ),
    timeSlotWrapper: (props) => {
      if (view === Views.DAY) {
        return (
          <div className="rbc-time-slot-wrapper">
            {props.children}
          </div>
        );
      }
      return props.children;
    },

    toolbar: (props) => (
    <div className="calendar-header">
      <div className="calendar-navigation">
        {/* Previous button */}
        <button className="nav-button" onClick={() => props.onNavigate('PREV')}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M17.0732 8.67289C16.8988 8.49812 16.6621 8.3999 16.4152 8.3999C16.1683 8.3999 15.9316 8.49812 15.7572 8.67289L11.4732 12.9569C11.1092 13.3209 11.1092 13.9089 11.4732 14.2729L15.7572 18.5569C16.1212 18.9209 16.7092 18.9209 17.0732 18.5569C17.4372 18.1929 17.4372 17.6049 17.0732 17.2409L13.4519 13.6102L17.0732 9.98889C17.4372 9.62489 17.4279 9.02756 17.0732 8.67289Z" fill="#C3CAD9"/>
          </svg>
        </button>
        <div className="current-period" onClick={handlePeriodClick}>
         {view === Views.MONTH && (
              isCurrentPeriod ? 'This Month' : format(date, 'MMMM yyyy')
            )}
            {view === Views.WEEK && (
              isCurrentPeriod
                ? 'This Week'
                : `${format(startOfWeek(date), 'MMMM d')} - ${format(endOfWeek(date), 'MMMM d, yyyy')}`
            )}
            {view === Views.DAY && (
              isCurrentPeriod ? 'Today' : format(date, 'EEEE, MMMM d')
            )}
        </div>
        {/* Next button */}
        <button className="nav-button" onClick={() => props.onNavigate('NEXT')}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M11.4732 8.67408C11.1092 9.03808 11.1092 9.62608 11.4732 9.99008L15.0945 13.6114L11.4732 17.2327C11.1092 17.5967 11.1092 18.1847 11.4732 18.5487C11.8372 18.9127 12.4252 18.9127 12.7892 18.5487L17.0732 14.2647C17.4372 13.9007 17.4372 13.3127 17.0732 12.9487L12.7892 8.66475C12.4345 8.31008 11.8372 8.31008 11.4732 8.67408Z" fill="#C3CAD9"/>
          </svg>
        </button>
      </div>
      {/* View toggle buttons */}
      <div className="view-toggle">
        <button
          className={`toggle-button ${view === Views.DAY ? 'active' : ''}`}
          onClick={() => handleView(Views.DAY)}
        >
          Day
        </button>
        <button
          className={`toggle-button ${view === Views.WEEK ? 'active' : ''}`}
          onClick={() => handleView(Views.WEEK)}
        >
          Week
        </button>
        <button
          className={`toggle-button ${view === Views.MONTH ? 'active' : ''}`}
          onClick={() => handleView(Views.MONTH)}
        >
          Month
        </button>
      </div>
    </div>
  ),
    timeGutterHeader: () => (
      <div className="time-header">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M9.99 0C4.47 0 0 4.48 0 10C0 15.52 4.47 20 9.99 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 9.99 0ZM10 18C5.58 18 2 14.42 2 10C2 5.58 5.58 2 10 2C14.42 2 18 5.58 18 10C18 14.42 14.42 18 10 18ZM9.78 5H9.72C9.32 5 9 5.32 9 5.72V10.44C9 10.79 9.18 11.12 9.49 11.3L13.64 13.79C13.98 13.99 14.42 13.89 14.62 13.55C14.83 13.21 14.72 12.76 14.37 12.56L10.5 10.26V5.72C10.5 5.32 10.18 5 9.78 5Z" fill="#C3CAD9"/>
        </svg>
      </div>
    ),
    week: {
      header: ({ date }) => (
        <div className="week-day-name">
          {format(date, 'EEEE d')}
        </div>
      )
    },
    day: {
      header: ({ date }) => (
        <div className="day-name-header">
          {format(date, 'EEEE d')}
        </div>
      )
    }
  };

  return (
    <div className="calendar-container">
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
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

      {/* Meeting Modal */}
      {selectedMeeting && (
        <div className="meeting-modal" onClick={closeMeetingModal}>
          <div className="meeting-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="meeting-chip">
                <span>Meeting</span>
                <span style={{ margin: '0 8px', opacity: 0.7 }}>|</span>
                <span>
                  {format(selectedMeeting.start, 'h:mm a')}
                </span>
              </div>
              <div className="modal-actions-event">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={handleEditEvent} style={{cursor: 'pointer'}}>
                  <path d="M8.00031 13.3332H14.0003M10.0003 3.33316L12.0003 5.33316M10.9176 2.41449C11.183 2.1491 11.543 2 11.9183 2C12.2936 2 12.6536 2.1491 12.919 2.41449C13.1844 2.67988 13.3335 3.03983 13.3335 3.41516C13.3335 3.79048 13.1844 4.15043 12.919 4.41582L4.91231 12.4232C4.75371 12.5818 4.55766 12.6978 4.34231 12.7605L2.42764 13.3192C2.37028 13.3359 2.30947 13.3369 2.25158 13.3221C2.1937 13.3072 2.14086 13.2771 2.09861 13.2349C2.05635 13.1926 2.02624 13.1398 2.01141 13.0819C1.99658 13.024 1.99758 12.9632 2.01431 12.9058L2.57298 10.9912C2.63579 10.776 2.75181 10.5802 2.91031 10.4218L10.9176 2.41449Z" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={handleDeleteEvent} style={{cursor: 'pointer'}}>
                  <path d="M2 3.99967H14M12.6667 3.99967V13.333C12.6667 13.9997 12 14.6663 11.3333 14.6663H4.66667C4 14.6663 3.33333 13.9997 3.33333 13.333V3.99967M5.33333 3.99967V2.66634C5.33333 1.99967 6 1.33301 6.66667 1.33301H9.33333C10 1.33301 10.6667 1.99967 10.6667 2.66634V3.99967M6.66667 7.33301V11.333M9.33333 7.33301V11.333" stroke="#ED5E56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" onClick={closeMeetingModal} style={{cursor: 'pointer'}}>
                  <path d="M12 4L4 12M4 4L12 12" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <div className="modal-body">
              <div className="meeting-title">{selectedMeeting.title}</div>
              <div className="meeting-notes">{selectedMeeting.notes || 'No Notes Added'}</div>
              {selectedMeeting.link && (
                <div className="meeting-link">
                  <a href={selectedMeeting.link} target="_blank" rel="noopener noreferrer">
                    {selectedMeeting.link}
                  </a>
                </div>
              )}
              {/* {selectedMeeting.assignedTeamMembers && (
                <div className="meeting-member">Assigned to: {selectedMeeting.assignedTeamMembers}</div>
              )} */}
            </div>
            <div className="color-selector">
              <div className="color-option active" style={{ backgroundColor: '#FF9500' }} />
              <div className="color-option" style={{ backgroundColor: '#007AFF' }} />
              <div className="color-option" style={{ backgroundColor: '#34C759' }} />
              <div className="color-option" style={{ backgroundColor: '#30B0C7' }} />
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

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        clientId={clientId}
        eventData={eventToEdit}
        onEventUpdated={handleEventUpdated}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteEvent}
        title="Delete this Event?"
        description="Are you sure you want to delete this event? This action cannot be undone."
      />
    </div>
  );
};

export default CalendarComponent;
