/**
 * Date utility functions for the date range picker and related components
 */

// Format date for different use cases
export const formatDate = {
  // For API calls (YYYY-MM-DD)
  forAPI: (date) => {
    if (!date) return null;
    return new Date(date).toISOString().split('T')[0];
  },

  // For display (Jan 6, 2025)
  forDisplay: (date, options = {}) => {
    if (!date) return '';
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
  },

  // For input fields (MM/DD/YYYY)
  forInput: (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US');
  },

  // For database storage (ISO string)
  forDatabase: (date) => {
    if (!date) return null;
    return new Date(date).toISOString();
  },

  // Relative time (e.g., "2 days ago", "in 3 hours")
  relative: (date) => {
    if (!date) return '';
    
    const now = new Date();
    const target = new Date(date);
    const diffMs = target - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === 0) return 'today';
    if (diffDays === -1) return 'yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    
    if (diffHours > 1) return `in ${diffHours} hours`;
    if (diffHours === 1) return 'in 1 hour';
    if (diffHours === -1) return '1 hour ago';
    if (diffHours < -1) return `${Math.abs(diffHours)} hours ago`;
    
    if (diffMinutes > 1) return `in ${diffMinutes} minutes`;
    if (diffMinutes === 1) return 'in 1 minute';
    if (diffMinutes === -1) return '1 minute ago';
    if (diffMinutes < -1) return `${Math.abs(diffMinutes)} minutes ago`;
    
    return 'now';
  }
};

// Date range presets
export const getDateRangePreset = (preset) => {
  const today = new Date();
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  switch (preset) {
    case 'today':
      return { start: now, end: now };
    
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
    
    case 'this-week':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      return { start: startOfWeek, end: endOfWeek };
    
    case 'last-week':
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - now.getDay() + 1 - 7); // Previous Monday
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6); // Previous Sunday
      return { start: lastWeekStart, end: lastWeekEnd };
    
    case 'this-month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: startOfMonth, end: endOfMonth };
    
    case 'last-month':
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: lastMonthStart, end: lastMonthEnd };
    
    case 'this-quarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      const quarterEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      return { start: quarterStart, end: quarterEnd };
    
    case 'last-quarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      const lastQuarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
      const lastQuarterStart = new Date(lastQuarterYear, adjustedQuarter * 3, 1);
      const lastQuarterEnd = new Date(lastQuarterYear, (adjustedQuarter + 1) * 3, 0);
      return { start: lastQuarterStart, end: lastQuarterEnd };
    
    case 'this-year':
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const endOfYear = new Date(now.getFullYear(), 11, 31);
      return { start: startOfYear, end: endOfYear };
    
    case 'last-year':
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
      return { start: lastYearStart, end: lastYearEnd };
    
    case 'last-7-days':
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      return { start: sevenDaysAgo, end: now };
    
    case 'last-30-days':
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 29);
      return { start: thirtyDaysAgo, end: now };
    
    case 'last-90-days':
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(now.getDate() - 89);
      return { start: ninetyDaysAgo, end: now };
    
    default:
      return { start: now, end: now };
  }
};

// Date validation
export const validateDate = {
  // Check if date is valid
  isValid: (date) => {
    return date instanceof Date && !isNaN(date);
  },

  // Check if date is in the future
  isFuture: (date) => {
    return new Date(date) > new Date();
  },

  // Check if date is in the past
  isPast: (date) => {
    return new Date(date) < new Date();
  },

  // Check if date is today
  isToday: (date) => {
    const today = new Date();
    const targetDate = new Date(date);
    return (
      targetDate.getDate() === today.getDate() &&
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getFullYear() === today.getFullYear()
    );
  },

  // Check if two dates are the same day
  isSameDay: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  },

  // Check if date is within range
  isInRange: (date, startDate, endDate) => {
    const target = new Date(date);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return target >= start && target <= end;
  }
};

// Date calculations
export const calculateDate = {
  // Add days to a date
  addDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },

  // Subtract days from a date
  subtractDays: (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  },

  // Add months to a date
  addMonths: (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  },

  // Subtract months from a date
  subtractMonths: (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
  },

  // Get difference in days between two dates
  daysBetween: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  // Get start of day
  startOfDay: (date) => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  },

  // Get end of day
  endOfDay: (date) => {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  },

  // Get start of week (Monday)
  startOfWeek: (date) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    result.setDate(diff);
    return calculateDate.startOfDay(result);
  },

  // Get end of week (Sunday)
  endOfWeek: (date) => {
    const startOfWeek = calculateDate.startOfWeek(date);
    return calculateDate.endOfDay(calculateDate.addDays(startOfWeek, 6));
  },

  // Get start of month
  startOfMonth: (date) => {
    const result = new Date(date);
    result.setDate(1);
    return calculateDate.startOfDay(result);
  },

  // Get end of month
  endOfMonth: (date) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    return calculateDate.endOfDay(result);
  }
};

// Filter data by date range
export const filterByDateRange = (data, startDate, endDate, dateField = 'date') => {
  if (!data || !Array.isArray(data)) return [];
  
  const start = calculateDate.startOfDay(startDate);
  const end = calculateDate.endOfDay(endDate);
  
  return data.filter(item => {
    const itemDate = new Date(item[dateField]);
    return itemDate >= start && itemDate <= end;
  });
};

// Group data by date
export const groupByDate = (data, dateField = 'date', groupBy = 'day') => {
  if (!data || !Array.isArray(data)) return {};
  
  const grouped = {};
  
  data.forEach(item => {
    const date = new Date(item[dateField]);
    let key;
    
    switch (groupBy) {
      case 'day':
        key = formatDate.forAPI(date);
        break;
      case 'week':
        key = formatDate.forAPI(calculateDate.startOfWeek(date));
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'year':
        key = date.getFullYear().toString();
        break;
      default:
        key = formatDate.forAPI(date);
    }
    
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  });
  
  return grouped;
};

// Generate date range array
export const generateDateRange = (startDate, endDate, interval = 'day') => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  
  while (current <= end) {
    dates.push(new Date(current));
    
    switch (interval) {
      case 'day':
        current = calculateDate.addDays(current, 1);
        break;
      case 'week':
        current = calculateDate.addDays(current, 7);
        break;
      case 'month':
        current = calculateDate.addMonths(current, 1);
        break;
      default:
        current = calculateDate.addDays(current, 1);
    }
  }
  
  return dates;
};

export default {
  formatDate,
  getDateRangePreset,
  validateDate,
  calculateDate,
  filterByDateRange,
  groupByDate,
  generateDateRange
};
