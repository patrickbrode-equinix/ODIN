
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportDialog } from "./ExportDialog";

interface ExportMenuProps {
    currentYear: number;
    currentMonth: number;
    loading?: boolean;
    /** Pass `true` if the changelog table has data; hides "Änderungen" menu item when false */
    changelogExists?: boolean;
}

export function ExportMenu({ currentYear, currentMonth, loading, changelogExists }: ExportMenuProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [exportType, setExportType] = useState<"SHIFTPLAN" | "CHANGES" | null>(null);

    const openDialog = (type: "SHIFTPLAN" | "CHANGES") => {
        setExportType(type);
        setDialogOpen(true);
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 pl-2 pr-2"
                        disabled={loading}
                        title="Export Menü"
                    >
                        <Download className="w-4 h-4" />
                        <span className="ml-1 hidden xl:inline">Export</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Export Optionen</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => openDialog("SHIFTPLAN")}>
                        Schichtplan (XLSX)
                    </DropdownMenuItem>

                    {changelogExists && (
                        <DropdownMenuItem onClick={() => openDialog("CHANGES")}>
                            Änderungen (Change Log)
                        </DropdownMenuItem>
                    )}

                    {!changelogExists && (
                        <DropdownMenuItem disabled className="opacity-40 cursor-not-allowed" title="Noch keine Änderungen aufgezeichnet">
                            Änderungen (Change Log)
                        </DropdownMenuItem>
                    )}

                </DropdownMenuContent>
            </DropdownMenu>

            {exportType && (
                <ExportDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    type={exportType}
                    currentYear={currentYear}
                    currentMonth={currentMonth}
                />
            )}
        </>
    );
}
