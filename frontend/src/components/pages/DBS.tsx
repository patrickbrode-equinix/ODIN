/* ------------------------------------------------ */
/* DBS PAGE – COMING SOON                           */
/* ------------------------------------------------ */
import { Database } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard } from "../layout/EnterpriseLayout";

export default function DBSPage() {
    return (
        <EnterprisePageShell className="flex flex-col items-center justify-center p-8">
            <EnterpriseCard className="flex flex-col items-center justify-center gap-4 text-center max-w-md w-full py-16 mx-auto mt-20">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Database className="w-8 h-8 text-amber-500/80" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white mt-2">DBS Planung</h1>
                <p className="text-[13px] text-[#4b5563] max-w-sm leading-relaxed">
                    Diese Funktion befindet sich derzeit in Entwicklung und wird in einer kommenden Version verfügbar sein.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 mt-4 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-bold tracking-wider uppercase">
                    Coming Soon
                </div>
            </EnterpriseCard>
        </EnterprisePageShell>
    );
}

