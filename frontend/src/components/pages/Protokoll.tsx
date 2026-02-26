import { useEffect, useState } from "react";
import { ActivityLogEntry, getActivityLog } from "../../api/activity";
import { formatDate, formatTime } from "../../utils/dateFormat";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Button } from "../ui/button";
import { Loader2, RefreshCw, FileText } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";

export default function Protokoll() {
    const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [moduleFilter, setModuleFilter] = useState<string>("ALL");
    const [limit, setLimit] = useState(50);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params: any = { limit };
            if (moduleFilter !== "ALL") params.module = moduleFilter;

            const data = await getActivityLog(params);
            setLogs(data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [moduleFilter, limit]);

    return (
        <EnterprisePageShell>
            <EnterpriseHeader
                title="PROTOKOLL"
                subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Systemaktivitäten und Änderungen nachvollziehen.</span>}
                icon={<FileText className="w-5 h-5 text-indigo-400" />}
                rightContent={
                    <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm">
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Aktualisieren
                    </Button>
                }
            />

            <div className="flex gap-4 items-center">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Modul filter" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Alle Module</SelectItem>
                        <SelectItem value="SHIFTPLAN">Shiftplan</SelectItem>
                        <SelectItem value="YEAR2027">Jahresplanung</SelectItem>
                        <SelectItem value="DASHBOARD">Dashboard</SelectItem>
                        <SelectItem value="AUTH">Auth</SelectItem>
                        <SelectItem value="SYSTEM">System</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <EnterpriseCard noPadding className="flex-1 overflow-hidden flex flex-col min-h-0 bg-transparent border-0 shadow-none">
                <div className="overflow-auto border rounded-xl bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">Zeitstempel</TableHead>
                                <TableHead className="w-[150px]">Akteur</TableHead>
                                <TableHead className="w-[120px]">Modul</TableHead>
                                <TableHead className="w-[150px]">Aktion</TableHead>
                                <TableHead>Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 && !loading && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        Keine Einträge gefunden.
                                    </TableCell>
                                </TableRow>
                            )}
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs">
                                        {new Date(log.ts).toLocaleDateString()} {new Date(log.ts).toLocaleTimeString()}
                                    </TableCell>
                                    <TableCell>{log.actor || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-xs">{log.module}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-medium text-sm">{log.action_type}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground font-mono">
                                        {JSON.stringify(log.payload || {})}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </EnterpriseCard>

            <div className="text-center text-xs text-muted-foreground">
                Zeigt die letzten {logs.length} Einträge.
            </div>
        </EnterprisePageShell>
    );
}
