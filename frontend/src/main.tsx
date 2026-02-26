/* ------------------------------------------------ */
/* MAIN ENTRYPOINT                                 */
/* ------------------------------------------------ */
import React from "react";
import ReactDOM from "react-dom/client";

/* ------------------------------------------------ */
/* GLOBAL STYLES                                   */
/* ------------------------------------------------ */
import "./styles/globals.css";

/* ------------------------------------------------ */
/* ROOT APP + PROVIDERS                            */
/* ------------------------------------------------ */
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./context/AuthContext";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";

/* ------------------------------------------------ */
/* RENDER APPLICATION                              */
/* ------------------------------------------------ */
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
