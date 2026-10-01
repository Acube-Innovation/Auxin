# DateRangePickerModal Component

A comprehensive date range picker modal component with full backend functionality for React applications.

## Features

- **Interactive Dual Calendar**: Side-by-side calendar views for easy range selection
- **Preset Date Ranges**: Quick selection for common date ranges (Today, Yesterday, This Week, etc.)
- **Range Selection**: Click and drag to select date ranges
- **Backend Integration**: Built-in hooks and utilities for data filtering and API calls
- **Responsive Design**: Works on desktop and mobile devices
- **Customizable**: Easy to style and extend

## Basic Usage

```jsx
import DateRangePickerModal from './components/DateRangePickerModal';
import useDateRange from './hooks/useDateRange';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { dateRange, updateDateRange } = useDateRange();

  const handleApplyDateRange = (startDate, endDate) => {
    updateDateRange(startDate, endDate);
    setIsModalOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Select Date Range
      </button>
      
      <DateRangePickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onApplyDateRange={handleApplyDateRange}
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls modal visibility |
| `onClose` | function | Yes | Called when modal is closed |
| `onApplyDateRange` | function | Yes | Called when date range is applied |
| `initialStartDate` | Date | No | Initial start date (defaults to today) |
| `initialEndDate` | Date | No | Initial end date (defaults to today) |

## useDateRange Hook

The `useDateRange` hook provides comprehensive backend functionality:

```jsx
import useDateRange from './hooks/useDateRange';

function MyComponent() {
  const {
    dateRange,           // Current date range { start, end }
    updateDateRange,     // Update the date range
    filterDataByDateRange, // Filter array data by date range
    fetchDataByDateRange,  // Fetch data from API by date range
    getFormattedDateRange, // Get formatted date range string
    getCurrentPreset,    // Get current preset name (if any)
    applyPreset,        // Apply a preset date range
    isLoading           // Loading state for API calls
  } = useDateRange();

  // Filter local data
  const filteredEvents = filterDataByDateRange(events, 'eventDate');

  // Fetch data from API
  const handleFetchData = async () => {
    try {
      const data = await fetchDataByDateRange('/api/events');
      console.log('Filtered events:', data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div>
      <p>Selected Range: {getFormattedDateRange()}</p>
      <p>Current Preset: {getCurrentPreset()}</p>
      <button onClick={() => applyPreset('last-week')}>
        Select Last Week
      </button>
    </div>
  );
}
```

## Date Utilities

The `dateUtils.js` file provides helper functions:

```jsx
import { formatDate, validateDate, calculateDate } from './utils/dateUtils';

// Format dates
formatDate.forAPI(new Date());        // "2025-01-15"
formatDate.forDisplay(new Date());    // "Jan 15, 2025"
formatDate.relative(new Date());      // "today"

// Validate dates
validateDate.isValid(new Date());     // true
validateDate.isToday(new Date());     // true
validateDate.isFuture(tomorrow);      // true

// Calculate dates
calculateDate.addDays(new Date(), 7); // Date 7 days from now
calculateDate.startOfWeek(new Date()); // Monday of current week
```

## Available Presets

- `today` - Current day
- `yesterday` - Previous day
- `this-week` - Current week (Monday to Sunday)
- `last-week` - Previous week
- `this-month` - Current month
- `last-month` - Previous month
- `this-year` - Current year
- `last-year` - Previous year

## Styling

The component uses CSS modules for styling. Customize by overriding the CSS classes:

```css
/* Custom styles */
.datePickerMenu {
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.datePickerListItem.selected {
  background-color: your-brand-color;
  color: white;
}
```

## Integration Examples

### With Calendar Component

```jsx
import CalendarWithDateRange from './components/CalendarWithDateRange';

function CalendarPage() {
  return <CalendarWithDateRange />;
}
```

### With Data Table

```jsx
function DataTable() {
  const { dateRange, filterDataByDateRange } = useDateRange();
  const [allData, setAllData] = useState([]);
  
  const filteredData = filterDataByDateRange(allData, 'createdAt');
  
  return (
    <table>
      {filteredData.map(item => (
        <tr key={item.id}>
          <td>{item.name}</td>
          <td>{formatDate.forDisplay(item.createdAt)}</td>
        </tr>
      ))}
    </table>
  );
}
```

### With API Integration

```jsx
function Reports() {
  const { fetchDataByDateRange, isLoading } = useDateRange();
  const [reports, setReports] = useState([]);
  
  useEffect(() => {
    const loadReports = async () => {
      try {
        const data = await fetchDataByDateRange('/api/reports', {
          params: { type: 'sales' },
          headers: { 'Authorization': 'Bearer token' }
        });
        setReports(data);
      } catch (error) {
        console.error('Failed to load reports:', error);
      }
    };
    
    loadReports();
  }, [fetchDataByDateRange]);
  
  if (isLoading) return <div>Loading...</div>;
  
  return <ReportsTable data={reports} />;
}
```

## Backend API Integration

The component expects your backend API to accept date range parameters:

```javascript
// Example API endpoint
GET /api/events?startDate=2025-01-01&endDate=2025-01-31

// Example response
{
  "data": [
    {
      "id": 1,
      "title": "Meeting",
      "date": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

## Accessibility

The component includes:
- Keyboard navigation support
- ARIA labels for screen readers
- Focus management
- High contrast support

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Dependencies

- React 18+
- CSS Modules support
- No external dependencies required

## Contributing

1. Ensure all props are documented
2. Add unit tests for new features
3. Follow the existing code style
4. Update this README for any new functionality
