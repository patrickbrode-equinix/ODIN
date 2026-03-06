/* ------------------------------------------------------------------ */
/* NEUSTARTER TAB                                                       */
/* Probation-period management for new employees                        */
/* Design: follows existing ODIN dark-glassmorphism style               */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { Plus, UserPlus, ChevronDown, ChevronUp, Star, Pencil, Archive, Trash2, Save, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../context/AuthContext";
import {
  fetchNewStarters,
  createNewStarter,
  updateNewStarter,
  deleteNewStarter,
  saveNewStarterRatings,
  NewStarter,
  NewStarterRatings,
} from "../../api/newStarters";

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                            */
/* ------------------------------------------------------------------ */

const RATING_CATEGORIES: { key: keyof Omit<NewStarterRatings, "average_rating">; label: string }[] = [
  { key: "punctuality",             label: "Pünktlichkeit" },
  { key: "politeness",              label: "Höflichkeit" },
  { key: "team_integration",        label: "Integration im Team" },
  { key: "motivation",              label: "Motivation" },
  { key: "technical_understanding", label: "Technisches Verständnis" },
  { key: "work_quality",            label: "Qualität der Arbeiten" },
  { key: "german_language",         label: "Sprachkenntnisse Deutsch" },
  { key: "english_language",        label: "Sprachkenntnisse Englisch" },
  { key: "workplace_cleanliness",   label: "Sauberkeit Arbeitsplatz" },
  { key: "clothing_cleanliness",    label: "Sauberkeit Kleidung" },
];

type RatingDraft = Record<string, number | null>;

/* ------------------------------------------------------------------ */
/* DATE HELPERS                                                         */
/* ------------------------------------------------------------------ */

/** Format ISO "YYYY-MM-DD" → German "DD.MM.YYYY" */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Today in ISO format */
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** Compute days until a date; negative means it has passed */
function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* AUTOMATIC SUMMARY                                                    */
/* Pure rule-based, no external AI                                      */
/* ------------------------------------------------------------------ */
function generateSummary(starter: NewStarter): string {
  const rated = RATING_CATEGORIES.filter(c => starter[c.key] !== null && starter[c.key] !== undefined);
  if (rated.length === 0) {
    return "Es wurden bisher noch keine Bewertungen hinterlegt. Bitte Bewertungen eingeben, um eine automatische Zusammenfassung zu erhalten.";
  }

  const poor    = rated.filter(c => (starter[c.key] as number) <= 2);
  const medium  = rated.filter(c => (starter[c.key] as number) === 3);
  const good    = rated.filter(c => (starter[c.key] as number) >= 4);

  const parts: string[] = [];

  if (good.length > 0) {
    const labels = good.map(c => c.label).join(", ");
    parts.push(`${starter.first_name} zeigt bereits gute Leistungen in: ${labels}.`);
  }

  if (medium.length > 0) {
    const labels = medium.map(c => c.label).join(", ");
    parts.push(`Ausbaufähig und weiterhin zu begleiten: ${labels}.`);
  }

  if (poor.length > 0) {
    const labels = poor.map(c => c.label).join(", ");
    parts.push(`Klarer Entwicklungsbedarf besteht in: ${labels}. Eine gezielte Unterstützung und Rückmeldung in diesen Bereichen wird empfohlen.`);
  }

  if (poor.length === 0 && medium.length === 0) {
    parts.push("Insgesamt zeigt der Mitarbeiter durchweg gute bis sehr gute Leistungen. Weiter so!");
  }

  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* STAR RATING COMPONENT                                                */
/* ------------------------------------------------------------------ */
interface StarRatingProps {
  value: number | null;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

function StarRating({ value, onChange, readonly = false, size = "md" }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const starSize = size === "sm" ? "text-base" : "text-xl";
  const display  = hovered ?? value ?? 0;

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`
            ${starSize} leading-none transition-all duration-100
            ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110 active:scale-95"}
            ${star <= display
              ? "text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
              : "text-white/20"
            }
          `}
          onMouseEnter={() => !readonly && setHovered(star)}
          onClick={() => !readonly && onChange?.(star)}
          title={readonly ? `${value ?? 0} / 5` : `${star} Stern${star !== 1 ? "e" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STARTER CARD (overview list)                                         */
/* ------------------------------------------------------------------ */
interface StarterCardProps {
  starter:    NewStarter;
  isSelected: boolean;
  onSelect:   () => void;
}

function StarterCard({ starter, isSelected, onSelect }: StarterCardProps) {
  const daysLeft = daysUntil(starter.last_termination_date);
  const daysProb = daysUntil(starter.probation_end_date);

  let urgencyColor = "text-emerald-400";
  let urgencyLabel = "";
  if (daysProb < 0) {
    urgencyColor = "text-muted-foreground";
    urgencyLabel = "Probezeit abgelaufen";
  } else if (daysLeft <= 0) {
    urgencyColor = "text-red-400";
    urgencyLabel = "Kündigungsfrist abgelaufen";
  } else if (daysLeft <= 7) {
    urgencyColor = "text-orange-400";
    urgencyLabel = `Kündigung in ${daysLeft} Tag${daysLeft !== 1 ? "en" : ""}!`;
  } else if (daysLeft <= 21) {
    urgencyColor = "text-yellow-400";
    urgencyLabel = `${daysLeft} Tage bis Kündigungsfrist`;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left rounded-xl border transition-all duration-150 p-3
        ${isSelected
          ? "bg-indigo-600/20 border-indigo-500/60 shadow-[0_0_16px_rgba(99,102,241,0.15)]"
          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm text-white truncate">
            {starter.first_name} {starter.last_name}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Start: {fmtDate(starter.start_date)}
          </div>
          {urgencyLabel && (
            <div className={`text-[11px] font-medium mt-1 ${urgencyColor}`}>
              {urgencyLabel}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {starter.average_rating !== null && starter.average_rating !== undefined ? (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-xs">★</span>
              <span className="text-xs font-semibold text-amber-400">
                {Number(starter.average_rating).toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground">/5</span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">keine Bewertung</span>
          )}
          {starter.status === "archived" && (
            <span className="text-[10px] bg-white/10 text-muted-foreground px-1.5 py-0.5 rounded">
              Archiviert
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 mt-2 text-[11px] text-muted-foreground">
        <div>
          <span className="text-white/40">Probezeit:</span>{" "}
          <span className="text-white/70">{fmtDate(starter.probation_end_date)}</span>
        </div>
        <div>
          <span className="text-white/40">Kündigung bis:</span>{" "}
          <span className={`font-medium ${daysLeft > 0 && daysLeft <= 14 ? urgencyColor : "text-white/70"}`}>
            {fmtDate(starter.last_termination_date)}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* CREATE / EDIT FORM                                                   */
/* ------------------------------------------------------------------ */
interface StarterFormProps {
  initial?:   Partial<NewStarter>;
  onSave:     (data: { first_name: string; last_name: string; start_date: string; comment?: string }) => Promise<void>;
  onCancel:   () => void;
  isSaving:   boolean;
}

function StarterForm({ initial, onSave, onCancel, isSaving }: StarterFormProps) {
  const [firstName,  setFirstName]  = useState(initial?.first_name  ?? "");
  const [lastName,   setLastName]   = useState(initial?.last_name   ?? "");
  const [startDate,  setStartDate]  = useState(initial?.start_date  ?? todayISO());
  const [comment,    setComment]    = useState(initial?.comment      ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !startDate) {
      toast.error("Bitte Vorname, Nachname und Startdatum ausfüllen");
      return;
    }
    await onSave({ first_name: firstName.trim(), last_name: lastName.trim(), start_date: startDate, comment: comment.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
            Vorname *
          </label>
          <Input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Max"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500"
            required
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
            Nachname *
          </label>
          <Input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Mustermann"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500"
            required
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
          Startdatum *
        </label>
        <Input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="bg-white/5 border-white/10 text-white focus:border-indigo-500"
          required
        />
      </div>
      <div>
        <label className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
          Kommentar
        </label>
        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Allgemeiner Kommentar zum Mitarbeiter…"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-indigo-500 min-h-[80px] resize-none"
          rows={3}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white h-8 px-4 text-xs font-bold uppercase tracking-wider"
        >
          {isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Speichern
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 px-3 text-xs text-white/50 hover:text-white"
        >
          <X className="w-3 h-3 mr-1" />
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* DETAIL PANEL                                                         */
/* ------------------------------------------------------------------ */
interface DetailPanelProps {
  starter:   NewStarter;
  canEdit:   boolean;
  onUpdated: (s: NewStarter) => void;
  onDeleted: (id: number) => void;
}

function DetailPanel({ starter, canEdit, onUpdated, onDeleted }: DetailPanelProps) {
  const [editMode,     setEditMode]     = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [ratingsOpen,  setRatingsOpen]  = useState(true);

  // Ratings draft – mirrors DB values + unsaved edits
  const [ratings, setRatings] = useState<RatingDraft>(() => {
    const d: RatingDraft = {};
    for (const c of RATING_CATEGORIES) d[c.key] = starter[c.key] ?? null;
    return d;
  });
  const [ratingsDirty, setRatingsDirty] = useState(false);

  // Keep ratings in sync when starter object changes (e.g. after reload)
  useEffect(() => {
    const d: RatingDraft = {};
    for (const c of RATING_CATEGORIES) d[c.key] = starter[c.key] ?? null;
    setRatings(d);
    setRatingsDirty(false);
  }, [starter.id]);

  const setRating = (key: string, val: number) => {
    setRatings(prev => ({ ...prev, [key]: val }));
    setRatingsDirty(true);
  };

  const avg = (() => {
    const vals = RATING_CATEGORIES.map(c => ratings[c.key]).filter((v): v is number => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  const handleSaveRatings = async () => {
    try {
      setIsSaving(true);
      const saved = await saveNewStarterRatings(starter.id, ratings as any);
      onUpdated({ ...starter, ...saved });
      setRatingsDirty(false);
      toast.success("Bewertungen gespeichert");
    } catch {
      toast.error("Fehler beim Speichern der Bewertungen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateBasic = async (data: { first_name: string; last_name: string; start_date: string; comment?: string }) => {
    try {
      setIsSaving(true);
      const updated = await updateNewStarter(starter.id, data);
      onUpdated({ ...starter, ...updated });
      setEditMode(false);
      toast.success("Mitarbeiterdaten gespeichert");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    const newStatus = starter.status === "active" ? "archived" : "active";
    const label = newStatus === "archived" ? "archiviert" : "reaktiviert";
    try {
      const updated = await updateNewStarter(starter.id, { status: newStatus });
      onUpdated({ ...starter, ...updated });
      toast.success(`Mitarbeiter ${label}`);
    } catch {
      toast.error("Fehler beim Statuswechsel");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Möchten Sie ${starter.first_name} ${starter.last_name} wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`)) return;
    try {
      await deleteNewStarter(starter.id);
      onDeleted(starter.id);
      toast.success("Mitarbeiter gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  const probDays  = daysUntil(starter.probation_end_date);
  const termDays  = daysUntil(starter.last_termination_date);

  const summary = generateSummary({ ...starter, ...ratings as any });

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">

      {/* ── Header: name + actions ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">
            {starter.first_name} {starter.last_name}
          </h2>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {starter.status === "archived"
              ? <span className="text-orange-400">Archiviert</span>
              : <span className="text-emerald-400">Aktiv</span>
            }
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white/50 hover:text-white"
              onClick={() => setEditMode(v => !v)}
              title="Stammdaten bearbeiten"
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white/50 hover:text-amber-400"
              onClick={handleArchiveToggle}
              title={starter.status === "active" ? "Archivieren" : "Reaktivieren"}
            >
              <Archive className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-white/50 hover:text-red-400"
              onClick={handleDelete}
              title="Löschen"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Edit Form (inline) ── */}
      {editMode && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-3">Stammdaten bearbeiten</div>
          <StarterForm
            initial={starter}
            onSave={handleUpdateBasic}
            onCancel={() => setEditMode(false)}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* ── Date Info ── */}
      {!editMode && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Startdatum</div>
              <div className="text-sm font-semibold text-white">{fmtDate(starter.start_date)}</div>
            </div>
            <div className={`border rounded-xl p-3 ${probDays < 0 ? "bg-white/[0.03] border-white/10" : probDays <= 14 ? "bg-orange-500/10 border-orange-500/30" : "bg-white/[0.03] border-white/10"}`}>
              <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Ende Probezeit</div>
              <div className="text-sm font-semibold text-white">{fmtDate(starter.probation_end_date)}</div>
              <div className={`text-[10px] mt-0.5 ${probDays < 0 ? "text-muted-foreground" : probDays <= 14 ? "text-orange-400" : "text-emerald-400"}`}>
                {probDays < 0 ? "abgelaufen" : `in ${probDays} Tagen`}
              </div>
            </div>
            <div className={`border rounded-xl p-3 ${termDays < 0 ? "bg-red-500/10 border-red-500/30" : termDays <= 7 ? "bg-red-500/10 border-red-500/30" : termDays <= 21 ? "bg-orange-500/10 border-orange-500/30" : "bg-white/[0.03] border-white/10"}`}>
              <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-1">Kündigung bis</div>
              <div className={`text-sm font-semibold ${termDays <= 7 ? "text-red-300" : "text-white"}`}>{fmtDate(starter.last_termination_date)}</div>
              <div className={`text-[10px] mt-0.5 ${termDays < 0 ? "text-red-400" : termDays <= 7 ? "text-red-400" : termDays <= 21 ? "text-orange-400" : "text-muted-foreground"}`}>
                {termDays < 0 ? "Frist abgelaufen" : `in ${termDays} Tagen`}
              </div>
            </div>
          </div>

          {/* ── Kommentar ── */}
          {starter.comment && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">Kommentar</div>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{starter.comment}</p>
            </div>
          )}
          {!starter.comment && canEdit && (
            <div className="text-[11px] text-muted-foreground italic">Kein Kommentar hinterlegt. Über „Bearbeiten" kann ein Kommentar ergänzt werden.</div>
          )}
        </>
      )}

      {/* ── Ratings Section ── */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors"
          onClick={() => setRatingsOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Bewertungen</span>
            {avg !== null && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <span>★</span>
                <span className="font-semibold">{avg.toFixed(1)}</span>
                <span className="text-white/40">/5</span>
              </span>
            )}
          </div>
          {ratingsOpen
            ? <ChevronUp className="w-3.5 h-3.5 text-white/40" />
            : <ChevronDown className="w-3.5 h-3.5 text-white/40" />
          }
        </button>

        {ratingsOpen && (
          <div className="border-t border-white/10 px-3 py-3">
            <div className="space-y-2.5">
              {RATING_CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/70 min-w-0 truncate" title={cat.label}>
                    {cat.label}
                  </span>
                  <StarRating
                    value={ratings[cat.key] as number | null}
                    onChange={canEdit ? (v) => setRating(cat.key, v) : undefined}
                    readonly={!canEdit}
                    size="md"
                  />
                </div>
              ))}
            </div>

            {/* Average row */}
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Gesamtdurchschnitt</span>
              {avg !== null
                ? (
                  <div className="flex items-center gap-2">
                    <StarRating value={Math.round(avg)} readonly size="sm" />
                    <span className="text-sm font-bold text-amber-400">{avg.toFixed(2)}<span className="text-white/40 font-normal"> / 5</span></span>
                  </div>
                )
                : <span className="text-xs text-muted-foreground italic">Noch keine Bewertung</span>
              }
            </div>

            {canEdit && ratingsDirty && (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveRatings}
                  disabled={isSaving}
                  className="h-7 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white uppercase tracking-wider"
                >
                  {isSaving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                  Bewertungen speichern
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Auto Summary ── */}
      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
        <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">Automatische Zusammenfassung</div>
        <p className="text-sm text-white/70 leading-relaxed">{summary}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN TAB COMPONENT                                                   */
/* ------------------------------------------------------------------ */
export function NewStartersTab() {
  const { canWrite } = useAuth();
  const canEdit = canWrite("shiftplan");

  const [starters,      setStarters]      = useState<NewStarter[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [selectedId,    setSelectedId]    = useState<number | null>(null);
  const [showArchived,  setShowArchived]  = useState(false);
  const [createOpen,    setCreateOpen]    = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchNewStarters();
      setStarters(data);
    } catch {
      toast.error("Fehler beim Laden der Neustarter");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: { first_name: string; last_name: string; start_date: string; comment?: string }) => {
    try {
      setIsSaving(true);
      const created = await createNewStarter(data);
      setStarters(prev => [created, ...prev]);
      setSelectedId(created.id);
      setCreateOpen(false);
      toast.success(`${created.first_name} ${created.last_name} angelegt`);
    } catch {
      toast.error("Fehler beim Anlegen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdated = (updated: NewStarter) => {
    setStarters(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleDeleted = (id: number) => {
    setStarters(prev => prev.filter(s => s.id !== id));
    setSelectedId(null);
  };

  const filtered = starters.filter(s => showArchived ? true : s.status === "active");
  const selectedStarter = starters.find(s => s.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <span className="text-[13px] font-bold text-white uppercase tracking-wider">Neustarter</span>
            <span className="ml-1 text-[11px] text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className={`
              text-[11px] px-2 py-0.5 rounded border transition-colors font-medium uppercase tracking-wide
              ${showArchived
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"}
            `}
          >
            {showArchived ? "Archivierte ausblenden" : "Archivierte anzeigen"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-white/40 hover:text-white"
            onClick={load}
            title="Neu laden"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => { setCreateOpen(v => !v); setSelectedId(null); }}
              className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Neuer Neustarter
            </Button>
          )}
        </div>
      </div>

      {/* ── Create form (inline) ── */}
      {createOpen && (
        <div className="bg-white/[0.03] border border-indigo-500/30 rounded-xl p-4">
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-3">
            Neuen Mitarbeiter anlegen
          </div>
          <StarterForm
            onSave={handleCreate}
            onCancel={() => setCreateOpen(false)}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* ── Main content: list + detail ── */}
      {loading && starters.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Laden…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <UserPlus className="w-10 h-10 text-white/10" />
          <p className="text-sm text-muted-foreground">Noch keine Neustarter</p>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="mt-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              <Plus className="w-3 h-3 mr-1" /> Ersten Neustarter anlegen
            </Button>
          )}
        </div>
      ) : (
        <div className="flex gap-4 min-h-0 flex-1">
          {/* LIST */}
          <div className="w-64 shrink-0 flex flex-col gap-2 overflow-y-auto">
            {filtered.map(s => (
              <StarterCard
                key={s.id}
                starter={s}
                isSelected={s.id === selectedId}
                onSelect={() => {
                  setSelectedId(s.id);
                  setCreateOpen(false);
                }}
              />
            ))}
          </div>

          {/* DETAIL */}
          <div className="flex-1 min-w-0">
            {selectedStarter ? (
              <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 h-full">
                <DetailPanel
                  starter={selectedStarter}
                  canEdit={canEdit}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-20">
                <Star className="w-8 h-8 text-white/10" />
                <p className="text-sm">Mitarbeiter aus der Liste wählen</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
