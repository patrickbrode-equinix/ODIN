
import { useState } from "react";
import { ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { Card } from "../ui/card";
import { EmployeeStats } from "../../hooks/useShiftStats";

interface Props {
    stats: EmployeeStats[];
}

export function ShiftStatsPanel({ stats }: Props) {
    const [isOpen, setIsOpen] = useState(false);

    if (stats.length === 0) return null;

    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <BarChart3 className="w-4 h-4" />
                Statistik {isOpen ? "(Ausblenden)" : "(Anzeigen)"}
            </button>

            {isOpen && (
                <Card className="mt-2 p-4 bg-card/50 backdrop-blur border-border/50 animate-in fade-in slide-in-from-top-2">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 text-left text-muted-foreground">
                                    <th className="py-2 px-2 font-medium">Mitarbeiter</th>
                                    <th className="py-2 px-2 font-medium text-right">Nachtschichten</th>
                                    <th className="py-2 px-2 font-medium text-right">Wochenendschichten</th>
                                    <th className="py-2 px-2 font-medium">Konflikte</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.map((stat) => (
                                    <tr key={stat.name} className="border-b border-border/10 hover:bg-white/5 transition-colors">
                                        <td className="py-1.5 px-2 font-medium">{stat.name}</td>
                                        <td className={`py-1.5 px-2 text-right ${stat.nightCount > 20 ? "text-red-400" : stat.nightCount > 0 ? "text-blue-400" : "text-muted-foreground"}`}>
                                            {stat.nightCount}
                                        </td>
                                        <td className={`py-1.5 px-2 text-right ${stat.weekendCount > 10 ? "text-red-400" : stat.weekendCount > 0 ? "text-orange-400" : "text-muted-foreground"}`}>
                                            {stat.weekendCount}
                                        </td>
                                        <td className="py-1.5 px-2">
                                            {stat.conflicts && stat.conflicts.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {stat.conflicts.map((c, idx) => (
                                                        <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-200 border border-red-500/30" title={c.message}>
                                                            {c.type === 'night' ? 'N' : c.type === 'weekend' ? 'WE' : 'SEQ'}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/30">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}
