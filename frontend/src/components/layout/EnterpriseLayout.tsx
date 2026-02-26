import React from "react";

export const ENT_GLOBAL_STYLES = `
@keyframes fadeSlideUp {
  from { opacity:0; transform:translateY(22px) scale(0.98); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
@keyframes fadeSlideRight {
  from { opacity:0; transform:translateX(-14px); }
  to   { opacity:1; transform:translateX(0);     }
}
@keyframes glowPulse {
  0%,100% { box-shadow:0 0 0 0 rgba(59,130,246,0); }
  50%     { box-shadow:0 0 24px 4px rgba(59,130,246,0.18); }
}
@keyframes dotPulse {
  0%,100% { opacity:1; transform:scale(1);   }
  50%     { opacity:0.5; transform:scale(0.7); }
}
@keyframes shimmer {
  from { background-position:-200% center; }
  to   { background-position: 200% center; }
}
@keyframes arcDraw {
  from { stroke-dashoffset: var(--arc-len); }
  to   { stroke-dashoffset: 0; }
}
.stat-card {
  animation: fadeSlideUp 0.55s cubic-bezier(.22,.68,0,1.2) both;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.stat-card:hover {
  border-color: rgba(59,130,246,0.38);
}
.kpi-card {
  animation: fadeSlideRight 0.45s ease-out both;
}
`;

export const ENT_CARD_BASE: React.CSSProperties = {
    background: "rgba(8,12,28,0.72)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(59,130,246,0.13)",
    borderRadius: "18px",
    padding: "22px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
    transition: "box-shadow 0.3s ease, border-color 0.3s ease",
};

export const ENT_CARD_HOVER_GLOW = {
    ...ENT_CARD_BASE,
    boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 30px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
};

interface EnterprisePageShellProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function EnterprisePageShell({ children, style, ...props }: EnterprisePageShellProps) {
    return (
        <>
            <style>{ENT_GLOBAL_STYLES}</style>
            <div
                style={{
                    display: "flex", flexDirection: "column", gap: "18px",
                    padding: "22px", minHeight: 0, overflowY: "auto",
                    background: "transparent",
                    ...style
                }}
                {...props}
            >
                {children}
            </div>
        </>
    );
}

interface EnterpriseHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    icon?: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export function EnterpriseHeader({ icon, title, subtitle, rightContent, style, ...props }: EnterpriseHeaderProps) {
    return (
        <div className="stat-card" style={{
            ...ENT_CARD_BASE,
            padding: "18px 22px",
            background: "linear-gradient(135deg, rgba(8,12,28,0.85) 0%, rgba(30,42,80,0.55) 100%)",
            display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "12px",
            ...style
        }} {...props}>

            {/* TITLE & ICON (LEFT) */}
            <div className="flex items-center gap-4">
                {icon && (
                    <div className="flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/10 shadow-inner">
                        {icon}
                    </div>
                )}
                <div className="flex flex-col">
                    <h1 className="text-[15px] font-bold tracking-wide text-slate-100 flex items-center gap-2">
                        {title}
                    </h1>
                    {subtitle && (
                        <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                            {subtitle}
                        </span>
                    )}
                </div>
            </div>

            {/* RIGHT CONTENT */}
            <div className="flex items-center gap-6 justify-end">
                {rightContent && (
                    <div className="flex items-center gap-2">
                        {rightContent}
                    </div>
                )}
            </div>
        </div>
    );
}

interface EnterpriseCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    delayMs?: number;
    noPadding?: boolean;
}

export function EnterpriseCard({ children, delayMs = 0, style, noPadding, ...props }: EnterpriseCardProps) {
    return (
        <div
            className="stat-card"
            style={{
                ...ENT_CARD_BASE,
                padding: noPadding ? 0 : ENT_CARD_BASE.padding,
                animationDelay: `${delayMs}ms`,
                display: "flex", flexDirection: "column",
                ...style
            }}
            {...props}
        >
            {children}
        </div>
    );
}

interface EnterpriseKpiCardProps {
    label: string;
    value: number | string;
    sub?: React.ReactNode;
    color: string;
    accent: string;
    icon: React.ElementType;
    trend?: "up" | "down" | "neutral";
    index?: number;
    expanded?: boolean;
    onToggle?: () => void;
    children?: React.ReactNode;
    className?: string;     // For optional fixed height/width classes
    contentProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function EnterpriseKpiCard({
    label, value, sub, color, accent, icon: Icon, trend, index = 0,
    expanded, onToggle, children, className, contentProps
}: EnterpriseKpiCardProps) {
    const [hovered, setHovered] = React.useState(false);

    // Using Lucide icons for trend directly is preferred, or passing raw SVGs. We'll render an up/down arrow if needed.
    const TrendIcon = trend === "up" ? (props: any) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg> :
        trend === "down" ? (props: any) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg> :
            trend === "neutral" ? (props: any) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="5" y1="12" x2="19" y2="12"></line></svg> : null;

    const trendColor = trend === "up" ? "#10b981" : trend === "down" ? "#f43f5e" : "#4b5563";

    return (
        <div
            className={`kpi-card ${className || ""}`}
            style={{
                animationDelay: `${index * 55}ms`,
                flex: expanded || children ? "1 1 100%" : "1 1 130px", // Allow full width if expanded
                minWidth: 120,
                background: hovered || expanded
                    ? `linear-gradient(135deg, rgba(8,12,28,0.9) 0%, ${accent}18 100%)`
                    : "rgba(8,12,28,0.72)",
                backdropFilter: "blur(20px)",
                border: `1px solid ${hovered || expanded ? accent + "44" : accent + "20"}`,
                borderRadius: "14px",
                display: "flex",
                flexDirection: "column",
                boxShadow: hovered || expanded
                    ? `0 0 28px ${accent}20, 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)`
                    : "0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
                transition: "all 0.25s ease",
                cursor: onToggle ? "pointer" : "default",
                position: "relative",
                overflow: "hidden",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Top shimmer line */}
            <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: "1px",
                background: `linear-gradient(90deg, transparent, ${accent}60, transparent)`,
                opacity: hovered || expanded ? 1 : 0.4,
                transition: "opacity 0.3s ease",
            }} />

            <div
                onClick={onToggle}
                style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: (expanded && children) ? "none" : 1 }}
            >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    {/* Icon badge */}
                    <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 32, height: 32, borderRadius: "8px",
                        background: `${accent}18`, border: `1px solid ${accent}30`,
                        marginBottom: "10px", flexShrink: 0
                    }}>
                        <Icon style={{ width: 15, height: 15, color: accent }} />
                    </div>
                    {onToggle && (
                        <div style={{ opacity: 0.5 }}>
                            {expanded ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>}
                        </div>
                    )}
                </div>

                <div style={{
                    fontSize: "11px", fontWeight: 600, letterSpacing: "0.09em",
                    color: "#4b5563", textTransform: "uppercase", marginBottom: "4px"
                }}>
                    {label}
                </div>
                {value !== undefined && value !== null && (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px" }}>
                        <span style={{
                            fontSize: "28px", fontWeight: "800", lineHeight: 1,
                            color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.5px"
                        }}>
                            {value}
                        </span>
                        {TrendIcon && (
                            <TrendIcon style={{ color: trendColor, marginBottom: "3px" }} />
                        )}
                    </div>
                )}
                {sub && (
                    <div style={{ fontSize: "11px", color: "#374151", marginTop: "4px" }}>{sub}</div>
                )}
            </div>

            {expanded && children && (
                <div
                    {...contentProps}
                    style={{
                        borderTop: `1px solid ${accent}20`,
                        padding: "12px 18px",
                        flex: 1,
                        overflowY: "auto",
                        minHeight: 0,
                        ...(contentProps?.style || {})
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

export const ENT_SECTION_TITLE: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em",
    color: "#374151", textTransform: "uppercase", marginBottom: "14px"
};

