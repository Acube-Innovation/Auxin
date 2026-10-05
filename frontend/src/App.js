import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import SalesAndLeads from "./pages/SalesAndLeads";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import YourCalendar from "./pages/sidebar/YourCalendar";
import SalesAndLeadsClient from "./pages/SalesAndLeadsClient";
import Documents from "./components/sales-and-leads/Documents";
import Example from "./pages/Example";
// import AddClient from "./pages/AddClient";
import TeamManagement from "./pages/team-management/TeamManagement";
import TeamManagementSalesAndLeads from "./pages/team-management/TeamManagementSalesLeads";
import Venkat from "./pages/Venkat";
import CheckInHistory from "./pages/CheckInHistory";
import UserManagement from "./pages/UserManagement";
import ProtectedRoute from "./components/ProtectedRoute";
import AttendanceManagement from "./pages/team-management/AttendanceManagement";
import HelpSupport from "./pages/HelpSupport";
import OpsMasters from "./pages/operations/OpsMasters";
import VoyageList from "./pages/operations/VoyageList";
import VoyageWizard from "./pages/operations/wizard/VoyageWizard";
import VoyageWorkspace from "./pages/operations/workspace/VoyageWorkspace";
import MyTasks from "./pages/operations/MyTasks";
import OpsDashboard from "./pages/operations/OpsDashboard";
import OpsReports from "./pages/operations/OpsReports";
import OpsSettings from "./pages/operations/OpsSettings";
import { OPS_MASTERS_ROLES, ALL_OPS_ROLES, OPS_EDITOR_ROLES } from "./config/opsRoles";



import { ToastProvider } from "./context/ToastContext";

function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={
            <Login />} />

          <Route path="/forgotpassword" element={<ForgotPassword />} />

          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>

          } />

          <Route path="/salesandleadsclient/:id" element={
            <ProtectedRoute><SalesAndLeadsClient /></ProtectedRoute>
          } />
          <Route path="/salesandleads" element={
            <ProtectedRoute><SalesAndLeads /></ProtectedRoute>
          } />



          <Route path="/reports" element={
            <ProtectedRoute><Reports /></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />

          <Route path="/yourcalendar" element={
            <ProtectedRoute><YourCalendar /></ProtectedRoute>
          } />

          <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          {/* <Route path="/addclient" element={<ProtectedRoute><AddClient /></ProtectedRoute>} /> */}

          <Route path="/teammanagement" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
          <Route path="/teammanagement_salesleads/:id" element={<ProtectedRoute><TeamManagementSalesAndLeads /></ProtectedRoute>} />

          <Route path="/attendance-management" element={<ProtectedRoute><AttendanceManagement /></ProtectedRoute>} />

          <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />

          <Route path="/checkin-history" element={<ProtectedRoute><CheckInHistory /></ProtectedRoute>} />

          <Route path="/help-support" element={<ProtectedRoute><HelpSupport /></ProtectedRoute>} />

          {/* Vessel Operations (Phase 2) */}
          <Route path="/operations" element={<ProtectedRoute roles={ALL_OPS_ROLES}><OpsDashboard /></ProtectedRoute>} />
          <Route path="/operations/voyages" element={<ProtectedRoute roles={ALL_OPS_ROLES}><VoyageList /></ProtectedRoute>} />
          <Route path="/operations/voyages/new" element={<ProtectedRoute roles={OPS_EDITOR_ROLES}><VoyageWizard /></ProtectedRoute>} />
          <Route path="/operations/voyages/:id/edit" element={<ProtectedRoute roles={OPS_EDITOR_ROLES}><VoyageWizard /></ProtectedRoute>} />
          <Route path="/operations/voyages/:id" element={<ProtectedRoute roles={ALL_OPS_ROLES}><VoyageWorkspace /></ProtectedRoute>} />
          <Route path="/operations/my-tasks" element={<ProtectedRoute roles={OPS_EDITOR_ROLES}><MyTasks /></ProtectedRoute>} />
          <Route path="/operations/reports" element={<ProtectedRoute roles={ALL_OPS_ROLES}><OpsReports /></ProtectedRoute>} />
          <Route path="/operations/masters" element={<Navigate to="/operations/masters/vessels" replace />} />
          <Route path="/operations/masters/:master" element={<ProtectedRoute roles={OPS_MASTERS_ROLES}><OpsMasters /></ProtectedRoute>} />
          <Route path="/operations/settings" element={<ProtectedRoute roles={OPS_MASTERS_ROLES}><OpsSettings /></ProtectedRoute>} />

          <Route path="/venkat" element={<ProtectedRoute><Venkat /></ProtectedRoute>} />
          <Route path="/example" element={<Example />} />

        </Routes>
      </Router>
    </ToastProvider>
  );
}

export default App;
