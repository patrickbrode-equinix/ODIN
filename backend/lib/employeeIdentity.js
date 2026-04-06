import { normalizeName } from "./nameNorm.js";

function normalizeAsciiToken(value) {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

function toDisplayToken(value) {
  const normalized = normalizeAsciiToken(value);
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function splitEmailLocalPart(localPart) {
  const base = String(localPart || "").trim().split("+")[0];
  if (!base) return null;

  const parts = base
    .replace(/[_-]+/g, ".")
    .split(".")
    .flatMap((segment) => String(segment || "")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(/\s+/)
      .filter(Boolean)
    )
    .map(toDisplayToken)
    .filter(Boolean);

  if (parts.length < 2) return null;

  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];
  const firstToken = parts[0] || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!firstToken || !lastName || !displayName) return null;

  return {
    firstName,
    firstToken,
    lastName,
    displayName,
  };
}

export function isEmailLike(value) {
  return /^[^@\s]+@[^@\s]+(?:\.[^@\s]+)+$/.test(String(value || "").trim());
}

export function splitEmployeeName(name) {
  if (!name || typeof name !== "string") return null;

  let cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  if (isEmailLike(cleaned)) {
    const [localPart] = cleaned.split("@");
    const fromEmail = splitEmailLocalPart(localPart);
    if (!fromEmail) return null;

    return {
      originalName: cleaned,
      firstName: fromEmail.firstName,
      firstToken: fromEmail.firstToken,
      lastName: fromEmail.lastName,
      displayName: fromEmail.displayName,
    };
  }

  let firstName = "";
  let lastName = "";

  if (cleaned.includes(",")) {
    const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    lastName = parts[0];
    firstName = parts.slice(1).join(" ");
  } else {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    firstName = parts.slice(0, -1).join(" ");
    lastName = parts[parts.length - 1];
  }

  const firstToken = firstName.split(/\s+/).filter(Boolean)[0] || "";
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!firstToken || !lastName || !displayName) return null;

  return {
    originalName: cleaned,
    firstName,
    firstToken,
    lastName,
    displayName,
  };
}

export function buildNameKeyFromParts(firstName, lastName) {
  const normalizedFirst = normalizeName(firstName || "").split(/\s+/).filter(Boolean).join(" ");
  const normalizedLast = normalizeName(lastName || "");
  if (!normalizedFirst || !normalizedLast) return null;
  return `${normalizedFirst}|${normalizedLast}`;
}

export function buildShortNameKeyFromParts(firstName, lastName) {
  const firstToken = String(firstName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  return buildNameKeyFromParts(firstToken, lastName);
}

export function buildUsernameBase(firstName, lastName) {
  const firstToken = String(firstName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  const firstInitial = normalizeAsciiToken(firstToken).charAt(0);
  const normalizedLast = normalizeAsciiToken(lastName);
  if (!firstInitial || !normalizedLast) return null;
  return `${firstInitial}${normalizedLast}`;
}

export function generateEmailFromName(name, domain = "eu.equinix.com") {
  const parts = splitEmployeeName(name);
  if (!parts) return null;

  const normalizedFirst = normalizeAsciiToken(parts.firstToken);
  const normalizedLast = normalizeAsciiToken(parts.lastName);
  if (!normalizedFirst || !normalizedLast) return null;

  return `${normalizedFirst}.${normalizedLast}@${domain}`;
}