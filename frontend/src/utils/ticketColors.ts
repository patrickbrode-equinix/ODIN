/* ------------------------------------------------ */
/* TICKET COLOR CODING – SHARED UTILITY             */
/* ------------------------------------------------ */

/**
 * Calculates remaining hours from a commit date string.
 * Prefers revised_commit_date, falls back to commit_date.
 */
export function getRemainingMs(ticket: Record<string, any>): number | null {
    const dateStr =
        ticket.revised_commit_date ??
        ticket.revisedCommitDate ??
        ticket.commit_date ??
        ticket.commitDate ??
        null;

    if (!dateStr) return null;

    const target = new Date(dateStr).getTime();
    if (!Number.isFinite(target)) return null;

    return target - Date.now();
}

/**
 * Returns a human-readable remaining time string.
 * - hours (floor) if >= 1h
 * - minutes if < 1h
 * - negative values shown as "Überfällig Xh" / "Xm"
 */
export function formatRemainingTime(ms: number | null): string {
    if (ms === null) return "—";

    const totalMinutes = Math.floor(Math.abs(ms) / 60_000);
    let h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    const prefix = ms < 0 ? "-" : "";

    // If more than 24 hours, show days and hours (e.g. "1d 5h")
    if (h >= 24) {
        const d = Math.floor(h / 24);
        h = h % 24;
        return `${prefix}${d}d ${h}h`;
    }

    if (h >= 1) return `${prefix}${h}h ${m}m`;
    return `${prefix}${m}m`;
}

/**
 * Color tier based on remaining milliseconds.
 */
export type ColorTier = "blue" | "green" | "orange" | "red" | "grey";

export function getColorTier(ms: number | null): ColorTier {
    if (ms === null) return "grey";
    const hours = ms / 3_600_000;

    if (hours < 0) return "grey";       // Overdue
    if (hours <= 8) return "red";       // 0–8h
    if (hours <= 15) return "orange";   // 8–15h
    if (hours <= 24) return "green";    // 15–24h
    return "blue";                      // > 24h
}

/**
 * Tailwind classes for tile background + border per tier.
 */
export const tierClasses: Record<ColorTier, string> = {
    blue: "bg-blue-500/20 border-blue-400/30",
    green: "bg-green-500/20 border-green-400/30",
    orange: "bg-orange-500/20 border-orange-400/30",
    red: "bg-red-500/20 border-red-400/30",
    grey: "bg-gray-500/20 border-gray-400/30",
};

/**
 * One-call convenience: ticket → CSS classes.
 */
export function getTicketTierClasses(ticket: Record<string, any>): string {
    return tierClasses[getColorTier(getRemainingMs(ticket))];
}
