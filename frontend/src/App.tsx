/* FORCE REBUILD */
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { PageGuard } from "./router/PageGuard";

/* Public */
import Login from "./components/pages/Login";
import ForgotPassword from "./components/pages/ForgotPassword";
import Register from "./components/pages/Register";
import TVFullscreen from "./components/pages/TVFullscreen";

/* User State */
import PendingApproval from "./components/users/PendingApproval";

/* Pages */
import Dashboard from "./components/pages/Dashboard";
import DashboardStatistik from "./components/pages/DashboardStatistik";
import Shiftplan from "./components/pages/Shiftplan";
import Weekplan from "./components/pages/Weekplan";
import Handover from "./components/pages/Handover";
import Tickets from "./components/pages/Tickets";
import TVDashboard from "./components/pages/TVDashboard";
import Dispatcher from "./components/pages/Dispatcher";
import Settings from "./components/pages/Settings";
import Users from "./components/pages/Users";
import Protokoll from "./components/pages/Protokoll";
import TeamsBenachrichtigungen from "./components/pages/TeamsBenachrichtigungen";
import AutomatedAssignment from "./components/pages/AutomatedAssignment";
import DBSPage from "./components/pages/DBS";
import CommitCompliance from "./components/pages/CommitCompliance";

export default function App() {
  return (
    <Router>
      <Routes>

        {/* ========================= */}
        {/* PUBLIC ROUTES             */}
        {/* ========================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/tv-fullscreen" element={<TVFullscreen />} />

        {/* ========================= */}
        {/* AUTHENTICATED ONLY        */}
        {/* ========================= */}
        <Route element={<ProtectedRoute />}>

          {/* Pending Approval (NO Layout, NO PageGuard) */}
          <Route path="/pending-approval" element={<PendingApproval />} />

          {/* ========================= */}
          {/* MAIN APP (with Layout)   */}
          {/* ========================= */}
          <Route element={<Layout />}>

            {/* Default */}
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Core */}
            <Route
              path="dashboard"
              element={
                <PageGuard pageKey="dashboard">
                  <Dashboard />
                </PageGuard>
              }
            />

            <Route
              path="dashboard/statistiken"
              element={
                <PageGuard pageKey="dashboard">
                  <DashboardStatistik />
                </PageGuard>
              }
            />

            <Route
              path="shiftplan"
              element={
                <PageGuard pageKey="shiftplan">
                  <Shiftplan />
                </PageGuard>
              }
            />

            <Route
              path="shiftplan/week"
              element={
                <PageGuard pageKey="shiftplan">
                  <Weekplan />
                </PageGuard>
              }
            />


            <Route
              path="handover"
              element={
                <PageGuard pageKey="handover">
                  <Handover />
                </PageGuard>
              }
            />

            <Route
              path="tickets"
              element={
                <PageGuard pageKey="tickets">
                  <Tickets />
                </PageGuard>
              }
            />

            {/* Dashboards */}
            <Route
              path="commit-dashboard"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route
              path="tv-dashboard"
              element={
                <PageGuard pageKey="tv_dashboard">
                  <TVDashboard />
                </PageGuard>
              }
            />

            {/* Tools */}
            <Route
              path="dispatcher"
              element={
                <PageGuard pageKey="dispatcher_console">
                  <Dispatcher />
                </PageGuard>
              }
            />

            <Route
              path="settings"
              element={
                <PageGuard pageKey="settings">
                  <Settings />
                </PageGuard>
              }
            />

            {/* New Pages */}
            <Route
              path="dbs"
              element={
                <PageGuard pageKey="dbs">
                  <DBSPage />
                </PageGuard>
              }
            />
            <Route
              path="protokoll"
              element={
                <PageGuard pageKey="protokoll">
                  <Protokoll />
                </PageGuard>
              }
            />
            <Route
              path="protokoll/teams-benachrichtigungen"
              element={
                <PageGuard pageKey="protokoll">
                  <TeamsBenachrichtigungen />
                </PageGuard>
              }
            />
            <Route
              path="protokoll/automated-assignment"
              element={
                <PageGuard pageKey="protokoll">
                  <AutomatedAssignment />
                </PageGuard>
              }
            />

            <Route
              path="commit-compliance"
              element={
                <PageGuard pageKey="commit_compliance">
                  <CommitCompliance />
                </PageGuard>
              }
            />

            {/* Admin */}
            <Route
              path="users"
              element={
                <PageGuard pageKey="user_management">
                  <Users />
                </PageGuard>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          </Route>
        </Route>

      </Routes>
    </Router>
  );
}
