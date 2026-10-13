import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LuUsers, LuUserPlus, LuWallet, LuCalendarDays } from "react-icons/lu";
import ws from "./dashboard/DashboardWidgets.module.css";
import HeroBanner from "./dashboard/HeroBanner";
import KpiTile from "./dashboard/KpiTile";
import TrendChart from "./dashboard/TrendChart";
import FollowUpsCard from "./dashboard/FollowUpsCard";
import PipelineCard from "./dashboard/PipelineCard";
import ScheduleCard from "./dashboard/ScheduleCard";
import { dayKey, localKey, formatTime, monthOverMonth, lastMonths, monthlySeries, followUpBuckets, compactMoney, CLOSED_STAGES } from "./dashboard/dashboardUtils";
import checkInService from "../services/CheckInService";
import MeetingService from "../services/MeetingService";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import config from "../config/config";

const REFRESH_MS = 5 * 60 * 1000;

function DashboardOverview() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [lastCheckInTime, setLastCheckInTime] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(true);
  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadError, setLoadError] = useState("");

  const fetchLastCheckIn = async () => {
    try {
      const userId = localStorage.getItem("userId");
      const role = localStorage.getItem("role") || "";
      let latest = null;
      if (role === "admin" || role === "hod") {
        // Admin / HOD: latest check-in of anyone
        const resp = await checkInService.getCheckIns(1, 1);
        if (resp && Array.isArray(resp.checkIns) && resp.checkIns.length > 0) latest = resp.checkIns[0];
        else if (Array.isArray(resp) && resp.length > 0) latest = resp[0];
      } else {
        // Without a userId the service falls back to /user/me
        const checkIns = await checkInService.getCheckInsByUser(userId || undefined);
        if (checkIns && checkIns.length > 0) latest = checkIns[0];
      }
      setLastCheckInTime(latest && latest.timestamp ? latest.timestamp : null);
    } catch (err) {
      console.error("Error fetching check-ins:", err);
      setLastCheckInTime(null);
    }
  };

  // Client events + standalone meetings; others than admin / hod only see their own (created by / assigned to them)
  const loadMeetingsForCurrentUser = async () => {
    try {
      const token = localStorage.getItem("token");
      let me = null;
      try {
        const resp = await fetch(`${config.API_BASE_URL.replace(/\/api\/?$/, "")}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) me = await resp.json();
      } catch (e) {
        // fall back to localStorage
      }
      me = me || { _id: localStorage.getItem("userId"), username: localStorage.getItem("username"), emailId: localStorage.getItem("email"), role: localStorage.getItem("role") };
      const role = me.role || localStorage.getItem("role") || "sales_executive";

      let clientEvents = [];
      try {
        const allEventsResp = await fetch(`${clientService.baseURL.replace(/\/clients\/?$/, "")}/clients/events`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (allEventsResp.ok) clientEvents = await allEventsResp.json();
      } catch (e) {
        console.warn("Failed to fetch client events", e);
      }

      let meetingsList = [];
      try {
        const raw = await MeetingService.getMeetings();
        meetingsList = Array.isArray(raw) ? raw : (raw.meetings || []);
      } catch (e) {
        console.warn("Failed to fetch meetings", e);
      }

      const normalizedMeetings = (meetingsList || []).map((m) => {
        const date = m.date ? new Date(m.date) : null;
        return {
          _id: m._id || m.id,
          eventId: m._id || m.id,
          eventName: m.title || m.eventName || "",
          title: m.title || m.eventName || "",
          date: date ? date.toISOString().split("T")[0] : null,
          time: m.time || "",
          clientId: m.clientId || null,
          clientName: m.clientName || null,
          assignedTeamMembers: m.assignedTeamMembers || [],
          createdBy: m.createdBy || null,
          color: m.color || (m.meta && m.meta.meeting && m.meta.meeting.color) || "#FF9500",
          link: m.link || m.meetingLink || "",
          meta: { meeting: m },
        };
      });

      const events = [...(Array.isArray(clientEvents) ? clientEvents : []), ...normalizedMeetings];

      if (role === "admin" || role === "hod") {
        setMeetings(events);
        return;
      }
      let employee = null;
      try {
        const employees = await employeeService.getEmployees();
        employee = (employees || []).find((emp) =>
          String(emp.user) === String(me._id) ||
          (emp.emailId && me.emailId && emp.emailId.toLowerCase() === me.emailId.toLowerCase())
        );
      } catch (e) {
        console.warn("Failed to resolve employee:", e);
      }
      const empId = employee?._id ? String(employee._id) : null;
      const usernameKey = (me.username || me.emailId || "").toString().toLowerCase();
      const userId = me._id ? String(me._id) : null;

      setMeetings(events.filter((ev) => {
        if (ev.createdBy && (
          (userId && String(ev.createdBy) === userId) ||
          (usernameKey && String(ev.createdBy).toLowerCase() === usernameKey)
        )) return true;
        const assignedTeam = ev.assignedTeamMembers || ev.meta?.event?.assignedTeamMembers || ev.assignedTo || ev.meta?.assignedTeamMembers;
        if (empId && Array.isArray(assignedTeam) && assignedTeam.map(String).includes(empId)) return true;
        if (ev.assignedBy && usernameKey && String(ev.assignedBy).toLowerCase() === usernameKey) return true;
        const metaAssigned = ev.meta?.event?.assignedTeamMembers || ev.meta?.assignedTeamMembers;
        return !!(empId && Array.isArray(metaAssigned) && metaAssigned.map(String).includes(empId));
      }));
    } catch (err) {
      console.error("Error loading meetings for calendar:", err);
      setMeetings([]);
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  const fetchClientsData = async () => {
    try {
      const clientsData = await clientService.getClients();
      setClients(Array.isArray(clientsData) ? clientsData : (clientsData.clients || []));
      setLoadError("");
    } catch (error) {
      console.error("Error fetching clients:", error);
      setLoadError("Could not load clients and leads. Use Refresh to try again.");
    } finally {
      setIsLoadingClients(false);
    }
  };

  const loadAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchLastCheckIn(), loadMeetingsForCurrentUser(), fetchClientsData()]);
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "User");
    loadAll();
    const t = setInterval(loadAll, REFRESH_MS);
    return () => clearInterval(t);
  }, [loadAll]);

  const metrics = useMemo(() => {
    const months = lastMonths(12);
    const onlyClients = clients.filter((c) => c.leadType === "Client");
    const onlyLeads = clients.filter((c) => c.leadType === "Lead");
    const isOpen = (c) => c.currentStatus && !CLOSED_STAGES.includes(c.currentStatus);
    const openDeals = clients.filter(isOpen);
    const value = (c) => parseFloat(c.opportunityValue) || 0;
    const today = localKey();
    const todays = meetings.filter((m) => dayKey(m.date) === today);
    const nowHm = new Date().toTimeString().slice(0, 5);
    const next = todays.filter((m) => m.time && m.time >= nowHm).sort((a, b) => a.time.localeCompare(b.time))[0];
    const fu = followUpBuckets(clients);
    return {
      onlyClients,
      onlyLeads,
      totalClients: onlyClients.length,
      totalLeads: onlyLeads.length,
      clientsChange: monthOverMonth(onlyClients),
      leadsChange: monthOverMonth(onlyLeads),
      clientsTrend: monthlySeries(onlyClients, months),
      leadsTrend: monthlySeries(onlyLeads, months),
      openValue: openDeals.reduce((a, c) => a + value(c), 0),
      openCount: openDeals.length,
      openTrend: monthlySeries(openDeals, months, value),
      todaysMeetings: todays.length,
      nextMeeting: next || null,
      overdue: fu.Overdue.length,
      dueToday: fu.Today.length,
    };
  }, [clients, meetings]);

  // One sentence on what needs attention today
  const summary = (() => {
    const parts = [];
    const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    parts.push(metrics.todaysMeetings ? plural(metrics.todaysMeetings, "meeting", "meetings") + " today" : "no meetings today");
    if (metrics.overdue) parts.push(plural(metrics.overdue, "overdue follow-up", "overdue follow-ups"));
    if (metrics.dueToday) parts.push(plural(metrics.dueToday, "follow-up due today", "follow-ups due today"));
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    const next = metrics.nextMeeting ? ` Next up: ${metrics.nextMeeting.title || metrics.nextMeeting.eventName || "meeting"} at ${formatTime(metrics.nextMeeting.time)}.` : "";
    return `You have ${list}.${next}`;
  })();

  return (
    <div className={ws.page}>
      <HeroBanner
        username={username}
        summary={summary}
        loading={isLoadingClients || isLoadingMeetings}
        lastCheckInTime={lastCheckInTime}
        onCheckInLogged={fetchLastCheckIn}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing}
        onRefresh={loadAll}
      />

      {loadError && <div className={ws.errorBar}>{loadError}</div>}

      <div className={ws.kpiRow}>
        <KpiTile id="clients" icon={LuUsers} tone="blue" label="Total clients" value={metrics.totalClients.toLocaleString("en-IN")}
          change={metrics.clientsChange} trend={metrics.clientsTrend} trendLabel="Clients added per month, last 12 months"
          records={metrics.onlyClients} noun="Clients"
          loading={isLoadingClients} onClick={() => navigate("/salesandleads?filter=Clients")} />
        <KpiTile id="leads" icon={LuUserPlus} tone="violet" label="Total leads" value={metrics.totalLeads.toLocaleString("en-IN")}
          change={metrics.leadsChange} trend={metrics.leadsTrend} trendLabel="Leads added per month, last 12 months"
          records={metrics.onlyLeads} noun="Leads"
          loading={isLoadingClients} onClick={() => navigate("/salesandleads?filter=Leads")} />
        <KpiTile id="pipeline" icon={LuWallet} tone="green" label="Open pipeline" value={compactMoney(metrics.openValue)}
          note={`${metrics.openCount} open ${metrics.openCount === 1 ? "deal" : "deals"}`} trend={metrics.openTrend} trendLabel="Open pipeline value added per month"
          loading={isLoadingClients} onClick={() => navigate("/salesandleads")} />
        <KpiTile id="meetings" icon={LuCalendarDays} tone="amber" label="Today's meetings" value={metrics.todaysMeetings}
          note={metrics.nextMeeting ? `Next at ${formatTime(metrics.nextMeeting.time)}` : "Nothing else today"}
          loading={isLoadingMeetings} onClick={() => navigate("/yourcalendar")} />
      </div>

      <div className={ws.gridMain}>
        <TrendChart clients={clients} isLoading={isLoadingClients} />
        <PipelineCard clients={clients} isLoading={isLoadingClients} />
      </div>

      <div className={ws.gridHalf}>
        <ScheduleCard meetings={meetings} isLoading={isLoadingMeetings} />
        <FollowUpsCard clients={clients} isLoading={isLoadingClients} />
      </div>
    </div>
  );
}

export default DashboardOverview;
