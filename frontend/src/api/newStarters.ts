/* ------------------------------------------------ */
/* NEW STARTERS API                                 */
/* Probation-period management                      */
/* ------------------------------------------------ */

import { api, asArray } from "./api";

/* ──────────────────────────────────────────────── */
/* TYPES                                            */
/* ──────────────────────────────────────────────── */

export interface NewStarterRatings {
  punctuality:             number | null;
  politeness:              number | null;
  team_integration:        number | null;
  motivation:              number | null;
  technical_understanding: number | null;
  work_quality:            number | null;
  german_language:         number | null;
  english_language:        number | null;
  workplace_cleanliness:   number | null;
  clothing_cleanliness:    number | null;
  average_rating:          number | null;
}

export type NewStarterStatus = "active" | "archived";

export interface NewStarter extends NewStarterRatings {
  id:                    number;
  first_name:            string;
  last_name:             string;
  start_date:            string; // YYYY-MM-DD
  probation_end_date:    string; // YYYY-MM-DD
  last_termination_date: string; // YYYY-MM-DD
  comment:               string | null;
  status:                NewStarterStatus;
  created_at:            string;
  updated_at:            string;
}

export interface CreateNewStarterPayload {
  first_name:  string;
  last_name:   string;
  start_date:  string; // YYYY-MM-DD
  comment?:    string;
  status?:     NewStarterStatus;
}

export interface UpdateNewStarterPayload {
  first_name?:  string;
  last_name?:   string;
  start_date?:  string;
  comment?:     string;
  status?:      NewStarterStatus;
}

/* ──────────────────────────────────────────────── */
/* API FUNCTIONS                                    */
/* ──────────────────────────────────────────────── */

export async function fetchNewStarters(status?: NewStarterStatus): Promise<NewStarter[]> {
  const params = status ? `?status=${status}` : "";
  const res = await api.get(`/new-starters${params}`);
  return asArray(res.data, "fetchNewStarters");
}

export async function createNewStarter(payload: CreateNewStarterPayload): Promise<NewStarter> {
  const res = await api.post("/new-starters", payload);
  return res.data;
}

export async function updateNewStarter(id: number, payload: UpdateNewStarterPayload): Promise<NewStarter> {
  const res = await api.put(`/new-starters/${id}`, payload);
  return res.data;
}

export async function deleteNewStarter(id: number): Promise<{ success: boolean }> {
  const res = await api.delete(`/new-starters/${id}`);
  return res.data;
}

export async function saveNewStarterRatings(
  id: number,
  ratings: Partial<Omit<NewStarterRatings, "average_rating">>,
): Promise<NewStarterRatings> {
  const res = await api.put(`/new-starters/${id}/ratings`, ratings);
  return res.data;
}
