/* ------------------------------------------------ */
/* TEAMS BENACHRICHTIGUNGEN – PLACEHOLDER            */
/* ------------------------------------------------ */
import { Bell } from "lucide-react";

export default function TeamsBenachrichtigungenPage() {
    return (
        <div className="flex flex-col items-center justify-center h-[70vh] gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Bell className="w-8 h-8 text-blue-400/60" />
            </div>
            <h1 className="text-2xl font-bold">Teams Benachrichtigungen</h1>
            <p className="text-muted-foreground max-w-sm">
                Automatische Benachrichtigungen via Teams werden hier konfiguriert.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-medium">
                Coming Soon
            </div>
        </div>
    );
}
