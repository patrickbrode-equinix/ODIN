
import { useEffect, useState } from "react";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function getFormattedDateTime() {
    const now = new Date();
    const dayName = new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(now).replace(".", "");
    const day = pad2(now.getDate());
    const month = pad2(now.getMonth() + 1);
    const year = now.getFullYear();
    const hours = pad2(now.getHours());
    const minutes = pad2(now.getMinutes());

    return `${dayName}, ${day}.${month}.${year} – ${hours}:${minutes}`;
}

export function DateTimeBadge() {
    const [label, setLabel] = useState(getFormattedDateTime());

    useEffect(() => {
        const id = setInterval(() => {
            setLabel(getFormattedDateTime());
        }, 15_000); // 15s refresh to be safe for minute changes
        return () => clearInterval(id);
    }, []);

    return (
        <div className="font-mono text-sm bg-accent/50 px-3 py-1 rounded-md border border-white/10 text-muted-foreground whitespace-nowrap">
            {label}
        </div>
    );
}
