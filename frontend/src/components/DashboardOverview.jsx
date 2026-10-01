import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./DashboardOverview.module.css";
import { formatDate } from "../utils/dateUtils";
import ConversionDataChart from "./ConversionDataChart";
import CheckIn from "../components/CheckIn";
import YourCalendarWidget from "./YourCalendarWidget";
import SalesLeadsDualGraph from "./sales-and-leads/SalesLeadsDualGraph";
import checkInService from "../services/CheckInService";
import MeetingService from "../services/MeetingService";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import config from "../config/config";
import NotificationBell from "../components/NotificationBell";
// Import available icons
import arrowupright from "../assets/dashboard/arrow-up-right.svg";
import settings from "../assets/dashboard/settings.svg";
import calendar from "../assets/dashboard/calendar.svg";
import plus from "../assets/dashboard/plus.svg";
import weather from "../assets/dashboard/weather.png";
import threedot from "../assets/dashboard/3dot.svg";
import smile_emoji from "../assets/dashboard/bxs_smile.svg";
import quote_solid from "../assets/dashboard/quote-solid.svg";
import Ellipse_dot from "../assets/dashboard/Ellipse27.svg";
// In your frontend components, this should work:
import { Container, Row, Col, Card } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function DashboardOverview() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [lastCheckInTime, setLastCheckInTime] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [meetings, setMeetings] = useState([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [conversionMetrics, setConversionMetrics] = useState({
    totalLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    changePercentage: 0,
    weeklyActivity: [],
    monthlyConversionData: []
  });

  const [dashboardMetrics, setDashboardMetrics] = useState({
    totalSalesAndLeads: 0,
    totalWon: 0,
    totalOpportunityValue: 0,
    monthlyGrowth: 0
  });

  useEffect(() => {
    const storedUsername = localStorage.getItem("username") || "User";
    const storedUserId = localStorage.getItem("userId");
    
    setUsername(storedUsername);
    console.log("Dashboard mounted - User ID:", storedUserId);

    const now = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const formatted = now.toLocaleDateString("en-US", options);
    setCurrentDate(`It's ${formatted}`);

    fetchLastCheckIn();
    loadMeetingsForCurrentUser();
    fetchClientsData();
    // calculateDashboardMetrics();
  }, []);

  useEffect(() => {
  calculateDashboardMetrics();
}, [clients, meetings]);

  const fetchLastCheckIn = async () => {
    try {
      const userId = localStorage.getItem("userId");
      const role = localStorage.getItem("role") || "";
      console.log("Fetching check-ins for user:", userId, "role:", role);
      setDebugInfo(`User ID: ${userId || 'NOT FOUND'} | Role: ${role || 'NOT FOUND'}`);
      
      // Don't return early if userId missing — service can use /user/me
      if (role === 'admin') {
        // Admin: fetch global latest check-ins (page 1, limit 1)
        const resp = await checkInService.getCheckIns(1, 1);
        console.log('Admin getCheckIns response:', resp);
        let latest = null;
        if (resp && Array.isArray(resp.checkIns) && resp.checkIns.length > 0) {
          latest = resp.checkIns[0];
        } else if (Array.isArray(resp) && resp.length > 0) {
          latest = resp[0];
        }
        if (latest && latest.timestamp) {
          setLastCheckInTime(latest.timestamp);
          setDebugInfo(`Admin latest check-in: ${new Date(latest.timestamp).toString()}`);
        } else {
          setLastCheckInTime(null);
          setDebugInfo("Admin: no check-ins found");
        }
      } else {
        // Non-admin: fetch only their check-ins.
        // If userId is present pass it; otherwise call service without id to use /user/me
        const checkIns = await checkInService.getCheckInsByUser(userId || undefined);
        console.log("User check-ins response:", checkIns);
        if (checkIns && checkIns.length > 0) {
          setLastCheckInTime(checkIns[0].timestamp);
          setDebugInfo(`Found ${checkIns.length} check-ins, latest: ${new Date(checkIns[0].timestamp).toString()}`);
        } else {
          setLastCheckInTime(null);
          setDebugInfo("No check-ins found for user");
        }
      }
    } catch (err) {
      console.error("Error fetching check-ins:", err);
      setLastCheckInTime(null);
      setDebugInfo(`Error: ${err.message}`);
    }
  };

  // Load meetings for current user with filtering logic from YourCalendar
  async function loadMeetingsForCurrentUser() {
    setIsLoadingMeetings(true);
    try {
      const token = localStorage.getItem("token");
      let me = null;
      try {
        const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/,'')}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) me = await resp.json();
      } catch (e) {
        // fallback to localStorage
      }
      me = me || { _id: localStorage.getItem('userId'), username: localStorage.getItem('username'), emailId: localStorage.getItem('email'), role: localStorage.getItem('role') };
      const role = me.role || localStorage.getItem('role') || 'sales_executive';

      // fetch aggregated client events
      let clientEvents = [];
      try {
        const allEventsResp = await fetch(`${clientService.baseURL.replace(/\/clients\/?$/,'')}/clients/events`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (allEventsResp.ok) clientEvents = await allEventsResp.json();
      } catch (e) {
        console.warn('Failed to fetch client events', e);
        clientEvents = [];
      }

      // fetch standalone meetings
      // let meetingsList = [];
      // try {
      //   const raw = await MeetingService.getMeetings();
      //   meetingsList = Array.isArray(raw) ? raw : (raw.meetings || []);
      // } catch (e) {
      //   console.warn('Failed to fetch meetings', e);
      //   meetingsList = [];
      // }

      // // Normalize meetings
      // const normalizedMeetings = (meetingsList || []).map(m => {
      //   const date = m.date ? new Date(m.date) : null;
      //   return {
      //     _id: m._id || m.id,
      //     eventId: m._id || m.id,
      //     eventName: m.title || m.eventName || '',
      //     title: m.title || m.eventName || '',
      //     date: date ? date.toISOString().split('T')[0] : null,
      //     time: m.time || '',
      //     clientId: m.clientId || null,
      //     clientName: m.clientName || null,
      //     assignedTeamMembers: m.assignedTeamMembers || [],
      //     createdBy: m.createdBy || null,
      //     color: m.color || (m.meta && m.meta.meeting && m.meta.meeting.color) || '#FF9500',
      //     meetingLink: m.meetingLink || '',
      //     meta: { meeting: m }
      //   };
      // });

      // fetch standalone meetings
let meetingsList = [];
try {
  const raw = await MeetingService.getMeetings();
  meetingsList = Array.isArray(raw) ? raw : (raw.meetings || []);
} catch (e) {
  console.warn('Failed to fetch meetings', e);
  meetingsList = [];
}

// Normalize meetings - FIXED VERSION
const normalizedMeetings = (meetingsList || []).map(m => {
  const date = m.date ? new Date(m.date) : null;
  return {
    _id: m._id || m.id,
    eventId: m._id || m.id,
    eventName: m.title || m.eventName || '',
    title: m.title || m.eventName || '',
    date: date ? date.toISOString().split('T')[0] : null,
    time: m.time || '',
    clientId: m.clientId || null,
    clientName: m.clientName || null,
    assignedTeamMembers: m.assignedTeamMembers || [],
    createdBy: m.createdBy || null,
    color: m.color || (m.meta && m.meta.meeting && m.meta.meeting.color) || '#FF9500',
    link: m.link || m.meetingLink || '', // Make sure this line includes both possible field names
    meta: { meeting: m }
  };
});


      const events = [
        ...(Array.isArray(clientEvents) ? clientEvents : []),
        ...normalizedMeetings
      ];

      // Filter based on role
      let filteredEvents = [];
      if (role === 'admin') {
        filteredEvents = events;
      } else {
        let employee = null;
        try {
          const employees = await employeeService.getEmployees();
          employee = (employees || []).find(emp =>
            String(emp.user) === String(me._id) ||
            (emp.emailId && me.emailId && emp.emailId.toLowerCase() === me.emailId.toLowerCase())
          );
        } catch (e) {
          console.warn('Failed to resolve employee:', e);
        }

        const empId = employee?._id ? String(employee._id) : null;
        const usernameKey = (me.username || me.emailId || '').toString().toLowerCase();
        const userId = me._id ? String(me._id) : null;

        filteredEvents = (events || []).filter(ev => {
          if (ev.createdBy && (
              (userId && String(ev.createdBy) === userId) ||
              (usernameKey && ev.createdBy.toLowerCase && String(ev.createdBy).toLowerCase() === usernameKey)
            )) {
            return true;
          }

          const assignedTeam = ev.assignedTeamMembers || ev.meta?.event?.assignedTeamMembers || ev.assignedTo || ev.meta?.assignedTeamMembers;
          if (empId && Array.isArray(assignedTeam) && assignedTeam.map(String).includes(String(empId))) return true;

          if (ev.assignedBy && usernameKey && String(ev.assignedBy).toLowerCase() === usernameKey) return true;

          const metaAssigned = ev.meta?.event?.assignedTeamMembers || ev.meta?.assignedTeamMembers;
          if (empId && Array.isArray(metaAssigned) && metaAssigned.map(String).includes(String(empId))) return true;

          return false;
        });
      }

      setMeetings(filteredEvents);
    } catch (err) {
      console.error('Error loading meetings for calendar:', err);
      setMeetings([]);
    } finally {
      setIsLoadingMeetings(false);
    }
  }

  // Pass this to CheckIn so it can refresh after submit
  const handleCheckInLogged = () => {
    console.log("Check-in logged, refreshing...");
    setDebugInfo("Refreshing after check-in...");
    fetchLastCheckIn();
  };


  const fetchClientsData = async () => {
    setIsLoadingClients(true);
    try {
      const clientsData = await clientService.getClients();
      const clientsArray = Array.isArray(clientsData) ? clientsData : (clientsData.clients || []);
      setClients(clientsArray);
      calculateConversionMetrics(clientsArray);
      calculateDashboardMetrics();
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const calculateConversionMetrics = (clientsData) => {
    const totalLeads = clientsData.filter(c => c.leadType === 'Lead').length;
    const convertedLeads = clientsData.filter(c => c.leadType === 'Client').length;
    const conversionRate = totalLeads > 0 ? ((convertedLeads / (totalLeads + convertedLeads)) * 100).toFixed(2) : 0;

    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const lastMonthClients = clientsData.filter(c => {
      if (!c.createdAt) return false;
      const createdDate = new Date(c.createdAt);
      return createdDate >= lastMonth && createdDate < new Date(now.getFullYear(), now.getMonth(), 1);
    });

    const lastMonthLeads = lastMonthClients.filter(c => c.leadType === 'Lead').length;
    const lastMonthConverted = lastMonthClients.filter(c => c.leadType === 'Client').length;
    const lastMonthRate = lastMonthLeads > 0 ? ((lastMonthConverted / (lastMonthLeads + lastMonthConverted)) * 100) : 0;

    const changePercentage = lastMonthRate > 0 ? (((parseFloat(conversionRate) - lastMonthRate) / lastMonthRate) * 100).toFixed(2) : 0;

    const weeklyActivity = calculateWeeklyActivity(clientsData);
    const monthlyConversionData = calculateMonthlyConversionData(clientsData);

    setConversionMetrics({
      totalLeads,
      convertedLeads,
      conversionRate: parseFloat(conversionRate),
      changePercentage: parseFloat(changePercentage),
      weeklyActivity,
      monthlyConversionData
    });
  };

  const calculateDashboardMetrics = () => {
    console.log('=== DASHBOARD METRICS DEBUG ===');
    console.log('Clients data:', clients);
    console.log('Meetings data:', meetings);

    // Total clients (leadType === 'Client')
    const totalClients = clients.filter(c => c.leadType === 'Client').length;
    console.log('Total clients filtered:', totalClients);

    // Total leads (leadType === 'Lead')
    const totalLeads = clients.filter(c => c.leadType === 'Lead').length;
    console.log('Total leads filtered:', totalLeads);

    // Today's meetings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log('Today date:', today);
    console.log('Meetings with dates:', meetings.map(m => ({ title: m.title, date: m.date })));

    const todaysMeetings = meetings.filter(m => {
      if (!m.date) return false;
      const eventDate = new Date(m.date);
      eventDate.setHours(0, 0, 0, 0);
      const isToday = eventDate.getTime() === today.getTime();
      console.log(`Meeting "${m.title}" date: ${eventDate}, isToday: ${isToday}`);
      return isToday;
    }).length;

    console.log('Today\'s meetings count:', todaysMeetings);

    // Monthly growth (clients added this month vs last month)
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    const thisMonthClients = clients.filter(c => {
      if (!c.createdAt) return false;
      const createdDate = new Date(c.createdAt);
      return createdDate >= thisMonth;
    }).length;

    const lastMonthClients = clients.filter(c => {
      if (!c.createdAt) return false;
      const createdDate = new Date(c.createdAt);
      return createdDate >= lastMonth && createdDate < thisMonth;
    }).length;

    const monthlyGrowth = lastMonthClients > 0 ?
      (((thisMonthClients - lastMonthClients) / lastMonthClients) * 100).toFixed(1) : 0;

    console.log('Final metrics:', {
      totalClients,
      totalLeads,
      todaysMeetings,
      monthlyGrowth: parseFloat(monthlyGrowth)
    });

    setDashboardMetrics({
      totalClients,
      totalLeads,
      todaysMeetings,
      monthlyGrowth: parseFloat(monthlyGrowth)
    });
  };

  const calculateWeeklyActivity = (clientsData) => {
    const activity = Array(5).fill(null).map(() => Array(17).fill(0));
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    clientsData.forEach(client => {
      if (!client.createdAt) return;
      const createdDate = new Date(client.createdAt);
      if (createdDate >= oneWeekAgo && createdDate <= now) {
        const dayIndex = Math.floor((now - createdDate) / (24 * 60 * 60 * 1000));
        const hourIndex = Math.floor((createdDate.getHours() * 17) / 24);
        if (dayIndex < 5 && hourIndex < 17) {
          activity[dayIndex][hourIndex]++;
        }
      }
    });

    return activity;
  };

  const calculateMonthlyConversionData = (clientsData) => {
    const months = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthClients = clientsData.filter(c => {
        if (!c.createdAt) return false;
        const createdDate = new Date(c.createdAt);
        return createdDate >= monthDate && createdDate < nextMonth;
      });

      const leads = monthClients.filter(c => c.leadType === 'Lead').length;
      const converted = monthClients.filter(c => c.leadType === 'Client').length;
      const rate = (leads + converted) > 0 ? ((converted / (leads + converted)) * 100).toFixed(2) : 0;

      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        rate: parseFloat(rate)
      });
    }

    return months;
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className={styles.dashboardOverview}>

       {/* Temporary debug info */}
      {/* <div style={{ 
        background: '#f0f0f0', 
        padding: '10px', 
        margin: '10px', 
        borderRadius: '5px',
        fontSize: '12px',
        color: '#666'
      }}>
        <strong>Debug Info:</strong> {debugInfo}<br/>
        <strong>Last Check-in Time:</strong> {lastCheckInTime ? new Date(lastCheckInTime).toString() : 'null'}
      </div> */}
      {/* Header Section */}
      <div className={styles.headerRow}>
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeText}>
              <div className={styles.greeting}>
                {getTimeGreeting()}, {username}
              </div>
              <div className={styles.date}>{currentDate}</div>
            </div>
            <div className={styles.welcomeImage}>
              <div className={styles.imagePlaceholder}>
                <img src={weather} alt="" height={80} width={100} />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.metricsRow}>
          {/* Total Clients Card */}
          <div className={styles.metricCard}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Clients</div>
              <div className={styles.metricValue}>{isLoadingClients ? '--' : dashboardMetrics.totalClients}</div>
            </div>
            <div className={styles.metricDetails}>
              {/* <img src={threedot} alt="trend" className={styles.trendIcon} /> */}
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span className={styles.changeIcon}>&#8599;</span>
                  <span className={styles.grow}>{isLoadingClients ? '--' : `${dashboardMetrics.monthlyGrowth >= 0 ? '+' : ''}${dashboardMetrics.monthlyGrowth}%`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Leads Card */}
          <div className={styles.metricCard}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Total Leads</div>
              <div className={styles.metricValue}>{isLoadingClients ? '--' : dashboardMetrics.totalLeads}</div>
            </div>
            <div className={styles.metricDetails}>
              {/* <img src={threedot} alt="trend" className={styles.trendIcon} /> */}
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span className={styles.changeIcon}>&#8599;</span>
                  <span className={styles.grow}>{isLoadingClients ? '--' : `${dashboardMetrics.monthlyGrowth >= 0 ? '+' : ''}${dashboardMetrics.monthlyGrowth}%`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Meetings Card */}
          <div className={`${styles.metricCard} ${styles.profitCard}`}>
            <div className={styles.metricContent}>
              <div className={styles.metricLabel}>Today's Meetings</div>
              <div className={styles.metricValue}>{isLoadingMeetings ? '--' : dashboardMetrics.todaysMeetings}</div>
            </div>
            <div className={styles.metricDetails}>
              {/* <img src={threedot} alt="trend" className={styles.trendIcon} /> */}
              <div className={styles.changeIndicator}>
                <div className={styles.changeChip}>
                  <span
                    className={styles.changeIcon}
                    style={{ color: "white" }}
                  >
                    &#8599;
                  </span>
                  <span style={{ color: "white" }}>Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles["mobile-checkin"]}>
        <CheckIn
         
          lastCheckInTime={lastCheckInTime}
   onCheckInLogged={handleCheckInLogged}
        />
      </div>

      <SalesLeadsDualGraph clients={clients} />

      {/* Content Row */}
      <div className={styles.contentRow}>
        {/* Lead Conversion Section */}
        {/* <div className={styles.leadConversionCard}>
          <div className={styles.cardHeader}>
            <h3>Lead Conversion</h3>
            <button className={styles.actionButton}>
              <img src={arrowupright} alt="settings" />
            </button>
          </div>

          <div className={styles.conversionStats}>
            <div className={styles.statsRow}>
              <div className={styles.percentageValue}>
                {isLoadingClients ? '--' : `${conversionMetrics.conversionRate}%`}
              </div>
              <div className={styles.changeChip}>
                <span className={styles.changeIcon}>&#8599;</span>
                <span className={styles.grow}>
                  {isLoadingClients ? '--' : `${conversionMetrics.changePercentage >= 0 ? '+' : ''}${conversionMetrics.changePercentage}%`}
                </span>
              </div>
            </div>
            <div className={styles.description}>
              {isLoadingClients
                ? 'Loading conversion data...'
                : `${conversionMetrics.convertedLeads} clients converted from ${conversionMetrics.totalLeads} leads in the last 30 days! Good Job!`
              }
            </div>
          </div>

          <div className={styles.progressSection}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${isLoadingClients ? 0 : Math.min(100, (conversionMetrics.convertedLeads / Math.max(1, conversionMetrics.totalLeads + conversionMetrics.convertedLeads)) * 100)}%` }}
              ></div>
            </div>
            <div className={styles.progressLabels}>
              <span>Progress</span>
              <span>
                <strong>{isLoadingClients ? '--' : conversionMetrics.convertedLeads}</strong> / {isLoadingClients ? '--' : (conversionMetrics.totalLeads + conversionMetrics.convertedLeads)}
              </span>
            </div>
          </div>

          <div className={styles.activitySection}>
            <h4>Conversion attempts this week</h4>
            <div className={styles.activityGrid}>
              {conversionMetrics.weeklyActivity.map((row, rowIndex) => (
                <div key={rowIndex} className={styles.activityRow}>
                  {row.map((count, colIndex) => {
                    let activityClass = styles.activityEmpty;
                    if (count > 3) activityClass = styles.activityHigh;
                    else if (count > 2) activityClass = styles.activityMedium;
                    else if (count > 0) activityClass = styles.activityLow;

                    return (
                      <div
                        key={colIndex}
                        className={`${styles.activityCell} ${activityClass}`}
                        title={`${count} activities`}
                      ></div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div> */}

        {/* Conversion Data Chart */}
        {/* <ConversionDataChart
          conversionData={conversionMetrics.monthlyConversionData}
          isLoading={isLoadingClients}
        /> */}
      </div>

      {/* Bottom Row */}
      <div className={styles.bottomRow}>
        {/* Calendar Section */}
        <YourCalendarWidget
          meetings={meetings}
          isLoading={isLoadingMeetings}
        />

        {/* Today's Tasks */}
        <div className={styles.tasksCard}>
          <div className={styles.cardHeader}>
            <h3>Today's Tasks</h3>
            <button className={styles.actionButton}>
              <img src={arrowupright} alt="add task" />
            </button>
          </div>

          <div className={styles.tasksList}>
            {meetings.filter(m => {
              if (!m.date) return false;
              const eventDate = new Date(m.date);
              const today = new Date();
              return eventDate.getDate() === today.getDate() &&
                eventDate.getMonth() === today.getMonth() &&
                eventDate.getFullYear() === today.getFullYear();
            }).sort((a, b) => (a.time || "").localeCompare(b.time || "")).length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                No tasks scheduled for today.
              </div>
            ) : (
              meetings.filter(m => {
                if (!m.date) return false;
                const eventDate = new Date(m.date);
                const today = new Date();
                return eventDate.getDate() === today.getDate() &&
                  eventDate.getMonth() === today.getMonth() &&
                  eventDate.getFullYear() === today.getFullYear();
              }).sort((a, b) => (a.time || "").localeCompare(b.time || "")).map((task, index) => (
                <React.Fragment key={task._id || index}>
                  <div className={styles.taskItem}>
                    <div className={styles.taskInfo}>
                      <h4>{task.title || task.eventName || "Untitled Task"}</h4>
                      <p>{task.clientName || (task.notes ? (task.notes.length > 30 ? task.notes.substring(0, 30) + '...' : task.notes) : "General Task")}</p>
                    </div>
                    <div className={styles.taskAvatar}>
                      <img src={quote_solid} alt="" />
                    </div>
                  </div>
                  <div className={styles.taskDivider}></div>
                  <div className={styles.taskMeta}>
                    <div className={styles.taskAvatars}>
                      {/* Avatars could be implemented here if employee data is available */}
                    </div>
                    <div className={styles.taskTime}>
                      <span className={styles.today}>Today</span>
                      <span className={styles.timeRange}>{task.time ? (
                        (() => {
                          const [h, m] = task.time.split(':');
                          const hour = parseInt(h, 10);
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          const hour12 = hour % 12 || 12;
                          return `${hour12}:${m} ${ampm}`;
                        })()
                      ) : "All Day"}</span>
                    </div>
                  </div>
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
