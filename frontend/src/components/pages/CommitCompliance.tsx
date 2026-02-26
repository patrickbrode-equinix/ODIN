/* ------------------------------------------------ */
/* COMMIT COMPLIANCE – PDF UPLOAD PAGE              */
/* ------------------------------------------------ */

import { useState, useRef } from "react";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";
import { api } from "../../api/api";
import { Button } from "../ui/button";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";

export default function CommitCompliance() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
    const [error, setError] = useState("");

    const handleUpload = async () => {
        const file = fileRef.current?.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            setError("Nur PDF-Dateien erlaubt.");
            return;
        }

        setError("");
        setUploading(true);

        try {
            const form = new FormData();
            form.append("file", file);

            const res = await api.post("/commit-compliance/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setUploadedFiles((prev) => [...prev, res.data.filename ?? file.name]);
            if (fileRef.current) fileRef.current.value = "";
        } catch (err: any) {
            setError(err?.response?.data?.error ?? "Upload fehlgeschlagen.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <EnterprisePageShell>
            <EnterpriseHeader
                title="COMMIT COMPLIANCE"
                subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">PDF-Dateien hochladen für Analyse</span>}
                icon={<Upload className="w-5 h-5 text-indigo-400" />}
            />

            <EnterpriseCard noPadding={false} className="max-w-2xl flex flex-col gap-4">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2">
                    PDF Upload
                </div>
                <div className="flex items-center gap-3">
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600/20 file:text-indigo-400 file:font-semibold hover:file:bg-indigo-600/30 file:cursor-pointer"
                    />
                    <Button onClick={handleUpload} disabled={uploading} className="bg-indigo-600 text-white hover:bg-indigo-500 font-bold uppercase tracking-wider text-[11px]">
                        {uploading ? "Wird hochgeladen…" : "Hochladen"}
                    </Button>
                </div>

                {error && (
                    <div className="text-sm text-red-400 flex items-center gap-2 mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded-lg">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}
            </EnterpriseCard>

            {uploadedFiles.length > 0 && (
                <EnterpriseCard noPadding={false} className="max-w-2xl flex flex-col gap-4 mt-4">
                    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2">
                        Hochgeladene Dateien
                    </div>
                    <div className="space-y-2">
                        {uploadedFiles.map((name, i) => (
                            <div key={i} className="flex items-center gap-2 text-[13px] text-[#4b5563]">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <FileText className="w-4 h-4" />
                                <span className="text-white">{name}</span>
                            </div>
                        ))}
                    </div>
                </EnterpriseCard>
            )}
        </EnterprisePageShell>
    );
}
