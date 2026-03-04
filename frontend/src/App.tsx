/* FORCE REBUILD */
import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./router/ProtectedRoute";
import { PageGuard } from "./router/PageGuard";
import { OdinStartupAnimation } from "./components/OdinStartupAnimation";

/* Public – small, always needed immediately */
import Login from "./components/pages/Login";
import ForgotPassword from "./components/pages/ForgotPassword";
import Register from "./components/pages/Register";
import TVFullscreen from "./components/pages/TVFullscreen";
import PendingApproval from "./components/users/PendingApproval";

/* Lazy-loaded pages – code split per route */
const Dashboard              = lazy(() => import("./components/pages/Dashboard"));
const DashboardStatistik     = lazy(() => import("./components/pages/DashboardStatistik"));
const Shiftplan              = lazy(() => import("./components/pages/Shiftplan"));
const Weekplan               = lazy(() => import("./components/pages/Weekplan"));
const Handover               = lazy(() => import("./components/pages/Handover"));
const Tickets                = lazy(() => import("./components/pages/Tickets"));
const TVDashboard            = lazy(() => import("./components/pages/TVDashboard"));
const Dispatcher             = lazy(() => import("./components/pages/Dispatcher"));
const Settings               = lazy(() => import("./components/pages/Settings"));
const Users                  = lazy(() => import("./components/pages/Users"));
const Protokoll              = lazy(() => import("./components/pages/Protokoll"));
const TeamsBenachrichtigungen = lazy(() => import("./components/pages/TeamsBenachrichtigungen"));
const AutomatedAssignment    = lazy(() => import("./components/pages/AutomatedAssignment"));
const DBSPage                = lazy(() => import("./components/pages/DBS"));
const CommitCompliance       = lazy(() => import("./components/pages/CommitCompliance"));

/* Loading fallback */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <OdinStartupAnimation />
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
              path="dbs/*"
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
      </Suspense>
    </Router>
    </>
  );
}
