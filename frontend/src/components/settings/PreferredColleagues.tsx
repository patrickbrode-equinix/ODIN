/* ------------------------------------------------ */
/* PREFERRED COLLEAGUES – Wunschkollegen-Auswahl    */
/* ------------------------------------------------ */

import { useEffect, useState, useMemo } from "react";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Save, Users, Search, Info } from "lucide-react";
import {
  getPreferredColleagues,
  updatePreferredColleagues,
  getEligibleColleagues,
} from "../../api/userPreferences";

const MAX_SELECTION = 3;

export default function PreferredColleagues() {
  const [eligible, setEligible] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  /* LOAD */
  useEffect(() => {
    async function load() {
      try {
        const [elig, prefs] = await Promise.all([
          getEligibleColleagues(),
          getPreferredColleagues(),
        ]);
        setEligible(elig);
        setSelected(prefs);
        setInitial(prefs);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* FILTER */
  const filtered = useMemo(() => {
    if (!search.trim()) return eligible;
    const q = search.toLowerCase();
    return eligible.filter((n) => n.toLowerCase().includes(q));
  }, [eligible, search]);

  /* TOGGLE */
  function toggle(name: string) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_SELECTION) return prev; // limit
      return [...prev, name];
    });
  }

  /* SAVE */
  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const result = await updatePreferredColleagues(selected);
      setSelected(result);
      setInitial(result);
      setMsg({ ok: true, text: "Gespeichert" });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error ?? "Fehler beim Speichern";
      setMsg({ ok: false, text: errMsg });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  const dirty =
    JSON.stringify([...selected].sort()) !==
    JSON.stringify([...initial].sort());

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm py-4">
        Lade Kollegenliste…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* SECTION HEADER */}
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
        <Users className="w-4 h-4" />
        Teampräferenzen – Wunschkollegen
      </div>

      {/* INFO HINT */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
        <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Wunschkollegen werden nach Möglichkeit bei der Schichteinteilung
          berücksichtigt. Eine Garantie besteht nicht – harte Regeln,
          Fairness und Besetzungsanforderungen haben immer Vorrang.
        </p>
      </div>

      {/* SEARCH */}
      {eligible.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mitarbeiter suchen…"
            className="pl-9 h-8 text-sm rounded-lg"
          />
        </div>
      )}

      {/* COUNTER */}
      <p className="text-[11px] text-muted-foreground">
        {selected.length} / {MAX_SELECTION} ausgewählt
      </p>

      {/* LIST */}
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            {search ? "Keine Treffer" : "Keine Kollegen verfügbar"}
          </p>
        )}
        {filtered.map((name) => {
          const checked = selected.includes(name);
          const disabled = !checked && selected.length >= MAX_SELECTION;
          return (
            <label
              key={name}
              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                ${checked ? "bg-indigo-500/15 border border-indigo-400/30" : "bg-accent/30 border border-transparent hover:bg-accent/60"}
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => toggle(name)}
              />
              <Label className="cursor-pointer text-sm font-medium text-foreground/90">
                {name}
              </Label>
            </label>
          );
        })}
      </div>

      {/* SAVE */}
      <div className="flex items-center justify-end gap-3 pt-1">
        {msg && (
          <span
            className={`text-xs font-semibold ${msg.ok ? "text-green-400" : "text-red-400"}`}
          >
            {msg.text}
          </span>
        )}
        <Button
          onClick={save}
          disabled={saving || !dirty}
          className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-indigo-600/80 hover:bg-indigo-600 text-white border border-indigo-400/30 shadow-sm disabled:opacity-40"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}
