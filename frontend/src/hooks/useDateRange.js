import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing date ranges and filtering data
 * Provides backend functionality for the DateRangePickerModal
 */
const useDateRange = (initialStart = new Date(), initialEnd = new Date()) => {
  const [dateRange, setDateRange] = useState({
    start: initialStart,
    end: initialEnd
  });
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Format date for API calls
  const formatDateForAPI = useCallback((date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }, []);

  // Filter data based on date range
  const filterDataByDateRange = useCallback((data, dateField = 'date') => {
    if (!data || !Array.isArray(data)) return [];
    
    return data.filter(item => {
      const itemDate = new Date(item[dateField]);
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      // Set time to beginning/end of day for accurate comparison
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      itemDate.setHours(0, 0, 0, 0);
      
      return itemDate >= startDate && itemDate <= endDate;
    });
  }, [dateRange]);

  // Update date range
  const updateDateRange = useCallback((startDate, endDate) => {
    setDateRange({
      start: new Date(startDate),
      end: new Date(endDate)
    });
  }, []);

  // Get predefined date ranges
  const getPresetDateRange = useCallback((preset) => {
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
      
      case 'this-year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        return { start: startOfYear, end: endOfYear };
      
      case 'last-year':
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
        return { start: lastYearStart, end: lastYearEnd };
      
      default:
        return { start: now, end: now };
    }
  }, []);

  // Apply preset date range
  const applyPreset = useCallback((preset) => {
    const { start, end } = getPresetDateRange(preset);
    updateDateRange(start, end);
  }, [getPresetDateRange, updateDateRange]);

  // Fetch data from API based on date range
  const fetchDataByDateRange = useCallback(async (apiEndpoint, options = {}) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: formatDateForAPI(dateRange.start),
        endDate: formatDateForAPI(dateRange.end),
        ...options.params
      });

      const response = await fetch(`${apiEndpoint}?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setFilteredData(data);
      return data;
    } catch (error) {
      console.error('Error fetching data by date range:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, formatDateForAPI]);

  // Get analytics for the current date range
  const getDateRangeAnalytics = useCallback((data, dateField = 'date') => {
    const filtered = filterDataByDateRange(data, dateField);
    
    const analytics = {
      totalRecords: filtered.length,
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        days: Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)) + 1
      },
      groupedByDate: {}
    };

    // Group data by date
    filtered.forEach(item => {
      const date = new Date(item[dateField]).toDateString();
      if (!analytics.groupedByDate[date]) {
        analytics.groupedByDate[date] = [];
      }
      analytics.groupedByDate[date].push(item);
    });

    return analytics;
  }, [dateRange, filterDataByDateRange]);

  // Get formatted date range string
  const getFormattedDateRange = useCallback((format = 'short') => {
    const options = format === 'long' 
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };

    const startFormatted = dateRange.start.toLocaleDateString('en-US', options);
    const endFormatted = dateRange.end.toLocaleDateString('en-US', options);

    if (dateRange.start.toDateString() === dateRange.end.toDateString()) {
      return startFormatted;
    }

    return `${startFormatted} - ${endFormatted}`;
  }, [dateRange]);

  // Check if current date range is a preset
  const getCurrentPreset = useCallback(() => {
    const presets = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month', 'this-year', 'last-year'];
    
    for (const preset of presets) {
      const { start, end } = getPresetDateRange(preset);
      if (
        dateRange.start.toDateString() === start.toDateString() &&
        dateRange.end.toDateString() === end.toDateString()
      ) {
        return preset;
      }
    }
    return null;
  }, [dateRange, getPresetDateRange]);

  return {
    // State
    dateRange,
    filteredData,
    isLoading,
    
    // Actions
    updateDateRange,
    applyPreset,
    filterDataByDateRange,
    fetchDataByDateRange,
    
    // Utilities
    formatDateForAPI,
    getFormattedDateRange,
    getDateRangeAnalytics,
    getCurrentPreset,
    getPresetDateRange
  };
};

export default useDateRange;
