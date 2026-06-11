type UserLike = Record<string, unknown> | null | undefined;

function compactSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toNameToken(value: string): string {
  if (!value) return "";
  if (/^[A-Z0-9]+$/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function aliasToFullName(value: string): string | null {
  const normalized = compactSpaces(String(value || ""));
  if (!normalized) return null;

  const internalLoginMatch = normalized.match(/^([^@\s]+)@([^@\s]+)$/);
  if (internalLoginMatch && !internalLoginMatch[2].includes(".")) {
    const first = toNameToken(internalLoginMatch[1].replace(/[._-]+/g, " "));
    const last = toNameToken(internalLoginMatch[2].replace(/[._-]+/g, " "));
    const fullName = compactSpaces(`${first} ${last}`);
    return fullName || null;
  }

  const emailMatch = normalized.match(/^([^@\s]+)@[^@\s]+\.[^@\s]+$/i);
  const alias = compactSpaces(emailMatch ? emailMatch[1] : normalized);
  const segments = alias
    .split(/[._-]+/)
    .map((segment) => toNameToken(compactSpaces(segment)))
    .filter(Boolean);

  if (segments.length >= 2) return compactSpaces(segments.join(" "));
  return null;
}

export function normalizeEmployeeName(value: unknown): string | null {
  const raw = compactSpaces(String(value || ""));
  if (!raw) return null;
  const humanized = aliasToFullName(raw);
  if (humanized) return humanized;
  return raw;
}

export function toEmployeeDedupeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function extractEmployeeNameFromUser(user: UserLike): string | null {
  if (!user || typeof user !== "object") return null;

  const displayName = normalizeEmployeeName(user["display_name"]);
  if (displayName) return displayName;

  const displayNameAlt = normalizeEmployeeName(user["displayName"]);
  if (displayNameAlt) return displayNameAlt;

  const firstName = normalizeEmployeeName(user["first_name"] || user["firstName"]);
  const lastName = normalizeEmployeeName(user["last_name"] || user["lastName"]);
  const fullName = normalizeEmployeeName(`${firstName || ""} ${lastName || ""}`);
  if (fullName) return fullName;

  const username = normalizeEmployeeName(user["username"]);
  if (username) return username;

  return normalizeEmployeeName(user["email"]);
}

export function dedupeEmployeeNames(names: Array<unknown>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const name of names) {
    const normalized = normalizeEmployeeName(name);
    if (!normalized) continue;
    const key = toEmployeeDedupeKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out.sort((left, right) => left.localeCompare(right, "de"));
}
