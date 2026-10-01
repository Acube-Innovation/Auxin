import React from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Initialize the localizer
const localizer = momentLocalizer(moment);

const Venkat = () => {
  // Sample events data
  const events = [
    {
      id: 1,
      title: 'Team Meeting',
      start: new Date(2025, 10, 20, 10, 0), // November 20, 2023 at 10:00 AM
      end: new Date(2025, 10, 20, 11, 30),  // November 20, 2023 at 11:30 AM
    },
    {
      id: 2,
      title: 'Client Call',
      start: new Date(2023, 10, 21, 14, 0), // November 21, 2023 at 2:00 PM
      end: new Date(2023, 10, 21, 15, 0),   // November 21, 2023 at 3:00 PM
    }
  ];

  return (
    <div style={{ 
      height: '100vh',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h1 style={{ marginBottom: '20px' }}>Team Calendar</h1>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          defaultView="week"
          views={['month', 'week', 'day']}
        />
      </div>
    </div>
  );
};

export default Venkat;