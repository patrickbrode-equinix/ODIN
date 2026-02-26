/* ------------------------------------------------ */
/* TV CONTENT – ORCHESTRATOR ONLY                   */
/* (keine Shiftplan-Seite mehr nötig nach Refresh)  */
/* ------------------------------------------------ */

import { useEffect, useMemo, useState } from "react";
import { useShiftStore } from "../../store/shiftStore";
import { TvLayout } from "./tv.layout";
import { useHiddenEmployees } from "../../hooks/useHiddenEmployees";
import { useEmployeeMetaStore } from "../../store/employeeMetaStore";

interface TVContentProps {
  isFullscreen?: boolean;
}

export function TVContent({ isFullscreen = false }: TVContentProps) {
  const [now, setNow] = useState(new Date());

  // wichtig: nach Refresh wird Zustand aus localStorage rehydriert (async)
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persistApi = (useShiftStore as any).persist;

    // falls schon hydrated (z.B. nach HMR), direkt true setzen
    if (persistApi?.hasHydrated?.()) setHydrated(true);

    const unsub = persistApi?.onFinishHydration?.(() => setHydrated(true));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const getEmployeesForToday = useShiftStore((s) => s.getEmployeesForToday);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* HIDDEN EMPLOYEES */
  const { isHidden } = useHiddenEmployees();

  const { getCategory } = useEmployeeMetaStore();

  const { early, late, night } = useMemo(() => {
    if (!hydrated) return { early: [], late: [], night: [] };
    try {
      const raw = getEmployeesForToday?.() ?? { early: [], late: [], night: [] };
      const mapEmp = (e: any) => ({ ...e, category: getCategory(e.name) });

      return {
        early: raw.early.filter((e) => !isHidden(e.name)).map(mapEmp),
        late: raw.late.filter((e) => !isHidden(e.name)).map(mapEmp),
        night: raw.night.filter((e) => !isHidden(e.name)).map(mapEmp),
      };
    } catch {
      return { early: [], late: [], night: [] };
    }
  }, [hydrated, getEmployeesForToday, isHidden, getCategory]);

  return (
    <TvLayout
      isFullscreen={isFullscreen}
      now={now}
      early={early}
      late={late}
      night={night}
    />
  );
}
