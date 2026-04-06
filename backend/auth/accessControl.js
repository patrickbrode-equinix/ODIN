const ROLE_ORDER = {
  user: 1,
  admin: 2,
};

const ACCESS_LEVELS = {
  none: 0,
  view: 1,
  write: 2,
};

export const ROLE_POLICIES = {
  user: {
    dashboard: "write",
    shiftplan: "write",
    handover: "write",
    tickets: "view",
    commit_dashboard: "view",
    dispatcher_console: "view",
    tv_dashboard: "view",
    odin_logic: "none",
    settings: "write",
    user_management: "none",
    car_liste: "view",
    ticket_audit: "none",
    protokoll: "view",
    commit_compliance: "write",
    shiftplan_control: "none",
    teams_center: "none",
    admin_settings: "none",
  },
  admin: {
    dashboard: "write",
    shiftplan: "write",
    handover: "write",
    tickets: "write",
    commit_dashboard: "write",
    dispatcher_console: "write",
    tv_dashboard: "write",
    odin_logic: "write",
    settings: "write",
    user_management: "write",
    car_liste: "write",
    ticket_audit: "write",
    protokoll: "write",
    commit_compliance: "write",
    shiftplan_control: "write",
    teams_center: "write",
    admin_settings: "write",
  },
};

export function normalizeRole(rawRole) {
  return rawRole === "admin" ? "admin" : "user";
}

export function resolveUserRole(user) {
  if (user?.is_root === true || user?.is_admin === true) {
    return "admin";
  }
  return "user";
}

export function getRolePolicy(role) {
  return ROLE_POLICIES[normalizeRole(role)];
}

export function getAccessLevelForRole(role, pageKey) {
  const policy = getRolePolicy(role);
  return policy[pageKey] || "none";
}

export function canRoleAccess(role, pageKey, minLevel = "view") {
  const current = getAccessLevelForRole(role, pageKey);
  return ACCESS_LEVELS[current] >= ACCESS_LEVELS[minLevel];
}

export function buildAccessPolicy(role) {
  return { ...getRolePolicy(role) };
}

export function isAdminRole(role) {
  return ROLE_ORDER[normalizeRole(role)] >= ROLE_ORDER.admin;
}