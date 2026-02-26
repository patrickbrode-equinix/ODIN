/* ———————————————— */
/* PROTECTED ROUTE – AUTH + APPROVAL (POLICY-ONLY) */
/* ———————————————— */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  /* -------------------------------- */
  /* NOT LOGGED IN                    */
  /* -------------------------------- */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /* -------------------------------- */
  /* NOT APPROVED (ROOT BYPASS)       */
  /* -------------------------------- */
  if (!user?.isRoot && user?.approved === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  /* -------------------------------- */
  /* OK                               */
  /* -------------------------------- */
  return <Outlet />;
}
