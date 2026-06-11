/* FORCE REBUILD */
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { PageGuard } from "./router/PageGuard";

/* Public – small, always needed immediately */
import Login from "./components/pages/Login";
import ForgotPassword from "./components/pages/ForgotPassword";
import Register from "./components/pages/Register";
import TVFullscreen from "./components/pages/TVFullscreen";
import PendingApproval from "./components/users/PendingApproval";

/* Lazy-loaded pages – code split per route */
const Dashboard              = lazy(() => import("./components/pages/Dashboard"));
const DashboardStatistik     = lazy(() => import("./components/pages/DashboardStatistik"));
const OdinLogicPage          = lazy(() => import("./components/pages/OdinLogicPage"));
const Shiftplan              = lazy(() => import("./components/pages/Shiftplan"));
const Weekplan               = lazy(() => import("./components/pages/Weekplan"));
const TagesplanungPage       = lazy(() => import("./components/pages/TagesplanungPage"));
const Handover               = lazy(() => import("./components/pages/Handover"));
const Tickets                = lazy(() => import("./components/pages/Tickets"));
const TVDashboard            = lazy(() => import("./components/pages/TVDashboard"));
const Dispatcher             = lazy(() => import("./components/pages/Dispatcher"));
const Settings               = lazy(() => import("./components/pages/Settings"));
const Users                  = lazy(() => import("./components/pages/Users"));
const CommitCompliance       = lazy(() => import("./components/pages/CommitCompliance"));
const TeamsCommunicationCenter = lazy(() => import("./components/pages/TeamsCommunicationCenter"));
const AdminSettings          = lazy(() => import("./components/pages/AdminSettings"));
const ShiftplanControlCenter = lazy(() => import("./components/pages/ShiftplanControlCenter"));

/* Loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-50">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* ========================= */}
        {/* PUBLIC ROUTES             */}
        {/* ========================= */}
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />
        <Route path="/tv-fullscreen" element={<TVFullscreen />} />

        {/* ========================= */}
        {/* PUBLIC TV DASHBOARD       */}
        {/* kiosk-ready, no auth      */}
        {/* ========================= */}
        <Route path="/tv-dashboard" element={<TVDashboard />} />

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
              path="dashboard/ticket-audit"
              element={<Navigate to="/dashboard/statistiken" replace />}
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
              path="shiftplan/day"
              element={
                <PageGuard pageKey="shiftplan">
                  <TagesplanungPage />
                </PageGuard>
              }
            />

            <Route
              path="tagesplanung"
              element={
                <PageGuard pageKey="shiftplan">
                  <TagesplanungPage />
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

            {/* tv-dashboard is public — handled above outside ProtectedRoute */}

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
            {/* DBS (Colo 2.0) → redirects to CAR */}
            <Route
              path="dbs/*"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="car-liste"
              element={<Navigate to="/dashboard" replace />}
            />
            <Route
              path="protokoll"
              element={<Navigate to="/admin-settings?section=audit" replace />}
            />
            <Route
              path="protokoll/teams-benachrichtigungen"
              element={<Navigate to="/admin-settings?section=teams" replace />}
            />
            <Route
              path="protokoll/automated-assignment"
              element={<Navigate to="/admin-settings?section=odin" replace />}
            />

            <Route
              path="commit-compliance"
              element={
                <PageGuard pageKey="commit_compliance">
                  <CommitCompliance />
                </PageGuard>
              }
            />

            {/* ODIN-Logik */}
            <Route
              path="odin-logic"
              element={
                <PageGuard pageKey="odin_logic">
                  <OdinLogicPage />
                </PageGuard>
              }
            />

            {/* Legacy ODIN rules route redirected into Admin Settings */}
            <Route
              path="odin-logic/rules"
              element={<Navigate to="/admin-settings?section=odin" replace />}
            />

            {/* Shiftplan Control Center */}
            <Route
              path="shiftplan-control"
              element={
                <PageGuard pageKey="shiftplan_control" min="write">
                  <ShiftplanControlCenter />
                </PageGuard>
              }
            />

            {/* Shift Admin Settings moved into Admin Settings */}
            <Route
              path="shift-admin-settings"
              element={<Navigate to="/admin-settings?section=shiftplan" replace />}
            />

            {/* Teams Communication Center */}
            <Route
              path="teams-center"
              element={
                <PageGuard pageKey="teams_center">
                  <TeamsCommunicationCenter />
                </PageGuard>
              }
            />

            {/* Admin Settings */}
            <Route
              path="admin-settings"
              element={
                <PageGuard
                  pageKey="admin_settings"
                  anyOf={[
                    { pageKey: "teams_center" },
                    { pageKey: "shiftplan_control" },
                    { pageKey: "odin_logic" },
                    { pageKey: "protokoll" },
                  ]}
                >
                  <AdminSettings />
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
      </Suspense>
    </Router>
  );
}
