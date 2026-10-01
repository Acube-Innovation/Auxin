import React from "react";
import styles from "./ConversionDataChart.module.css";
import arrowupright from "../assets/dashboard/arrow-up-right.svg";
import smile_emoji from "../assets/dashboard/bxs_smile.svg";

function ConversionDataChart({ conversionData = [], isLoading = false }) {
  const getCurrentConversionRate = () => {
    if (!conversionData || conversionData.length === 0) return 0;
    const latestData = conversionData[conversionData.length - 1];
    return latestData ? latestData.rate : 0;
  };

  const getPreviousConversionRate = () => {
    if (!conversionData || conversionData.length < 2) return 0;
    const previousData = conversionData[conversionData.length - 2];
    return previousData ? previousData.rate : 0;
  };

  const currentRate = getCurrentConversionRate();
  const previousRate = getPreviousConversionRate();
  const improvement = previousRate > 0 ? (((currentRate - previousRate) / previousRate) * 100).toFixed(1) : 0;

  return (
    <div className={styles.conversionDataContainer}>
      {/* Background glow effect */}
      <div className={styles.backgroundGlow}>
        <svg width="492" height="242" viewBox="0 0 860 484" fill="none">
          <g opacity="0.4">
            <g opacity="0.45" filter="url(#filter0_f_bg)">
              <ellipse cx="617" cy="134.488" rx="246" ry="121" fill="#FDE8AE" />
            </g>
            <g opacity="0.23" filter="url(#filter1_f_bg)">
              <ellipse cx="616.822" cy="134.805" rx="108.659" ry="83.3053" fill="#FDE8AE" />
            </g>
          </g>
          <defs>
            <filter id="filter0_f_bg" x="0.955444" y="-356.556" width="1232.09" height="982.089" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="185.022" result="effect1_foregroundBlur_bg" />
            </filter>
            <filter id="filter1_f_bg" x="384.292" y="-72.3714" width="465.061" height="414.354" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix" />
              <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
              <feGaussianBlur stdDeviation="61.9357" result="effect1_foregroundBlur_bg" />
            </filter>
          </defs>
        </svg>
      </div>

      {/* Header section */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>Conversion data</h2>
          <p className={styles.subtitle}>
            {isLoading ? (
              'Loading conversion data...'
            ) : improvement >= 0 ? (
              <>
                Conversion rate has improved by {Math.abs(improvement)}% from last month!
                <br />
                Keep up the good work!
              </>
            ) : (
              <>
                Conversion rate has decreased by {Math.abs(improvement)}% from last month.
                <br />
                Let's work on improving it!
              </>
            )}
          </p>
        </div>
        <button className={styles.actionButton}>
          <img src={arrowupright} alt="arrow up right" />
        </button>
      </div>

      {/* Y-axis labels */}
      <div className={styles.yAxisLabels}>
        <span className={styles.yAxisLabel}>100%</span>
        <span className={styles.yAxisLabel}>50%</span>
        <span className={styles.yAxisLabel}>0%</span>
      </div>

      {/* Horizontal grid lines */}
      <div className={styles.gridLine} style={{ top: '206px' }}></div>
      <div className={styles.gridLine} style={{ top: '325px' }}></div>
      <div className={styles.gridLine} style={{ top: '443px' }}></div>

      {/* Chart background area with gradient */}
      <div className={styles.chartBackground}>
        <svg width="821" height="152" viewBox="0 0 822 153" fill="none">
          <path
            d="M103.131 64.5374C58.8744 59.9387 0.508789 15.0371 0.508789 15.0371V152.487H821.489V14.4334C821.489 14.4334 759.197 27.1049 718.866 32.5433C678.973 37.9226 656.132 47.6156 616.244 42.2019C573.472 36.3967 556.614 4.98763 513.621 1.15289C473.237 -2.44914 449.542 6.27641 411.662 20.2258L410.999 20.4701C367.026 36.662 355.139 79.6588 308.376 82.6472C265.387 85.3944 248.715 45.3485 205.754 42.2019C164.849 39.2058 143.926 68.7763 103.131 64.5374Z"
            fill="url(#paint0_linear_chart)"
          />
          <defs>
            <linearGradient
              id="paint0_linear_chart"
              x1="410.999"
              y1="1.15289"
              x2="410.999"
              y2="152.487"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#CFD5FF" />
              <stop offset="1" stopColor="#CFD5FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Chart line */}
      <div className={styles.chartLine}>
        <svg width="821" height="82" viewBox="0 0 824 85" fill="none">
          <path
            d="M1.50879 16.0371C1.50879 16.0371 59.8744 60.9387 104.131 65.5374C144.926 69.7763 165.849 40.2058 206.754 43.2019C249.715 46.3485 266.387 86.3944 309.376 83.6472C356.139 80.6588 368.026 37.662 411.999 21.4701C450.267 7.37845 474.002 -1.47011 514.621 2.15289C557.614 5.98763 574.472 37.3967 617.244 43.2019C657.132 48.6156 679.973 38.9226 719.866 33.5433C760.197 28.1049 782.732 24.1281 822.489 15.4334"
            stroke="#334AFA"
            strokeWidth="2.41465"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Chart data points */}
      <div className={styles.chartPoint1}>
        <svg width="8" height="8" viewBox="0 0 9 9" fill="none">
          <circle cx="4.29621" cy="4.22199" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPoint2}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPoint3}>
        <svg width="8" height="8" viewBox="0 0 9 9" fill="none">
          <circle cx="4.91877" cy="4.72199" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPointMain}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPoint4}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPointHighlight}>
        <svg width="35" height="35" viewBox="0 0 35 36" fill="none">
          <circle opacity="0.4" cx="17.5" cy="17.9883" r="17.5" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPointHighlightCenter}>
        <svg width="13" height="13" viewBox="0 0 13 14" fill="none">
          <circle cx="6.5" cy="6.98828" r="6.5" fill="white" />
        </svg>
      </div>

      <div className={styles.chartPoint5}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPoint6}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      <div className={styles.chartPoint7}>
        <svg width="16" height="16" viewBox="0 0 16 17" fill="none">
          <circle opacity="0.2" cx="8" cy="8.48828" r="8" fill="#334AFA" />
          <circle cx="8.01301" cy="8.50129" r="4.01301" fill="#334AFA" />
        </svg>
      </div>

      {/* Fade gradient overlay */}
      <div className={styles.fadeOverlay}></div>

      {/* Conversion rate tooltip */}
      <div className={styles.conversionTooltip}>
        <div className={styles.tooltipIcon}>
          <img src={smile_emoji} alt="smile" />
        </div>
        <div className={styles.tooltipContent}>
          <div className={styles.tooltipPercentage}>
            {isLoading ? '--' : `${currentRate.toFixed(0)}%`}
          </div>
          <div className={styles.tooltipDate}>
            {isLoading ? 'Loading...' : new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConversionDataChart;
