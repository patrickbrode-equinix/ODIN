/* ─────────────────────────────────────────────────────────────────────────── */
/*  DASHBOARD STATISTIKEN – DARK ENTERPRISE PREMIUM v3                        */
/*  Sub-route : /dashboard/statistiken                                         */
/*  Lib       : Recharts ^2.12.7 – no new deps                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

import { useEffect, useId, useRef, useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
    ChevronLeft, ChevronRight, BarChart2 as ChartIcon,
    TrendingUp, TrendingDown, Minus, Activity, RefreshCw,
    Zap, CheckCircle2, AlertCircle, Target
} from "lucide-react";
import { Button } from "../ui/button";
import { api } from "../../api/api";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, EnterpriseKpiCard, ENT_CARD_BASE } from "../layout/EnterpriseLayout";



const TOOLTIP_STYLE: React.CSSProperties = {
    backgroundColor: "#070d1e",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "#e2e8f0",
    boxShadow: "0 12px 40px rgba(0,0,0,0.7), 0 0 16px rgba(59,130,246,0.1)",
    padding: "10px 14px",
};

const AXIS_TICK = { fontSize: 11, fill: "#374151" };

const GRID = {
    strokeDasharray: "4 4",
    stroke: "rgba(255,255,255,0.045)",
    vertical: false as const,
};

const COLORS = {
    sh: "#3b82f6",
    tt: "#f43f5e",
    cc: "#f59e0b",
    other: "#4b5563",
    dispatch: "#6366f1",
    closed: "#10b981",
    expired: "#f43f5e",
    ok: "#10b981",
    palette: ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"],
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HOOKS                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

/** Smoothly count up to `target` whenever `target` changes. */
function useCountUp(target: number, duration = 900): number {
    const [val, setVal] = useState(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (target === 0) { setVal(0); return; }
        const start = Date.now();
        const from = 0;
        const tick = () => {
            const elapsed = Date.now() - start;
            const p = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(from + eased * (target - from)));
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
    }, [target, duration]);

    return val;
}

/** Stagger delay helper */
function delay(i: number, base = 60) { return { animationDelay: `${i * base}ms` }; }

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPERS                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

function getWeekBounds(offset: number): { from: string; to: string; label: string } {
    const now = new Date();
    const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + offset * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
        from: monday.toISOString().split("T")[0],
        to: sunday.toISOString().split("T")[0],
        label: `${fmt(monday)} – ${fmt(sunday)}`,
    };
}

function fmtDay(v: string) {
    const d = new Date(v);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SVG SEMI-GAUGE                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function SemiGauge({ ok, expired }: { ok: number; expired: number }) {
    const total = ok + expired;
    const score = total === 0 ? 0 : Math.round((ok / total) * 100);
    const animated = useCountUp(score);

    const R = 52;
    const cx = 80, cy = 72;
    const circumference = Math.PI * R;                 // half-circle
    const offset = circumference * (1 - score / 100);  // filled portion

    const color =
        score >= 70 ? "#10b981" :
            score >= 40 ? "#f59e0b" : "#f43f5e";

    // gradient stop colors
    const gradStart = score >= 70 ? "#34d399" : score >= 40 ? "#fcd34d" : "#fb7185";
    const gradEnd = score >= 70 ? "#059669" : score >= 40 ? "#f59e0b" : "#f43f5e";

    const id = useId();

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <span style={{
                fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em",
                color: "#374151", textTransform: "uppercase", marginBottom: "12px"
            }}>
                Commit Health
            </span>
            {total === 0 ? (
                <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", color: "#4b5563"
                }}>Keine Daten</div>
            ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <svg viewBox="0 0 160 82" style={{ width: "100%", maxWidth: "180px", overflow: "visible" }}>
                        <defs>
                            <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={gradStart} />
                                <stop offset="100%" stopColor={gradEnd} />
                            </linearGradient>
                            <filter id={`${id}-glow`}>
                                <feGaussianBlur stdDeviation="3" result="b" />
                                <feComposite in="SourceGraphic" in2="b" operator="over" />
                            </filter>
                        </defs>
                        {/* Track */}
                        <path
                            d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
                            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
                            strokeLinecap="round"
                        />
                        {/* Value arc */}
                        {score > 0 && (
                            <path
                                d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
                                fill="none"
                                stroke={`url(#${id}-g)`}
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                style={{
                                    transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2)",
                                    filter: `drop-shadow(0 0 6px ${color})`,
                                }}
                            />
                        )}
                        {/* Score */}
                        <text x={cx} y={cy - 12} textAnchor="middle"
                            fill={color} fontSize="26" fontWeight="800" fontFamily="system-ui">
                            {animated}%
                        </text>
                        <text x={cx} y={cy + 4} textAnchor="middle"
                            fill="#4b5563" fontSize="10" letterSpacing="2" fontFamily="system-ui">
                            ON-TIME
                        </text>
                    </svg>
                    <div style={{ display: "flex", gap: "20px", marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#4b5563" }}>
                            ✓ OK <span style={{ color: "#10b981", fontWeight: 700 }}>{ok}</span>
                        </span>
                        <span style={{ fontSize: "12px", color: "#4b5563" }}>
                            ✗ Expired <span style={{ color: "#f43f5e", fontWeight: 700 }}>{expired}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}


/* ─────────────────────────────────────────────────────────────────────────── */
/*  PREMIUM DONUT CHART                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */

function DonutChart({
    title, data, centerLabel, height = 190,
}: {
    title: string;
    data: { name: string; value: number; color: string }[];
    centerLabel?: string;
    height?: number;
}) {
    const total = data.reduce((a, b) => a + b.value, 0);
    const [active, setActive] = useState<number | null>(null);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <span style={{
                fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em",
                color: "#374151", textTransform: "uppercase", marginBottom: "14px"
            }}>
                {title}
            </span>
            {total === 0 ? (
                <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", color: "#4b5563"
                }}>Keine Daten</div>
            ) : (
                <>
                    <div style={{ position: "relative", height }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data}
                                    cx="50%" cy="50%"
                                    innerRadius={height * 0.29}
                                    outerRadius={height * 0.44}
                                    paddingAngle={4}
                                    dataKey="value"
                                    strokeWidth={0}
                                    animationBegin={200}
                                    animationDuration={1100}
                                    onMouseEnter={(_, i) => setActive(i)}
                                    onMouseLeave={() => setActive(null)}
                                >
                                    {data.map((d, i) => (
                                        <Cell
                                            key={i}
                                            fill={d.color}
                                            opacity={active === null || active === i ? 1 : 0.35}
                                            style={{
                                                filter: active === i ? `drop-shadow(0 0 8px ${d.color})` : "none",
                                                transition: "opacity 0.2s, filter 0.2s",
                                            }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={TOOLTIP_STYLE}
                                    formatter={(val: number, name: string) => [
                                        `${val}  (${((val / total) * 100).toFixed(0)}%)`, name,
                                    ]}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Center */}
                        <div style={{
                            position: "absolute", inset: 0, display: "flex",
                            flexDirection: "column", alignItems: "center", justifyContent: "center",
                            pointerEvents: "none",
                        }}>
                            <span style={{
                                fontSize: "22px", fontWeight: 800, color: "#e2e8f0",
                                lineHeight: 1, fontVariantNumeric: "tabular-nums"
                            }}>
                                {active !== null ? data[active].value : total}
                            </span>
                            <span style={{
                                fontSize: "10px", color: "#4b5563", letterSpacing: "0.12em",
                                textTransform: "uppercase", marginTop: "2px"
                            }}>
                                {active !== null ? data[active].name : centerLabel ?? "Gesamt"}
                            </span>
                        </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: "10px" }}>
                        {data.map((d, i) => (
                            <div key={d.name}
                                style={{
                                    display: "flex", alignItems: "center", gap: "5px",
                                    fontSize: "11px", color: active === i ? "#e2e8f0" : "#6b7280",
                                    cursor: "default", transition: "color 0.15s",
                                }}
                                onMouseEnter={() => setActive(i)}
                                onMouseLeave={() => setActive(null)}
                            >
                                <div style={{
                                    width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0,
                                    boxShadow: active === i ? `0 0 6px ${d.color}` : "none",
                                    transition: "box-shadow 0.15s",
                                }} />
                                <span>{d.name}</span>
                                <span style={{ fontWeight: 700, color: active === i ? d.color : "#9ca3af" }}>
                                    {d.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  DUAL AREA CHART                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function DualAreaChart({
    title, data, keyA, keyB, labelA, labelB, colorA, colorB, height = 210,
}: {
    title: string; data: any[]; keyA: string; keyB: string;
    labelA: string; labelB: string; colorA: string; colorB: string; height?: number;
}) {
    const id = useId();
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <span style={{
                    fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em",
                    color: "#374151", textTransform: "uppercase"
                }}>{title}</span>
                <div style={{ display: "flex", gap: "14px" }}>
                    {[{ c: colorA, l: labelA }, { c: colorB, l: labelB }].map(({ c, l }) => (
                        <span key={l} style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            fontSize: "11px", color: "#6b7280"
                        }}>
                            <span style={{
                                display: "inline-block", width: 20, height: 2,
                                borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}`
                            }} />
                            {l}
                        </span>
                    ))}
                </div>
            </div>
            {data.length === 0 ? (
                <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", color: "#4b5563"
                }}>Keine Daten</div>
            ) : (
                <div style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                            <defs>
                                {[{ id: "a", c: colorA }, { id: "b", c: colorB }].map(({ id: gid, c }) => (
                                    <linearGradient key={gid} id={`${id}-${gid}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={c} stopOpacity={0.40} />
                                        <stop offset="95%" stopColor={c} stopOpacity={0.0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid {...GRID} />
                            <XAxis dataKey="day" tick={AXIS_TICK} tickFormatter={fmtDay}
                                axisLine={false} tickLine={false} />
                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtDay}
                                cursor={{ stroke: "rgba(99,102,241,0.25)", strokeWidth: 1 }} />
                            <Area type="monotone" dataKey={keyA} name={labelA}
                                stroke={colorA} strokeWidth={2} fill={`url(#${id}-a)`}
                                dot={false} activeDot={{ r: 4, fill: colorA, strokeWidth: 0 }}
                                animationDuration={1300} animationEasing="ease-out" />
                            <Area type="monotone" dataKey={keyB} name={labelB}
                                stroke={colorB} strokeWidth={2} fill={`url(#${id}-b)`}
                                dot={false} activeDot={{ r: 4, fill: colorB, strokeWidth: 0 }}
                                animationDuration={1300} animationEasing="ease-out" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SINGLE AREA CHART                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

function SingleAreaChart({
    title, data, color, label, height = 140,
}: { title: string; data: { day: string; count: number }[]; color: string; label: string; height?: number }) {
    const id = useId();
    const max = Math.max(...data.map(d => d.count), 0);
    const isEmpty = data.length === 0 || max === 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{
                    fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em",
                    color: "#374151", textTransform: "uppercase"
                }}>{title}</span>
                {!isEmpty && (
                    <span style={{
                        fontSize: "11px", color, fontWeight: 700,
                        background: `${color}15`, borderRadius: "5px", padding: "2px 7px",
                        border: `1px solid ${color}30`
                    }}>
                        Peak {max}
                    </span>
                )}
            </div>
            {isEmpty ? (
                <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", color: "#4b5563"
                }}>Keine Daten</div>
            ) : (
                <div style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                            <defs>
                                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.45} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid {...GRID} />
                            <XAxis dataKey="day" tick={AXIS_TICK} tickFormatter={fmtDay}
                                axisLine={false} tickLine={false} />
                            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={fmtDay}
                                formatter={(v: number) => [v, label]}
                                cursor={{ stroke: "rgba(99,102,241,0.2)", strokeWidth: 1 }} />
                            <Area type="monotone" dataKey="count" name={label}
                                stroke={color} strokeWidth={2} fill={`url(#${id})`}
                                dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                                animationDuration={1200} animationEasing="ease-out" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PAGE                                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function DashboardStatistik() {
    const [weekOffset, setWeekOffset] = useState(0);
    const [weekBounds, setWeekBounds] = useState(() => getWeekBounds(0));
    const [pieData, setPieData] = useState<any>(null);
    const [dispatchData, setDispatchData] = useState<{ day: string; count: number }[]>([]);
    const [closedData, setClosedData] = useState<{ day: string; count: number }[]>([]);
    const [expiredData, setExpiredData] = useState<{ day: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    useEffect(() => { setWeekBounds(getWeekBounds(weekOffset)); }, [weekOffset]);

    useEffect(() => {
        setLoading(true);
        const { from, to } = weekBounds;
        Promise.allSettled([
            api.get("/stats/weekly-pie"),
            api.get(`/stats/dispatch?from=${from}&to=${to}`),
            api.get(`/stats/closed?from=${from}&to=${to}`),
            api.get(`/stats/expired?from=${from}&to=${to}`),
        ]).then(([pieRes, dispRes, clRes, expRes]) => {
            if (pieRes.status === "fulfilled") setPieData(pieRes.value.data);
            if (dispRes.status === "fulfilled") setDispatchData(Array.isArray(dispRes.value.data) ? dispRes.value.data : []);
            if (clRes.status === "fulfilled") setClosedData(Array.isArray(clRes.value.data) ? clRes.value.data : []);
            if (expRes.status === "fulfilled") setExpiredData(Array.isArray(expRes.value.data) ? expRes.value.data : []);
            setLoading(false);
            setLastRefresh(new Date());
        });
    }, [weekBounds]);

    /* ── derived ── */
    const activeTotal = pieData?.debug?.activeTicketsFound || 0;
    const closedTotal = pieData?.total || 0;
    const overdueTotal = pieData?.overdue || 0;
    const healthOk = pieData?.health?.ok || 0;
    const healthExpired = pieData?.health?.expired || 0;
    const onTimeRate = closedTotal > 0 ? Math.round(((closedTotal - overdueTotal) / closedTotal) * 100) : 0;

    const typesData = pieData ? [
        { name: "Smart Hand", value: pieData.types?.sh || 0, color: COLORS.sh },
        { name: "Trouble Ticket", value: pieData.types?.tt || 0, color: COLORS.tt },
        { name: "Cross Connect", value: pieData.types?.cc || 0, color: COLORS.cc },
        {
            name: "Other",
            value: Math.max(0, activeTotal - (pieData.types?.sh || 0) - (pieData.types?.tt || 0) - (pieData.types?.cc || 0)),
            color: COLORS.other,
        },
    ].filter(d => d.value > 0) : [];

    const statusData = pieData?.status
        ? Object.entries(pieData.status).map(([k, v]: any, i) => ({
            name: k, value: v, color: COLORS.palette[i % COLORS.palette.length],
        }))
        : [];

    /* ── merged area chart ── */
    const mergedMap: Record<string, { day: string; dispatch: number; closed: number }> = {};
    [...dispatchData.map(d => d.day), ...closedData.map(d => d.day)].forEach(day => {
        mergedMap[day] = mergedMap[day] || { day, dispatch: 0, closed: 0 };
    });
    dispatchData.forEach(d => { if (mergedMap[d.day]) mergedMap[d.day].dispatch = d.count; });
    closedData.forEach(d => { if (mergedMap[d.day]) mergedMap[d.day].closed = d.count; });
    const mergedData = Object.values(mergedMap).sort((a, b) => a.day.localeCompare(b.day));

    /* ── closed vs expired ── */
    const ceMap: Record<string, { day: string; closed: number; expired: number }> = {};
    [...closedData.map(d => d.day), ...expiredData.map(d => d.day)].forEach(day => {
        ceMap[day] = ceMap[day] || { day, closed: 0, expired: 0 };
    });
    closedData.forEach(d => { if (ceMap[d.day]) ceMap[d.day].closed = d.count; });
    expiredData.forEach(d => { if (ceMap[d.day]) ceMap[d.day].expired = d.count; });
    const ceData = Object.values(ceMap).sort((a, b) => a.day.localeCompare(b.day));

    const kpis = [
        { label: "Aktive Tickets", value: activeTotal, color: "#6366f1", accent: "#6366f1", icon: Activity, trend: undefined },
        { label: "Smart Hand", value: pieData?.types?.sh ?? 0, color: COLORS.sh, accent: COLORS.sh, icon: Zap, trend: undefined },
        { label: "Trouble Ticket", value: pieData?.types?.tt ?? 0, color: COLORS.tt, accent: COLORS.tt, icon: AlertCircle, trend: undefined },
        { label: "Cross Connect", value: pieData?.types?.cc ?? 0, color: COLORS.cc, accent: COLORS.cc, icon: Target, trend: undefined },
        { label: "Closed (Woche)", value: closedTotal, color: COLORS.closed, accent: COLORS.closed, icon: CheckCircle2, trend: "up" as const },
        { label: "Overdue", value: overdueTotal, color: overdueTotal > 0 ? COLORS.tt : "#4b5563", accent: overdueTotal > 0 ? COLORS.tt : "#4b5563", icon: RefreshCw, sub: closedTotal > 0 ? `${onTimeRate}% on-time` : undefined, trend: (overdueTotal === 0 ? "neutral" : "down") as "neutral" | "down" },
    ];

    return (
        <EnterprisePageShell>
            {/* ── HEADER ── */}
            <EnterpriseHeader
                icon={<ChartIcon style={{ width: 18, height: 18, color: "#818cf8" }} />}
                title={<>Team Statistiken</>}
                subtitle={
                    <>
                        <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: loading ? "#f59e0b" : "#10b981",
                            animation: "dotPulse 1.8s ease-in-out infinite",
                        }} />
                        <span style={{ fontSize: "11px", color: "#4b5563" }}>
                            {loading ? "Aktualisierung…" : `Zuletzt: ${lastRefresh.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
                        </span>
                    </>
                }
                rightContent={
                    <>
                        <button
                            onClick={() => setWeekOffset(p => p - 1)}
                            style={{
                                width: 30, height: 30, borderRadius: "8px", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                                color: "#818cf8", cursor: "pointer",
                            }}
                        >
                            <ChevronLeft style={{ width: 14, height: 14 }} />
                        </button>
                        <span style={{
                            fontSize: "12px", fontWeight: 600, color: "#94a3b8",
                            minWidth: "148px", textAlign: "center",
                            background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.07)",
                            borderRadius: "8px", padding: "5px 10px",
                        }}>
                            {weekBounds.label}
                        </span>
                        <button
                            onClick={() => setWeekOffset(p => p + 1)}
                            disabled={weekOffset >= 0}
                            style={{
                                width: 30, height: 30, borderRadius: "8px", display: "flex",
                                alignItems: "center", justifyContent: "center",
                                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                                color: weekOffset >= 0 ? "#374151" : "#818cf8", cursor: weekOffset >= 0 ? "not-allowed" : "pointer",
                            }}
                        >
                            <ChevronRight style={{ width: 14, height: 14 }} />
                        </button>
                        {weekOffset !== 0 && (
                            <button
                                onClick={() => setWeekOffset(0)}
                                style={{
                                    fontSize: "11px", fontWeight: 600, color: "#818cf8",
                                    background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                                    borderRadius: "8px", padding: "5px 10px", cursor: "pointer",
                                }}
                            >
                                Heute
                            </button>
                        )}
                    </>
                }
            />

            {/* ── KPI ROW ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                {kpis.map((k, i) => (
                    <EnterpriseKpiCard key={k.label} index={i} {...k} />
                ))}
            </div>

            {/* ── ROW 1: Big area + donut + gauge ── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "14px" }}>
                <EnterpriseCard delayMs={120}>
                    <DualAreaChart
                        title="Dispatch vs. Closed"
                        data={mergedData} keyA="dispatch" keyB="closed"
                        labelA="Dispatched" labelB="Closed"
                        colorA={COLORS.dispatch} colorB={COLORS.closed}
                        height={230}
                    />
                </EnterpriseCard>
                <EnterpriseCard delayMs={180}>
                    <DonutChart title="Ticket-Typen" data={typesData} centerLabel="Aktiv" height={190} />
                </EnterpriseCard>
                <EnterpriseCard delayMs={240}>
                    <SemiGauge ok={healthOk} expired={healthExpired} />
                </EnterpriseCard>
            </div>

            {/* ── ROW 2: Closed/Expired + Status donut ── */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px" }}>
                <EnterpriseCard delayMs={200}>
                    <DualAreaChart
                        title="Closed vs. Expired"
                        data={ceData} keyA="closed" keyB="expired"
                        labelA="Closed" labelB="Expired"
                        colorA={COLORS.closed} colorB={COLORS.expired}
                        height={190}
                    />
                </EnterpriseCard>
                <EnterpriseCard delayMs={260}>
                    <DonutChart title="Status-Verteilung" data={statusData} centerLabel="Status" height={170} />
                </EnterpriseCard>
            </div>

            {/* ── ROW 3: 3 mini area charts ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "14px" }}>
                {[
                    { title: "Dispatch / Tag", data: dispatchData, color: COLORS.dispatch, label: "Dispatched" },
                    { title: "Closed / Tag", data: closedData, color: COLORS.closed, label: "Closed" },
                    { title: "Expired / Tag", data: expiredData, color: COLORS.expired, label: "Expired" },
                ].map(({ title, data, color, label }, i) => (
                    <EnterpriseCard key={title} delayMs={300 + i * 70}>
                        <SingleAreaChart title={title} data={data} color={color} label={label} height={140} />
                    </EnterpriseCard>
                ))}
            </div>
        </EnterprisePageShell>
    );
}
