/* ------------------------------------------------ */
/* ODIN EXCLUSIONS – Manual exclusion list          */
/* System names blocked from auto-assignment        */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, ShieldBan } from "lucide-react";
import { fetchExclusions, addExclusion, deleteExclusion, type ManualExclusion } from "../../api/engine";

export default function OdinExclusions() {
  const [exclusions, setExclusions] = useState<ManualExclusion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSystemName, setNewSystemName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchExclusions()
      .then(setExclusions)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newSystemName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addExclusion(newSystemName.trim(), newReason.trim() || undefined);
      setNewSystemName("");
      setNewReason("");
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, systemName: string) => {
    if (!confirm(`System Name "${systemName}" von der Ausnahmeliste entfernen?`)) return;
    try {
      await deleteExclusion(id);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <ShieldBan className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="font-semibold text-sm">Manuelle Ausnahmeliste</h3>
          <p className="text-xs text-muted-foreground">Tickets mit diesen System Names werden nicht automatisch zugewiesen, sondern gehen an den Dispatcher zur manuellen Prüfung.</p>
        </div>
      </div>

      {/* ADD FORM */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">System Name</label>
          <input
            type="text"
            value={newSystemName}
            onChange={(e) => setNewSystemName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="z.B. ABC-SYSTEM-01"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-indigo-500/50 focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Grund (optional)</label>
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="z.B. Sonderprozess erforderlich"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:border-indigo-500/50 focus:outline-none"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newSystemName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Plus className="w-4 h-4" />
          Hinzufügen
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2">System Name</th>
              <th className="text-left px-4 py-2">Grund</th>
              <th className="text-left px-4 py-2">Erstellt von</th>
              <th className="text-left px-4 py-2">Erstellt am</th>
              <th className="w-16 px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Laden...</td></tr>
            )}
            {!loading && exclusions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Keine Einträge auf der Ausnahmeliste</td></tr>
            )}
            {exclusions.map((ex) => (
              <tr key={ex.id} className="hover:bg-white/5 transition">
                <td className="px-4 py-2 font-mono font-medium">{ex.system_name}</td>
                <td className="px-4 py-2 text-muted-foreground">{ex.reason || "—"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{ex.created_by}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(ex.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => handleDelete(ex.id, ex.system_name)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition"
                    title="Entfernen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
