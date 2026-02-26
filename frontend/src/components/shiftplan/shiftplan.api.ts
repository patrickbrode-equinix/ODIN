/* ------------------------------------------------ */
/* SHIFTPLAN – API FUNCTIONS (AUTH)                 */
/* ------------------------------------------------ */

import { api } from "../../api/api";

/* ------------------------------------------------ */
/* GET MONTHS                                       */
/* ------------------------------------------------ */

export async function fetchMonths(): Promise<string[]> {
  const res = await api.get("/schedules");
  return res.data?.months ?? [];
}

/* ------------------------------------------------ */
/* GET SCHEDULE BY MONTH                            */
/* ------------------------------------------------ */

export async function fetchSchedule(month: string) {
  const res = await api.get(`/schedules/${encodeURIComponent(month)}`);
  return res.data;
}

/* ------------------------------------------------ */
/* IMPORT SCHEDULE (ADMIN/SUPERADMIN)               */
/* ------------------------------------------------ */

export async function importSchedule(month: string, data: any) {
  const res = await api.post("/schedules/import", { month, data });
  return res.data;
}
