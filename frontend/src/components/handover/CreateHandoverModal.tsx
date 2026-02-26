import React, { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, Clock, ArrowRight, Shield, User } from "lucide-react";
import { Button } from "../ui/button";
import { HandoverType, HandoverItem } from "./handover.types";
import { createHandover } from "./handover.api";
import { useAuth } from "../../context/AuthContext";
import { Ticket } from "../../api/queue";
import { useHandoverStore } from "../../store/handoverStore";

interface CreateHandoverModalProps {
    ticket: Ticket;
    isOpen: boolean;
    onClose: () => void;
    defaultType?: HandoverType;
}

const TEAMS = [
    "TFM",
    "METAL",
    "ELEC",
    "NOC",
    "SVs",
    "LEADs",
    "REPORT",
    "OTHERS",
];

export function CreateHandoverModal({
    ticket,
    isOpen,
    onClose,
    defaultType = "Workload",
}: CreateHandoverModalProps) {
    const { user } = useAuth();
    const loadHandoversFresh = useHandoverStore(s => s.load);
    const [type, setType] = useState<HandoverType>(defaultType);

    // Form States
    const [description, setDescription] = useState("");
    const [targetTeam, setTargetTeam] = useState(TEAMS[0]);
    const [startDatetime, setStartDatetime] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial State reset
    useEffect(() => {
        if (isOpen) {
            setType(defaultType);
            setDescription("");
            setTargetTeam(TEAMS[0]);

            // Default start time to next hour
            const now = new Date();
            now.setHours(now.getHours() + 1, 0, 0, 0);
            setStartDatetime(now.toISOString().slice(0, 16));
        }
    }, [isOpen, defaultType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Validation based on type
        if (type === "Workload" && !description.trim()) {
            alert("Bitte Kommentar eingeben.");
            setIsSubmitting(false);
            return;
        }
        if (type === "Terminiert" && !startDatetime) {
            alert("Bitte Startzeit eingeben.");
            setIsSubmitting(false);
            return;
        }
        if (type === "Other Teams" && (!targetTeam || !description.trim())) {
            alert("Bitte Team und Kommentar eingeben.");
            setIsSubmitting(false);
            return;
        }

        if (!window.confirm("Handover wirklich erstellen?")) {
            setIsSubmitting(false);
            return;
        }

        try {
            const payload: any = {
                // Ticket Data (Read-Only)
                ticketNumber: ticket.external_id,
                ticketType: ticket.queue_type || "Unknown",
                activity: ticket.activity || ticket.system_name || "",
                systemName: ticket.system_name || "",
                customerName: ticket.account_name || "Unknown",
                priority: "Medium",
                area: ticket.group_key || "",
                commitAt: ticket.revised_commit_date || ticket.commit_date || null,

                // Calculated
                remainingTime: ticket.remaining_time_text || "",

                // Handover Meta
                type: type,
                status: "Offen",
                createdBy: user?.displayName || "Unknown",
                createdAt: new Date().toISOString(),
                takenBy: null,
            };

            // Specific Fields
            if (type === "Workload") {
                payload.description = description;
            } else if (type === "Terminiert") {
                payload.startDatetime = new Date(startDatetime).toISOString();
                payload.description = `Start geplant: ${new Date(startDatetime).toLocaleString()} – ${description}`;
            } else if (type === "Other Teams") {
                payload.targetTeam = targetTeam;
                payload.description = `[An: ${targetTeam}] ${description}`;
            }

            await createHandover(payload as HandoverItem);
            // Auto-reload store so Handover list updates without page refresh
            loadHandoversFresh({ force: true }).catch(() => { });
            onClose();
        } catch (err) {
            console.error("Failed to create handover", err);
            alert("Failed to create handover. See console.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border rounded-xl shadow-xl z-50 p-0 focus:outline-none overflow-hidden flex flex-col max-h-[90vh]">

                    {/* HEADER */}
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div>
                            <Dialog.Title className="text-lg font-bold flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                {type} Handover
                            </Dialog.Title>
                            <div className="text-xs text-muted-foreground mt-1">
                                Erstellt aus Ticket {ticket.external_id}
                            </div>
                        </div>
                        <Dialog.Close asChild>
                            <button className="text-muted-foreground hover:text-foreground">
                                <X className="w-5 h-5" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* READ-ONLY INFO BLOCK */}
                            <div className="grid grid-cols-2 gap-4 text-sm bg-white/5 p-4 rounded-lg border border-white/10">
                                <div>
                                    <label className="text-xs text-muted-foreground block">Ersteller</label>
                                    <div className="font-medium flex items-center gap-1">
                                        <User className="w-3 h-3" /> {user?.displayName}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block">Erstellt am</label>
                                    <div className="font-medium">
                                        {new Date().toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block">System</label>
                                    <div className="font-medium text-blue-300">
                                        {ticket.system_name || "—"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block">Activity</label>
                                    <div className="font-medium truncate" title={ticket.activity || ""}>
                                        {ticket.activity || "—"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block">Commit Date</label>
                                    <div className="font-medium">
                                        {ticket.commit_date ? new Date(ticket.commit_date).toLocaleString() : "—"}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground block">Restzeit</label>
                                    <div className={`font-bold ${ticket.remaining_hours && ticket.remaining_hours < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {ticket.remaining_time_text || "—"}
                                    </div>
                                </div>
                            </div>

                            {/* TYPE SPECIFIC FIELDS */}
                            <div className="space-y-4">

                                {/* WORKLOAD */}
                                {type === "Workload" && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-primary">Kommentar / Statusbericht <span className="text-red-500">*</span></label>
                                        <textarea
                                            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary"
                                            placeholder="Welche Arbeiten wurden bereits ausgeführt? Was fehlt noch?"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {/* TIME */}
                                {type === "Terminiert" && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-primary flex items-center gap-2">
                                                <Clock className="w-4 h-4" /> Startzeitpunkt <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="datetime-local"
                                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary"
                                                value={startDatetime}
                                                onChange={(e) => setStartDatetime(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Zusätzliche Infos</label>
                                            <textarea
                                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary"
                                                placeholder="Grund für Terminierung..."
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* OTHER TEAMS */}
                                {type === "Other Teams" && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-primary flex items-center gap-2">
                                                <ArrowRight className="w-4 h-4" /> Ziel-Team <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary"
                                                value={targetTeam}
                                                onChange={(e) => setTargetTeam(e.target.value)}
                                            >
                                                {TEAMS.map((t) => (
                                                    <option key={t} value={t}>
                                                        {t}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Info an das Team <span className="text-red-500">*</span></label>
                                            <textarea
                                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus:ring-1 focus:ring-primary"
                                                placeholder="Was muss das andere Team wissen?"
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                            />
                                        </div>
                                    </>
                                )}

                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                                <Button type="button" variant="ghost" onClick={onClose}>
                                    Abbrechen
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]">
                                    {isSubmitting ? "Speichern..." : "Erstellen"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
