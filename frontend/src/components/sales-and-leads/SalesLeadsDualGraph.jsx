import React, { useMemo, useState, useEffect, useRef } from "react";
import styles from "./SalesLeadsDualGraph.module.css";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import smile_emoji from "../../assets/dashboard/bxs_smile.svg";
import UserService from "../../services/UserService";

const monthsBack = 12;

function getMonthBuckets() {
  const now = new Date();
  const labels = [];
  const starts = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleDateString("en-US", { month: "short" }));
    starts.push(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  const ends = starts.map((s) => new Date(s.getFullYear(), s.getMonth() + 1, 1));
  return { labels, starts, ends };
}

function sumOpportunity(clients, predicate) {
  return clients.reduce((acc, c) => {
    const val = parseFloat(c.opportunityValue || 0) || 0;
    return predicate(c) ? acc + val : acc;
  }, 0);
}

function count(clients, predicate) {
  return clients.reduce((acc, c) => (predicate(c) ? acc + 1 : acc), 0);
}

function aggregateSalesRevenue(clients, starts, ends) {
  const revenue = [];
  const wonCount = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = ends[i];
    const inMonth = clients.filter((c) => c.createdAt && new Date(c.createdAt) >= s && new Date(c.createdAt) < e);
    
    const rev = sumOpportunity(
      inMonth,
      (c) => String(c.currentStatus) === "Won" && String(c.relationshipStatus) === "Active"
    );
    
    const cnt = count(
      inMonth,
      (c) => String(c.currentStatus) === "Won" && String(c.relationshipStatus) === "Active"
    );
    
    revenue.push(rev);
    wonCount.push(cnt);
  }
  return { a: revenue, b: wonCount, legendA: "Revenue", legendB: "Won Deals" };
}

const pipelineStatuses = new Set(["Lead", "Quoted", "Negotiation"]);
const followPipeline = new Set(["Progress", "Pending", "Needs Analysis", "Demo Scheduled", "Proposal Sent", "Contacted"]);

function aggregateLeadsPipeline(clients, starts, ends) {
  const leadsCreated = [];
  const inPipeline = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = ends[i];
    const inMonth = clients.filter((c) => c.createdAt && new Date(c.createdAt) >= s && new Date(c.createdAt) < e);
    
    const leads = count(inMonth, (c) => ["Lead", "Client"].includes(String(c.leadType)));
    
    const pipe = count(
      inMonth,
      (c) => (pipelineStatuses.has(String(c.currentStatus)) || followPipeline.has(String(c.followupStatus))) 
             && ["Prospect", "Active"].includes(String(c.relationshipStatus))
    );
    
    leadsCreated.push(leads);
    inPipeline.push(pipe);
  }
  return { a: leadsCreated, b: inPipeline, legendA: "Total Leads", legendB: "Active Pipeline" };
}

function generateSmoothPath(points, width, height, maxVal) {
  if (points.length === 0) return "";

  const stepX = width / (points.length - 1);
  
  const coords = points.map((val, i) => {
    const x = i * stepX;
    const normalizedVal = maxVal === 0 ? 0 : val / maxVal;
    const y = height - (normalizedVal * (height * 0.9)); 
    return { x, y };
  });

  if (coords.length === 1) {
    return {
      d: `M ${coords[0].x} ${coords[0].y} L ${coords[0].x + width} ${coords[0].y}`,
      coords
    };
  }

  let d = `M ${coords[0].x} ${coords[0].y}`;
  
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }
  
  return { d, coords };
}

export default function SalesLeadsDualGraph({ clients = [], isLoading = false }) {
  const { labels, starts, ends } = useMemo(getMonthBuckets, []);
  const [mode, setMode] = useState("Sales/Revenue");
  const [hoverIndex, setHoverIndex] = useState(null);
  
  // Employee Filter State
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [userRole, setUserRole] = useState("");

  // Dynamic Width State
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(821); // Default desktop width
  const [containerWidth, setContainerWidth] = useState(1017);

  useEffect(() => {
    const role = localStorage.getItem("role");
    setUserRole(role);
    if (role === "admin") {
      UserService.getAllUsers()
        .then(setUsers)
        .catch(err => console.error("Failed to fetch users for filter:", err));
    }
  }, []);

  // Resize Observer to handle dynamic width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setContainerWidth(width);
        // Calculate chart width based on container padding/layout
        // Desktop: left padding ~129px, right padding ~67px -> total ~196px
        // Mobile: smaller margins
        const isMobile = width < 768;
        const leftMargin = isMobile ? 40 : 129;
        const rightMargin = isMobile ? 20 : 67;
        const availableWidth = Math.max(100, width - leftMargin - rightMargin);
        setChartWidth(availableWidth);
      }
    };

    // Initial calculation
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Filter clients based on selected employee
  const filteredClients = useMemo(() => {
    if (!selectedUser) return clients;
    return clients.filter(c => c.assignedTo === selectedUser);
  }, [clients, selectedUser]);
  
  const data = useMemo(() => {
    if (mode === "Sales/Revenue") return aggregateSalesRevenue(filteredClients, starts, ends);
    return aggregateLeadsPipeline(filteredClients, starts, ends);
  }, [filteredClients, mode, starts, ends]);

  // Calculate totals for the period
  const totalA = useMemo(() => data.a.reduce((sum, val) => sum + val, 0), [data.a]);
  const totalB = useMemo(() => data.b.reduce((sum, val) => sum + val, 0), [data.b]);

  // Calculate percentage changes (Trend)
  const calculatePercentageChange = (series) => {
    if (series.length < 2) return "0%";
    const current = series[series.length - 1];
    const previous = series[series.length - 2];
    
    if (previous === 0) {
       if (current === 0) return "0%";
       return "New"; // Or just show nothing?
    }
    
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${Math.round(change)}%`;
  };

  const percentageA = calculatePercentageChange(data.a);
  const percentageB = calculatePercentageChange(data.b);

  // Chart dimensions
  const chartHeight = 300; 
  const chartTop = 200;
  // Dynamic left position based on width
  const isMobile = containerWidth < 768;
  const chartLeft = isMobile ? 40 : 129;
  
  const maxVal = Math.max(...data.a, ...data.b, 1);
  
  const pathA = useMemo(() => generateSmoothPath(data.a, chartWidth, chartHeight, maxVal), [data.a, maxVal, chartHeight, chartWidth]);
  const pathB = useMemo(() => generateSmoothPath(data.b, chartWidth, chartHeight, maxVal), [data.b, maxVal, chartHeight, chartWidth]);

  const currentTooltipData = useMemo(() => {
    const index = hoverIndex !== null ? hoverIndex : data.a.length - 1;
    return {
      valueA: data.a[index] || 0,
      valueB: data.b[index] || 0,
      label: labels[index] || ""
    };
  }, [hoverIndex, data, labels]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const stepX = chartWidth / (data.a.length - 1);
    const index = Math.min(Math.max(Math.round(x / stepX), 0), data.a.length - 1);
    setHoverIndex(index);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div className={styles.conversionDataContainer} ref={containerRef}>
      {/* Background glow effect */}
      <div className={styles.backgroundGlow}>
        <svg width="100%" height="100%" viewBox="0 0 860 484" fill="none" preserveAspectRatio="none">
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
          <h2 className={styles.title}>Sales by month Infographics</h2>
          <p className={styles.subtitle}>
            {isLoading ? (
              'Loading sales data...'
            ) : (
              <>
                {mode === "Sales/Revenue" 
                  ? "Track your revenue growth and won deals performance"
                  : "Monitor leads pipeline and conversion progress"
                }
              </>
            )}
          </p>
        </div>
        <div className={styles.headerRight}>
          {/* Employee Filter Dropdown (Admin Only) */}
          {userRole === 'admin' && (
            <select 
              className={styles.select} 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ marginRight: '10px' }}
            >
              <option value="">All Employees</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.username}</option>
              ))}
            </select>
          )}

          <select className={styles.select} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option>Sales/Revenue</option>
            <option>Leads Pipeline</option>
          </select>
          {/* <button className={styles.actionButton}>
            <img src={arrowupright} alt="arrow up right" />
          </button> */}
        </div>
      </div>

      {/* Total Indicators (Big Numbers) */}
      <div className={styles.percentageIndicators}>
        <div className={styles.percentageItem}>
          <div className={styles.indicatorValue}>
            {mode === "Sales/Revenue" ? `₹${totalA.toLocaleString()}` : totalA}
          </div>
          <div className={styles.indicatorInfo}>
            <div className={styles.indicatorTitle}>{data.legendA}</div>
            <div className={styles.indicatorSubtitle}>
               <span className={percentageA.includes('+') ? styles.trendPositive : styles.trendNegative}>
                 {percentageA}
               </span> vs last month
            </div>
          </div>
        </div>
        <div className={styles.percentageItem}>
          <div className={styles.indicatorValue}>
            {totalB}
          </div>
          <div className={styles.indicatorInfo}>
            <div className={styles.indicatorTitle}>{data.legendB}</div>
            <div className={styles.indicatorSubtitle}>
               <span className={percentageB.includes('+') ? styles.trendPositive : styles.trendNegative}>
                 {percentageB}
               </span> vs last month
            </div>
          </div>
        </div>
      </div>

      {/* Chart Section Wrapper */}
      <div className={styles.chartSectionWrapper}>
        {/* Y-axis labels */}
        <div className={styles.yAxisLabels} style={{ height: chartHeight }}>
          <span className={styles.yAxisLabel}>{Math.round(maxVal)}</span>
          <span className={styles.yAxisLabel}>{Math.round(maxVal / 2)}</span>
          <span className={styles.yAxisLabel}>0</span>
        </div>

        {/* Chart Area */}
        <div 
          className={styles.chartContainer} 
          style={{ 
            width: `${chartWidth}px`, 
            height: `${chartHeight}px`,
            marginLeft: isMobile ? '40px' : '129px'
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal grid lines */}
          <div className={styles.gridLine} style={{ top: 0, width: '100%' }}></div>
          <div className={styles.gridLine} style={{ top: '50%', width: '100%' }}></div>
          <div className={styles.gridLine} style={{ top: '100%', width: '100%' }}></div>

          {/* Chart background */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" fill="none">
              <path
                d={`${pathA.d} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
                fill="url(#paint0_linear_chart)"
                opacity="0.5"
              />
              <defs>
                <linearGradient
                  id="paint0_linear_chart"
                  x1={chartWidth / 2}
                  y1="0"
                  x2={chartWidth / 2}
                  y2={chartHeight}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#CFD5FF" />
                  <stop offset="1" stopColor="#CFD5FF" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Chart lines */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" fill="none">
              <path d={pathA.d} stroke="#334AFA" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" fill="none">
              <path d={pathB.d} stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          {/* Data Points A */}
          {pathA.coords && pathA.coords.map((coord, i) => (
            <div key={`a-${i}`} style={{ position: 'absolute', left: `${(coord.x / chartWidth) * 100}%`, top: `${(coord.y / chartHeight) * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill="#334AFA" />
              </svg>
            </div>
          ))}

          {/* Data Points B */}
          {pathB.coords && pathB.coords.map((coord, i) => (
            <div key={`b-${i}`} style={{ position: 'absolute', left: `${(coord.x / chartWidth) * 100}%`, top: `${(coord.y / chartHeight) * 100}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <circle cx="4" cy="4" r="4" fill="#06b6d4" />
              </svg>
            </div>
          ))}

          {/* Hover Indicator */}
          {hoverIndex !== null && pathA.coords && pathA.coords[hoverIndex] && (
             <div style={{ position: 'absolute', left: `${(pathA.coords[hoverIndex].x / chartWidth) * 100}%`, top: 0, height: '100%', width: '2px', backgroundColor: 'rgba(0,0,0,0.1)', pointerEvents: 'none' }} />
          )}
        </div>
      </div>

      {/* Fade gradient overlay */}
      <div className={styles.fadeOverlay}></div>

      {/* Legend - Moved to bottom */}
      <div className={styles.legend} style={{ marginLeft: isMobile ? '40px' : '129px' }}>
        <div className={styles.legendItem}>
          <div className={styles.legendDotA}></div>
          <span>{data.legendA}</span>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDotB}></div>
          <span>{data.legendB}</span>
        </div>
      </div>

      {/* Tooltip */}
      <div className={styles.conversionTooltip}>
        <div className={styles.tooltipIcon}>
          <img src={smile_emoji} alt="smile" />
        </div>
        <div className={styles.tooltipContent}>
          <div className={styles.tooltipPercentage}>
            {isLoading ? '--' : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                 <span style={{ color: '#334AFA', fontSize: '14px' }}>
                    {data.legendA}: {mode === "Sales/Revenue" ? `${currentTooltipData.valueA.toLocaleString()}` : currentTooltipData.valueA}
                 </span>
                 <span style={{ color: '#06b6d4', fontSize: '14px' }}>
                    {data.legendB}: {currentTooltipData.valueB}
                 </span>
              </div>
            )}
          </div>
          <div className={styles.tooltipDate}>
            {currentTooltipData.label}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerText}>
          Showing data for the last 12 months based on client creation date.
        </div>
      </div>
    </div>
  );
}