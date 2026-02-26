/* ------------------------------------------------ */
/* DISPATCHER – TYPES                               */
/* ------------------------------------------------ */

export type ShiftCode = "F" | "S" | "N" | "ABW";

export type RoleCode =
  | "dispatcher"
  | "crossconnect"
  | "smarthands"
  | "project";

export interface DispatcherEmployee {
  name: string;
  shift: ShiftCode;
  roles: RoleCode[];
}
