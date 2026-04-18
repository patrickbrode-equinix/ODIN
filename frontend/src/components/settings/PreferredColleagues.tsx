/* ------------------------------------------------ */
/* PREFERRED COLLEAGUES – Wunschkollegen-Auswahl    */
/* ------------------------------------------------ */

import { useEffect, useState, useMemo } from "react";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Save, Users, Search, Info } from "lucide-react";
import { api } from "../../api/api";
import { useLanguage, getLanguageLocale } from "../../context/LanguageContext";
import { formatAbsoluteDateTime, formatRelativeTime } from "../../utils/loginStatus";
import {
  getPreferredColleagues,
  updatePreferredColleagues,
  getEligibleColleagues,
  type EligibleColleague,
} from "../../api/userPreferences";
import { dispatchColleagueSelections, listenColleagueSelections } from "../../utils/colleaguePreferenceSync";

const MAX_SELECTION = 3;

const COPY = {
  de: {
    conflictResolved: "Konflikt bereinigt: Ausschlusskollegen wurden aus den Wunschkollegen entfernt.",
    saved: "Gespeichert",
    saveFailed: "Fehler beim Speichern",
    loading: "Lade Kollegenliste…",
    title: "Teampräferenzen – Wunschkollegen",
    hint: "Wunschkollegen werden nach Möglichkeit bei der Schichteinteilung berücksichtigt. Eine Garantie besteht nicht – harte Regeln, Fairness und Besetzungsanforderungen haben immer Vorrang.",
    searchPlaceholder: "Mitarbeiter suchen…",
    selected: "ausgewählt",
    noSearchResults: "Keine Treffer",
    noColleagues: "Keine Kollegen verfügbar",
    neverLoggedIn: "Noch nie eingeloggt",
    blockedByAvoid: "Bereits in „Nicht mit diesen Kollegen arbeiten“ ausgewählt",
  },
  en: {
    conflictResolved: "Conflict resolved: excluded colleagues were removed from preferred colleagues.",
    saved: "Saved",
    saveFailed: "Failed to save",
    loading: "Loading colleague list...",
    title: "Team preferences – preferred colleagues",
    hint: "Preferred colleagues are considered during shift planning whenever possible. This is not guaranteed: hard rules, fairness, and staffing requirements always take priority.",
    searchPlaceholder: "Search employees...",
    selected: "selected",
    noSearchResults: "No matches",
    noColleagues: "No colleagues available",
    neverLoggedIn: "Never logged in",
    blockedByAvoid: "Already selected in 'Do not work with these colleagues'",
  },
  ro: {
    conflictResolved: "Conflict rezolvat: colegii excluși au fost eliminați din colegii preferați.",
    saved: "Salvat",
    saveFailed: "Salvarea a eșuat",
    loading: "Se încarcă lista colegilor...",
    title: "Preferințe de echipă – colegi preferați",
    hint: "Colegii preferați sunt luați în considerare la planificarea turelor atunci când este posibil. Nu este o garanție: regulile stricte, echitatea și necesarul de personal au întotdeauna prioritate.",
    searchPlaceholder: "Caută angajați...",
    selected: "selectați",
    noSearchResults: "Niciun rezultat",
    noColleagues: "Nu există colegi disponibili",
    neverLoggedIn: "Nu s-a autentificat niciodată",
    blockedByAvoid: "Deja selectat la 'Nu lucra cu acești colegi'",
  },
  ar: {
    conflictResolved: "تمت معالجة التعارض: تمت إزالة الزملاء المستبعدين من الزملاء المفضلين.",
    saved: "تم الحفظ",
    saveFailed: "تعذر الحفظ",
    loading: "جار تحميل قائمة الزملاء...",
    title: "تفضيلات الفريق - الزملاء المفضلون",
    hint: "تؤخذ الزملاء المفضلون في الاعتبار عند تخطيط الورديات قدر الإمكان. هذا ليس مضمونًا: القواعد الصارمة والعدالة ومتطلبات التغطية لها الأولوية دائمًا.",
    searchPlaceholder: "ابحث عن الموظفين...",
    selected: "محدد",
    noSearchResults: "لا توجد نتائج",
    noColleagues: "لا يوجد زملاء متاحون",
    neverLoggedIn: "لم يسجل الدخول من قبل",
    blockedByAvoid: "محدد بالفعل ضمن 'لا تعمل مع هؤلاء الزملاء'",
  },
} as const;

function normalizeNameList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function isSameList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export default function PreferredColleagues() {
  const { language } = useLanguage();
  const locale = getLanguageLocale(language);
  const copy = COPY[language as keyof typeof COPY] || COPY.en;
  const [eligible, setEligible] = useState<EligibleColleague[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [initial, setInitial] = useState<string[]>([]);
  const [avoidColleagues, setAvoidColleagues] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  /* LOAD */
  useEffect(() => {
    async function load() {
      try {
        const [elig, prefs, employeePrefs] = await Promise.all([
          getEligibleColleagues(),
          getPreferredColleagues(),
          api.get("/shift-config/employee-preferences").catch(() => ({ data: { preferences: null } })),
        ]);
        setEligible(elig);
        const normalizedSelected = normalizeNameList(prefs);
        setSelected(normalizedSelected);
        setInitial(normalizedSelected);
        setAvoidColleagues(normalizeNameList(employeePrefs.data?.preferences?.avoid_colleagues || []));
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
    return eligible.filter((entry) => entry.name.toLowerCase().includes(q));
  }, [eligible, search]);

  useEffect(() => {
    return listenColleagueSelections(({ avoid }) => {
      const normalizedAvoid = normalizeNameList(avoid);
      setAvoidColleagues((current) => isSameList(current, normalizedAvoid) ? current : normalizedAvoid);
      setSelected((current) => {
        const nextSelected = current.filter((name) => !normalizedAvoid.includes(name));
        if (nextSelected.length === current.length) return current;
        setMsg({ ok: false, text: copy.conflictResolved });
        return nextSelected;
      });
    });
  }, [copy.conflictResolved]);

  useEffect(() => {
    dispatchColleagueSelections({ preferred: selected, avoid: avoidColleagues });
  }, [selected, avoidColleagues]);

  /* TOGGLE */
  function toggle(name: string) {
    setSelected((prev) => {
      if (avoidColleagues.includes(name)) return prev;
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= MAX_SELECTION) return prev; // limit
      return [...prev, name];
    });
  }

  /* SAVE */
  async function save() {
    const overlap = selected.filter((name) => avoidColleagues.includes(name));
    if (overlap.length > 0) {
      setMsg({ ok: false, text: `Konflikt mit Ausschlussliste: ${overlap.join(", ")}` });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const result = await updatePreferredColleagues(selected);
      setSelected(result);
      setInitial(result);
      setMsg({ ok: true, text: copy.saved });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error ?? copy.saveFailed;
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
        {copy.loading}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* SECTION HEADER */}
      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
        <Users className="w-4 h-4" />
        {copy.title}
      </div>

      {/* INFO HINT */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
        <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {copy.hint}
        </p>
      </div>

      {/* SEARCH */}
      {eligible.length > 8 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className="pl-9 h-8 text-sm rounded-lg"
          />
        </div>
      )}

      {/* COUNTER */}
      <p className="text-[11px] text-muted-foreground">
        {selected.length} / {MAX_SELECTION} {copy.selected}
      </p>

      {/* LIST */}
      <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            {search ? copy.noSearchResults : copy.noColleagues}
          </p>
        )}
        {filtered.map((name) => {
          const checked = selected.includes(name.name);
          const blockedByAvoid = avoidColleagues.includes(name.name);
          const disabled = blockedByAvoid || (!checked && selected.length >= MAX_SELECTION);
          const absoluteLastLogin = formatAbsoluteDateTime(name.lastLogin, locale);
          const relativeLastLogin = formatRelativeTime(name.lastLogin, locale);
          return (
            <label
              key={name.name}
              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors
                ${checked ? "bg-indigo-500/15 border border-indigo-400/30" : "bg-accent/30 border border-transparent hover:bg-accent/60"}
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => toggle(name.name)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${name.hasLoggedIn ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" : "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.45)]"}`} />
                  <Label className="cursor-pointer text-sm font-medium text-foreground/90">
                    {name.name}
                  </Label>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {name.hasLoggedIn
                    ? `${absoluteLastLogin || name.lastLogin} • ${relativeLastLogin || "-"}`
                    : copy.neverLoggedIn}
                </div>
                {blockedByAvoid && (
                  <div className="text-[11px] text-muted-foreground">
                    {copy.blockedByAvoid}
                  </div>
                )}
              </div>
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
