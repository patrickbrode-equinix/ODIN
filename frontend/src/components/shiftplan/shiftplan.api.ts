/* ------------------------------------------------ */
/* SHIFTPLAN – API FUNCTIONS (AUTH)                 */
/* ------------------------------------------------ */

import { api, asArray, asObject } from "../../api/api";

/* ------------------------------------------------ */
/* GET MONTHS                                       */
/* ------------------------------------------------ */

export async function fetchMonths(): Promise<string[]> {
  const res = await api.get("/schedules");
  const data = asObject(res.data, "fetchMonths");
  return asArray(data?.months, "fetchMonths:months");
}

/* ------------------------------------------------ */
/* GET SCHEDULE BY MONTH                            */
/* ------------------------------------------------ */

export async function fetchSchedule(month: string) {
  const res = await api.get(`/schedules/${encodeURIComponent(month)}`);
  return asObject(res.data, "fetchSchedule");
}

/* ------------------------------------------------ */
/* IMPORT SCHEDULE (ADMIN/SUPERADMIN)               */
/* ------------------------------------------------ */

export async function importSchedule(month: string, data: any) {
  const res = await api.post("/schedules/import", { month, data });
  return res.data;
}
