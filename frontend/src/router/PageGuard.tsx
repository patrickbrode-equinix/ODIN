import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { AccessLevel } from "../context/AuthContext";
import AccessDenied from "../components/pages/AccessDenied";

type Props = {
  pageKey: string;
  min?: AccessLevel;
  children: React.ReactNode;
};

export function PageGuard({
  pageKey,
  min = "view",
  children,
}: Props) {
  const { isAuthenticated, canAccess } = useAuth();
  const location = useLocation();

  /* ------------------------------- */
  /* NOT LOGGED IN                   */
  /* ------------------------------- */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  /* ------------------------------- */
  /* ACCESS CHECK                    */
  /* ------------------------------- */
  if (!canAccess(pageKey, min)) {
    // If we are already at dashboard, show AccessDenied to prevent infinite loop
    // (since /dashboard is the fallback)
    if (location.pathname === "/dashboard") {
      return <AccessDenied />;
    }

    // Otherwise try to redirect to dashboard (common fallback)
    return <Navigate to="/dashboard" replace />;
  }

  /* ------------------------------- */
  /* ALLOWED                         */
  /* ------------------------------- */
  return <>{children}</>;
}
