import { useState, useEffect } from "react";
import { Info, Save, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
    getDashboardInfo,
    updateDashboardInfo,
    DashboardInfo,
    getInfoEntries,
    createInfoEntry,
    deleteInfoEntry,
    DashboardInfoEntry,
    updateInfoEntry
} from "../../api/dashboard";

export function DashboardInfoBar() {
    const [info, setInfo] = useState<DashboardInfo | null>(null);
    const [entries, setEntries] = useState<DashboardInfoEntry[]>([]);
    const [newContent, setNewContent] = useState("");
    const [saving, setSaving] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, entryId: number } | null>(null);

    useEffect(() => {
        loadData();
        // Poll every 30s to keep in sync
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close menu on click anywhere
    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener("click", close);
        return () => window.removeEventListener("click", close);
    }, []);

    const loadData = async () => {
        try {
            const [i, e] = await Promise.all([
                getDashboardInfo(),
                getInfoEntries()
            ]);
            setInfo(i);
            setEntries(e);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleVisibility = async () => {
        if (!info) return;
        try {
            const updated = await updateDashboardInfo(info.content, !info.is_visible);
            setInfo(updated);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async () => {
        if (!newContent.trim()) return;
        setSaving(true);
        try {
            const entry = await createInfoEntry(newContent);
            setEntries([entry, ...entries]);
            setNewContent("");
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Eintrag wirklich löschen?")) return;
        try {
            await deleteInfoEntry(id);
            setEntries(entries.filter(e => e.id !== id));
        } catch (err) {
            console.error(err);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, entryId: number) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, entryId });
    };

    const handleUpdate = async (updates: { deleteAt?: string | null, type?: 'info' | 'instruction' }) => {
        if (!contextMenu) return;
        try {
            const updated = await updateInfoEntry(contextMenu.entryId, updates);
            setEntries(prev => prev.map(e => e.id === contextMenu.entryId ? updated : e));
            setContextMenu(null);
        } catch (e) { console.error(e); }
    };

    // Helper to format deletion date
    const handleUpdateDeleteAt = (dateStr: string) => {
        let val: string | null = null;
        if (dateStr) {
            const d = new Date(dateStr);
            d.setHours(23, 59, 59, 999);
            val = d.toISOString();
        }
        handleUpdate({ deleteAt: val });
    };

    return (
        <div className="space-y-3 h-full flex flex-col">
            {/* Visibility toggle (Legacy Info Object) */}
            {info && (
                <div className="flex items-center justify-between flex-none">
                    <div className={`text-[0.85em] px-2 py-0.5 rounded ${info.is_visible ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {info.is_visible ? "ANZEIGE AKTIV" : "VERBORGEN"}
                    </div>
                    <Button
                        variant={info.is_visible ? "destructive" : "secondary"}
                        size="sm"
                        onClick={toggleVisibility}
                        className="h-7 text-[0.85em]"
                    >
                        {info.is_visible ? "Ausblenden" : "Anzeigen"}
                    </Button>
                </div>
            )}

            {/* Entry list (Scrollable GRID) */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                {entries.length === 0 ? (
                    <div className="text-[0.9em] text-muted-foreground italic">Keine Einträge vorhanden.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-2 pb-2">
                        {entries.map((entry) => {
                            const isInstruction = entry.type === 'instruction';
                            // Shiftplan-like Card Style for Entries
                            // Using conditional classes for "Instruction" vs "Info"
                            return (
                                <div
                                    key={entry.id}
                                    onContextMenu={(e) => handleContextMenu(e, entry.id)}
                                    className={`
                                        group relative flex flex-col justify-between p-3 rounded-xl border transition-all cursor-context-menu
                                        ${isInstruction
                                            ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15"
                                            : "bg-white/5 border-white/10 hover:bg-white/10"
                                        }
                                    `}
                                >
                                    {/* Header: Type Badge + Icon */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className={`text-[0.75em] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isInstruction ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"
                                            }`}>
                                            {isInstruction ? "Anweisung" : "Information"}
                                        </div>
                                        <Info className={`w-3.5 h-3.5 ${isInstruction ? "text-amber-400" : "text-blue-400"}`} />
                                    </div>

                                    {/* Content */}
                                    <div className="text-[1em] leading-relaxed whitespace-pre-wrap break-words flex-1 mb-2">
                                        {entry.content}
                                    </div>

                                    {/* Footer: Date + Auto-Delete Badge */}
                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
                                        <div className="text-[0.75em] text-muted-foreground">
                                            {new Date(entry.created_at).toLocaleDateString("de-DE")}
                                        </div>
                                        {entry.delete_at && (
                                            <div className="text-[0.7em] bg-red-500/20 text-red-300 px-1 py-0.5 rounded border border-red-500/10">
                                                Löschung: {new Date(entry.delete_at).toLocaleDateString("de-DE")}
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Delete Action (Hover) */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-1 bottom-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:text-red-400"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(entry.id);
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add new entry */}
            <div className="flex gap-2 flex-none pt-2 border-t border-white/5">
                <Textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Neue Information hinzufügen..."
                    className="min-h-[60px] bg-background flex-1 text-[0.9em] resize-none"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd();
                    }}
                />
                <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={saving || !newContent.trim()}
                    className="self-end h-8 text-[0.9em]"
                >
                    <Save className="w-4 h-4 mr-1" />
                    Speichern
                </Button>
            </div>

            {/* CONTEXT MENU */}
            {contextMenu && (
                <div
                    className="fixed z-[9999] bg-[#0f172a] border border-white/20 rounded-lg shadow-2xl p-2 w-60 animate-in fade-in zoom-in-95 text-[0.85em]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1 mb-1 text-muted-foreground font-semibold">Einstellungen</div>

                    {/* INFO / INSTRUCTION SWITCH */}
                    <div className="space-y-1 mb-2">
                        <div
                            className="px-2 py-1.5 hover:bg-white/10 rounded cursor-pointer flex items-center gap-2"
                            onClick={() => handleUpdate({ type: 'info' })}
                        >
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div> Als Information markieren
                        </div>
                        <div
                            className="px-2 py-1.5 hover:bg-white/10 rounded cursor-pointer flex items-center gap-2"
                            onClick={() => handleUpdate({ type: 'instruction' })}
                        >
                            <div className="w-2 h-2 rounded-full bg-amber-400"></div> Als Anweisung markieren
                        </div>
                    </div>

                    <div className="h-px bg-white/10 my-1"></div>

                    <div className="px-2 py-1 mb-1 text-muted-foreground font-semibold">Automatische Löschung</div>
                    <input
                        type="date"
                        className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-[0.85em] text-white mb-1"
                        onChange={(e) => {
                            if (e.target.valueAsDate) handleUpdateDeleteAt(e.target.value);
                            setContextMenu(null);
                        }}
                    />
                    <div
                        className="px-2 py-1.5 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
                        onClick={() => handleUpdate({ deleteAt: null })}
                    >
                        Auto-Löschung entfernen
                    </div>
                </div>
            )}
        </div>
    );
}
