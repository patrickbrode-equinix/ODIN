import { MoonStar } from "lucide-react";
import { Button } from "../ui/button";
import { RamadanMeta, SunTime } from "../../api/ramadan";
import { useLanguage } from "../../context/LanguageContext";
import { RamadanDialog } from "./RamadanDialog";
import { useState } from "react";

interface Props {
    meta: RamadanMeta | null;
    timings: SunTime[];
    loading?: boolean;
    isActive?: boolean;
    onToggle?: () => void;
}

export function RamadanBadge({ meta, timings, loading, isActive, onToggle }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const { language } = useLanguage();
    const isGerman = language === "de";

    // Determines if we are essentially "in" Ramadan season (dates match) for styling purposes,
    // regardless of the toggle state. But the toggle state (isActive) dictates the visual "On/Off".
    // actually, let's stick to the props: isActive tells us if the OVERLAY is enabled.

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsOpen(true);
    };

    const handleClick = () => {
        if (onToggle) onToggle();
    };

    return (
        <>
            <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`h-8 gap-2 ${isActive ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-purple-600 border-purple-200 hover:bg-purple-50'}`}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                disabled={loading && !meta}
                title={meta
                    ? (isGerman ? "Linksklick: Overlay an/aus\nRechtsklick: Details anzeigen" : "Left click: toggle overlay\nRight click: show details")
                    : (isGerman ? "Ramadan-Daten werden geladen..." : "Ramadan data is loading...")}
            >
                <MoonStar className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline font-medium">Ramadan</span>
            </Button>

            <RamadanDialog
                open={isOpen}
                onClose={() => setIsOpen(false)}
                data={meta}
                timings={timings}
                loading={loading}
            />
        </>
    );
}
