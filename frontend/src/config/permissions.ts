/* ———————————————————————————————— */
/* PERMISSIONS – SINGLE SOURCE OF TRUTH            */
/* ———————————————————————————————— */

export const PERMISSIONS = {
  DASHBOARD: {
    VIEW: "dashboard_view",
    EDIT: "dashboard_edit",
  },

  HANDOVER: {
    VIEW: "handover_view",
    EDIT: "handover_edit",
  },

  SHIFTPLAN: {
    VIEW: "shiftplan_view",
    EDIT: "shiftplan_edit",
  },

  DISPATCHER: {
    VIEW: "dispatcher_view",
    EDIT: "dispatcher_edit",
  },

  COMMIT: {
    VIEW: "commit_view",
    EDIT: "commit_edit",
  },

  TICKETS: {
    VIEW: "tickets_view",
    EDIT: "tickets_edit",
  },

  USERS: {
    VIEW: "users_view",
    EDIT: "users_edit",
  },

  TV: {
    VIEW: "tv_view",
    FULLSCREEN: "tv_fullscreen",
  },
} as const;

/* Helper für Typen & Autocomplete */
export type PermissionKey =
  | typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS.DASHBOARD];
