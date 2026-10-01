import React, { useState, useEffect } from 'react';
import DateRangePickerModal from './DateRangePickerModal';
import useDateRange from '../hooks/useDateRange';
import { formatDate, calculateDate } from '../utils/dateUtils';
import styles from './DateRangeExample.module.css';

/**
 * Comprehensive example showing all DateRangePickerModal features and backend functionality
 */
const DateRangeExample = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sampleData, setSampleData] = useState([]);

  // Use the date range hook
  const {
    dateRange,
    updateDateRange,
    getFormattedDateRange,
    getCurrentPreset,
    filterDataByDateRange,
    getDateRangeAnalytics
  } = useDateRange();

  // Sample data to demonstrate filtering
  const generateSampleData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = calculateDate.subtractDays(today, i);
      data.push({
        id: i + 1,
        title: `Event ${i + 1}`,
        date: formatDate.forAPI(date),
        value: Math.floor(Math.random() * 1000) + 100,
        type: ['meeting', 'call', 'presentation'][Math.floor(Math.random() * 3)]
      });
    }
    
    return data;
  };

  useEffect(() => {
    setSampleData(generateSampleData());
  }, []);

  // Filter data based on current date range
  const filteredData = filterDataByDateRange(sampleData, 'date');
  const analytics = getDateRangeAnalytics(sampleData, 'date');

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleApplyDateRange = (startDate, endDate) => {
    updateDateRange(startDate, endDate);
    setIsModalOpen(false);
  };

  const totalValue = filteredData.reduce((sum, item) => sum + item.value, 0);
  const currentPreset = getCurrentPreset();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Date Range Picker Example</h2>
        <p className={styles.description}>
          Demonstrates the DateRangePickerModal with full backend functionality
        </p>
      </div>

      {/* Date Range Selector */}
      <div className={styles.dateSelector}>
        <div className={styles.currentRange}>
          <h3>Selected Date Range</h3>
          <div className={styles.rangeInfo}>
            <span className={styles.dateText}>{getFormattedDateRange('long')}</span>
            {currentPreset && (
              <span className={styles.presetBadge}>
                {currentPreset.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
            )}
          </div>
        </div>
        
        <button className={styles.selectButton} onClick={handleOpenModal}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.6667 2.66634H3.33333C2.59695 2.66634 2 3.26329 2 3.99967V12.6663C2 13.4027 2.59695 13.9997 3.33333 13.9997H12.6667C13.403 13.9997 14 13.4027 14 12.6663V3.99967C14 3.26329 13.403 2.66634 12.6667 2.66634Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10.6667 1.33301V3.99967" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5.33333 1.33301V3.99967" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 7.33301H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Change Date Range
        </button>
      </div>

      {/* Analytics */}
      <div className={styles.analytics}>
        <h3>Analytics for Selected Period</h3>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{analytics.totalRecords}</div>
            <div className={styles.statLabel}>Total Events</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{analytics.dateRange.days}</div>
            <div className={styles.statLabel}>Days in Range</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>${totalValue.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Value</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>
              {analytics.totalRecords > 0 ? Math.round(totalValue / analytics.totalRecords) : 0}
            </div>
            <div className={styles.statLabel}>Avg per Event</div>
          </div>
        </div>
      </div>

      {/* Filtered Data */}
      <div className={styles.dataSection}>
        <h3>Filtered Data ({filteredData.length} items)</h3>
        <div className={styles.dataTable}>
          <div className={styles.tableHeader}>
            <div>Date</div>
            <div>Title</div>
            <div>Type</div>
            <div>Value</div>
          </div>
          {filteredData.length > 0 ? (
            filteredData.slice(0, 10).map(item => (
              <div key={item.id} className={styles.tableRow}>
                <div className={styles.dateCell}>
                  {formatDate.forDisplay(item.date)}
                </div>
                <div>{item.title}</div>
                <div>
                  <span className={`${styles.typeBadge} ${styles[item.type]}`}>
                    {item.type}
                  </span>
                </div>
                <div className={styles.valueCell}>
                  ${item.value.toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noData}>
              No data found for the selected date range
            </div>
          )}
        </div>
        {filteredData.length > 10 && (
          <div className={styles.showMore}>
            ... and {filteredData.length - 10} more items
          </div>
        )}
      </div>

      {/* Date Range Picker Modal */}
      <DateRangePickerModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onApplyDateRange={handleApplyDateRange}
        initialStartDate={dateRange.start}
        initialEndDate={dateRange.end}
      />
    </div>
  );
};

export default DateRangeExample;
