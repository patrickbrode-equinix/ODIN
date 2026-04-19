/* ------------------------------------------------ */
/* POLLS PANEL – Umfragen for Infos Modal           */
/* ------------------------------------------------ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, CalendarClock, Check, ChevronDown, ChevronUp,
  Clock, Loader2, Plus, Trash2, Vote, X,
} from "lucide-react";
import { api } from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type LanguageCode } from "../context/LanguageContext";

/* ─────────────── i18n ─────────────── */

const COPY: Record<LanguageCode, Record<string, string>> = {
  de: {
    title: "Umfragen",
    newPoll: "Neue Umfrage",
    pollTitle: "Titel",
    pollTitlePlaceholder: "Worum geht es?",
    description: "Beschreibung",
    descriptionPlaceholder: "Erkläre den Kontext oder Hintergrund der Umfrage…",
    options: "Antwortmöglichkeiten",
    optionPlaceholder: "Option",
    addOption: "Option hinzufügen",
    endsAt: "Abstimmung endet am",
    optional: "optional",
    create: "Erstellen",
    cancel: "Abbrechen",
    creating: "Erstelle…",
    noPolls: "Noch keine Umfragen vorhanden.",
    votes: "Stimmen",
    vote: "Stimme",
    yourVote: "Deine Stimme",
    changeVote: "Stimme ändern",
    votingClosed: "Abstimmung beendet",
    closePoll: "Abstimmung schließen",
    reopenPoll: "Abstimmung öffnen",
    deletePoll: "Umfrage löschen",
    deleteConfirm: "Diese Umfrage und alle Stimmen unwiderruflich löschen?",
    by: "von",
    endsOn: "Endet am",
    ended: "Beendet am",
    noDeadline: "Kein Enddatum",
    total: "Gesamt",
    minOptions: "Mindestens 2 Optionen",
    titleRequired: "Titel ist erforderlich",
    remainingTime: "verbleibend",
    days: "Tage",
    hours: "Std.",
    expired: "abgelaufen",
  },
  en: {
    title: "Polls",
    newPoll: "New Poll",
    pollTitle: "Title",
    pollTitlePlaceholder: "What is this about?",
    description: "Description",
    descriptionPlaceholder: "Explain the context or background of this poll…",
    options: "Answer options",
    optionPlaceholder: "Option",
    addOption: "Add option",
    endsAt: "Voting ends on",
    optional: "optional",
    create: "Create",
    cancel: "Cancel",
    creating: "Creating…",
    noPolls: "No polls yet.",
    votes: "votes",
    vote: "vote",
    yourVote: "Your vote",
    changeVote: "Change vote",
    votingClosed: "Voting closed",
    closePoll: "Close voting",
    reopenPoll: "Reopen voting",
    deletePoll: "Delete poll",
    deleteConfirm: "Permanently delete this poll and all votes?",
    by: "by",
    endsOn: "Ends on",
    ended: "Ended on",
    noDeadline: "No deadline",
    total: "Total",
    minOptions: "At least 2 options required",
    titleRequired: "Title is required",
    remainingTime: "remaining",
    days: "days",
    hours: "hrs",
    expired: "expired",
  },
};

/* ─────────────── Types ─────────────── */

type Poll = {
  id: number;
  title: string;
  description: string;
  options: string[];
  ends_at: string | null;
  closed: boolean;
  created_at: string;
  created_by: number;
  creator_name: string;
  creator_email: string;
  vote_count: number;
};

type PollDetail = Poll & {
  votes: { option_index: number; count: number; voters: { userId: number; name: string; email: string }[] }[];
  myVote: number | null;
};

/* ─────────────── Helpers ─────────────── */

function isPollExpired(poll: Poll | PollDetail) {
  if (poll.closed) return true;
  if (poll.ends_at && new Date(poll.ends_at) < new Date()) return true;
  return false;
}

function canManage(poll: Poll | PollDetail, user: { id: number; email: string } | null) {
  if (!user) return false;
  return poll.created_by === user.id || user.email === "admin@local";
}

function formatDeadline(endsAt: string, lang: LanguageCode) {
  const d = new Date(endsAt);
  return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function getRemainingLabel(endsAt: string, c: Record<string, string>) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return c.expired;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days} ${c.days} ${c.remainingTime}`;
  return `${hours} ${c.hours} ${c.remainingTime}`;
}

/* ─────────────── Create Poll Form ─────────────── */

function CreatePollForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { language } = useLanguage();
  const c = COPY[language];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setError("");
    if (!title.trim()) { setError(c.titleRequired); return; }
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) { setError(c.minOptions); return; }
    setSaving(true);
    try {
      await api.post("/polls", {
        title: title.trim(),
        description: description.trim(),
        options: cleanOptions,
        ends_at: endsAt || null,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
        <Plus className="h-4 w-4 text-emerald-400" /> {c.newPoll}
      </h3>

      {/* Title */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.pollTitle}</label>
        <input
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
          placeholder={c.pollTitlePlaceholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.description}</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 min-h-[80px] resize-y"
          placeholder={c.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Options */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{c.options}</label>
        <div className="mt-1 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none"
                placeholder={`${c.optionPlaceholder} ${i + 1}`}
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
                maxLength={200}
              />
              {options.length > 2 && (
                <button
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  className="p-2 text-slate-500 hover:text-red-400 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            onClick={() => setOptions([...options, ""])}
            className="mt-2 text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            + {c.addOption}
          </button>
        )}
      </div>

      {/* End date */}
      <div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {c.endsAt} <span className="text-slate-600 normal-case">({c.optional})</span>
        </label>
        <input
          type="datetime-local"
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30 [color-scheme:dark]"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 transition"
        >
          {c.cancel}
        </button>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 transition flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {saving ? c.creating : c.create}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Poll Card ─────────────── */

function PollCard({ poll, onUpdate }: { poll: Poll; onUpdate: () => void }) {
  const { language } = useLanguage();
  const c = COPY[language];
  const { user } = useAuth();
  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const expired = isPollExpired(poll);
  const manage = canManage(poll, user);

  const loadDetail = useCallback(async () => {
    try {
      const { data } = await api.get(`/polls/${poll.id}`);
      setDetail(data);
    } catch { /* ignore */ }
  }, [poll.id]);

  useEffect(() => {
    if (expanded) loadDetail();
  }, [expanded, loadDetail]);

  const castVote = async (optionIndex: number) => {
    setVoting(true);
    try {
      await api.post(`/polls/${poll.id}/vote`, { option_index: optionIndex });
      await loadDetail();
      onUpdate();
    } catch { /* ignore */ }
    setVoting(false);
  };

  const toggleClosed = async () => {
    try {
      await api.patch(`/polls/${poll.id}`, { closed: !poll.closed });
      onUpdate();
    } catch { /* ignore */ }
  };

  const deletePoll = async () => {
    try {
      await api.delete(`/polls/${poll.id}`);
      onUpdate();
    } catch { /* ignore */ }
  };

  const options: string[] = typeof poll.options === "string" ? JSON.parse(poll.options) : poll.options;
  const totalVotes = detail ? detail.votes.reduce((s, v) => s + v.count, 0) : poll.vote_count;

  return (
    <div className={`rounded-xl border transition-all ${expired ? "border-white/5 bg-white/[0.01]" : "border-white/10 bg-white/[0.03] hover:border-[#00d8ff]/20"}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full text-left px-4 py-3"
      >
        <Vote className={`h-4 w-4 mt-0.5 shrink-0 ${expired ? "text-slate-600" : "text-emerald-400"}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-100 leading-snug">{poll.title}</div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
            <span>{c.by} {poll.creator_name}</span>
            <span className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              {totalVotes} {totalVotes === 1 ? c.vote : c.votes}
            </span>
            {poll.ends_at && (
              <span className={`flex items-center gap-1 ${expired ? "text-red-400/70" : "text-amber-400/70"}`}>
                <Clock className="h-3 w-3" />
                {expired
                  ? `${c.ended} ${formatDeadline(poll.ends_at, language)}`
                  : getRemainingLabel(poll.ends_at, c)
                }
              </span>
            )}
            {poll.closed && (
              <span className="text-red-400/70 font-semibold">{c.votingClosed}</span>
            )}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-500 mt-1" /> : <ChevronDown className="h-4 w-4 text-slate-500 mt-1" />}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
          {/* Description */}
          {poll.description && (
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{poll.description}</p>
          )}

          {/* Deadline info */}
          {poll.ends_at && !poll.closed && !expired && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 bg-amber-500/5 rounded-lg px-3 py-1.5 border border-amber-500/10">
              <CalendarClock className="h-3 w-3" />
              {c.endsOn} {formatDeadline(poll.ends_at, language)}
            </div>
          )}

          {/* Options / Voting */}
          {detail ? (
            <div className="space-y-1.5">
              {options.map((opt, i) => {
                const voteData = detail.votes.find(v => v.option_index === i);
                const count = voteData?.count || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = detail.myVote === i;
                const canVote = !expired && !voting;

                return (
                  <button
                    key={i}
                    disabled={!canVote}
                    onClick={() => canVote && castVote(i)}
                    className={`relative w-full text-left rounded-lg border px-3 py-2 text-sm transition-all overflow-hidden ${
                      isMyVote
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : canVote
                          ? "border-white/8 bg-white/[0.02] hover:border-sky-500/30 hover:bg-sky-500/5 cursor-pointer"
                          : "border-white/5 bg-white/[0.01]"
                    }`}
                  >
                    {/* Progress bar */}
                    <div
                      className={`absolute inset-y-0 left-0 transition-all ${isMyVote ? "bg-emerald-500/15" : "bg-white/[0.03]"}`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isMyVote && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                        <span className={`truncate ${isMyVote ? "text-emerald-200 font-medium" : "text-slate-200"}`}>{opt}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs">
                        <span className="text-slate-400">{count}</span>
                        <span className={`font-semibold w-10 text-right ${isMyVote ? "text-emerald-400" : "text-slate-500"}`}>{pct}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              <div className="text-[11px] text-slate-600 text-right">
                {c.total}: {totalVotes} {totalVotes === 1 ? c.vote : c.votes}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {/* Admin actions */}
          {manage && (
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button
                onClick={toggleClosed}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition px-2 py-1 rounded border border-white/5 hover:border-white/10"
              >
                {poll.closed ? c.reopenPoll : c.closePoll}
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[11px] text-red-400/70 hover:text-red-400 transition px-2 py-1 rounded border border-red-500/10 hover:border-red-500/30 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> {c.deletePoll}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-red-400">{c.deleteConfirm}</span>
                  <button
                    onClick={deletePoll}
                    className="text-[10px] text-red-400 font-bold hover:text-red-300 px-2 py-0.5 rounded border border-red-500/30"
                  >
                    {c.deletePoll}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    {c.cancel}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Panel ─────────────── */

export function PollsPanel() {
  const { language } = useLanguage();
  const c = COPY[language];
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/polls");
      setPolls(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePolls = useMemo(() => polls.filter(p => !isPollExpired(p)), [polls]);
  const pastPolls = useMemo(() => polls.filter(p => isPollExpired(p)), [polls]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Vote className="h-5 w-5 text-emerald-400" />
          {c.title}
        </h2>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 transition"
          >
            <Plus className="h-3 w-3" />
            {c.newPoll}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <CreatePollForm
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {/* Active polls */}
      {!loading && activePolls.length > 0 && (
        <div className="space-y-2">
          {activePolls.map(p => (
            <PollCard key={p.id} poll={p} onUpdate={load} />
          ))}
        </div>
      )}

      {/* Past polls */}
      {!loading && pastPolls.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-[11px] uppercase tracking-[0.15em] text-slate-600 font-semibold">
            {c.votingClosed}
          </div>
          {pastPolls.map(p => (
            <PollCard key={p.id} poll={p} onUpdate={load} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && polls.length === 0 && !showCreate && (
        <div className="text-sm text-slate-500 text-center py-12">
          {c.noPolls}
        </div>
      )}
    </div>
  );
}
