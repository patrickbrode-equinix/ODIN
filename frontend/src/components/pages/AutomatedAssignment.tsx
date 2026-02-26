/* ------------------------------------------------ */
/* AUTOMATED ASSIGNMENT – PLACEHOLDER               */
/* ------------------------------------------------ */
import { Zap } from "lucide-react";

export default function AutomatedAssignmentPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <Zap className="w-8 h-8 text-green-400/60" />
            </div>
            <h1 className="text-2xl font-bold">Automated Assignment</h1>
            <p className="text-muted-foreground max-w-sm">
                Automatische Ticket-Zuweisung basierend auf Regeln und Verfügbarkeit.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-medium">
                Coming Soon
            </div>
        </div>
    );
}
