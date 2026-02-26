
import { useEffect, useRef } from 'react';
import { Card } from "../ui/card";

type ShiftType = string;

interface Props {
    x: number;
    y: number;
    employeeName?: string; // [NEW]
    selectedCount?: number;
    onClose: () => void;
    onSelect: (value: ShiftType) => void;
}

export function ShiftContextMenu({ x, y, employeeName, selectedCount = 1, onClose, onSelect }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Prevent menu from going off-screen (basic safety)
    const style = {
        top: y,
        left: x,
    };

    return (
        <div
            ref={ref}
            className="fixed z-50 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
            style={style}
        >
            <Card className="p-1 shadow-xl border border-border bg-popover text-popover-foreground flex flex-col gap-0.5">
                <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border/50 mb-1 flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">Mitarbeiter: {employeeName || "—"}</span>
                    <span>{selectedCount > 1 ? `${selectedCount} Tage ausgewählt` : "1 Tag ausgewählt"}</span>
                </div>
                <MenuItem label="Früh 1 (E1)" onClick={() => onSelect('E1')} />
                <MenuItem label="Früh 2 (E2)" onClick={() => onSelect('E2')} />
                <MenuItem label="Spät 1 (L1)" onClick={() => onSelect('L1')} />
                <MenuItem label="Spät 2 (L2)" onClick={() => onSelect('L2')} />
                <MenuItem label="Nacht (N)" onClick={() => onSelect('N')} />
                <div className="h-px bg-border my-1" />
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground">ABWESENHEIT</div>
                <MenuItem label="Urlaub (U)" onClick={() => onSelect('ABSENCE:VACATION')} />
                <MenuItem label="Krank (K)" onClick={() => onSelect('ABSENCE:SICK')} />
                <MenuItem label="Training (T)" onClick={() => onSelect('ABSENCE:TRAINING')} />
                <MenuItem label="Offsite (O)" onClick={() => onSelect('ABSENCE:OFFSITE')} />
                <div className="h-px bg-border my-1" />
                <MenuItem label="Frei / Löschen" onClick={() => onSelect('')} danger />
                <div className="h-px bg-border my-1" />
                <MenuItem label="Änderungshistorie" onClick={() => onSelect('HISTORY')} />
                <MenuItem label="Regeln verwalten" onClick={() => onSelect('CONSTRAINTS')} />
            </Card>
        </div>
    );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button
            className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground ${danger ? "text-red-500 hover:text-red-600 hover:bg-red-50" : ""
                }`}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
        >
            {label}
        </button>
    );
}
