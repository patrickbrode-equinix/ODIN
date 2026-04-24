/* ------------------------------------------------ */
/* TV POLLS SLIDE – Active Umfragen                 */
/* Professional display of active polls on TV       */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { BarChart3, Clock, Users, Vote } from "lucide-react";
import { api } from "../../api/api";

/* ─────────────── Types ─────────────── */

type TvPollOption = {
  option_index: number;
  count: number;
};

type TvPoll = {
  id: number;
  title: string;
  description: string;
  options: string[];
  ends_at: string | null;
  closed: boolean;
  vote_count: number;
  votes: TvPollOption[];
};

/* ─────────────── Helpers ─────────────── */

function formatDeadline(endsAt: string) {
  const d = new Date(endsAt);
  return d.toLocaleDateString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRemainingLabel(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

/* Bar colors – cycle through palette */
const BAR_COLORS = [
  { bar: "bg-[#00d8ff]", shadow: "shadow-[0_0_12px_rgba(0,216,255,0.4)]", text: "text-[#00d8ff]" },
  { bar: "bg-emerald-400", shadow: "shadow-[0_0_12px_rgba(52,211,153,0.4)]", text: "text-emerald-400" },
  { bar: "bg-amber-400", shadow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]", text: "text-amber-400" },
  { bar: "bg-violet-400", shadow: "shadow-[0_0_12px_rgba(167,139,250,0.4)]", text: "text-violet-400" },
  { bar: "bg-rose-400", shadow: "shadow-[0_0_12px_rgba(251,113,133,0.4)]", text: "text-rose-400" },
  { bar: "bg-indigo-400", shadow: "shadow-[0_0_12px_rgba(129,140,248,0.4)]", text: "text-indigo-400" },
];

/* ─────────────── Single Poll Card ─────────────── */

function TvPollCard({ poll, index }: { poll: TvPoll; index: number }) {
  const options: string[] =
    typeof poll.options === "string" ? JSON.parse(poll.options) : poll.options;
  const totalVotes = poll.votes.reduce((s, v) => s + v.count, 0);
  const remaining = poll.ends_at ? getRemainingLabel(poll.ends_at) : null;

  // Find max vote count for winner highlight
  const maxCount = Math.max(...poll.votes.map((v) => v.count), 0);

  return (
    <div className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-[#0a1628]/80 via-[#0f1d36]/60 to-[#0a1628]/80 p-5 flex flex-col gap-4 backdrop-blur-sm">
      {/* Title & Meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-slate-100 leading-tight truncate">
            {poll.title}
          </h3>
          {poll.description && (
            <p className="mt-1 text-sm text-slate-400 leading-relaxed line-clamp-2">
              {poll.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Users className="h-3.5 w-3.5" />
            <span className="font-semibold text-slate-200">{totalVotes}</span>
          </div>
          {remaining && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400/80">
              <Clock className="h-3 w-3" />
              {remaining}
            </div>
          )}
        </div>
      </div>

      {/* Options with bars */}
      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const voteData = poll.votes.find((v) => v.option_index === i);
          const count = voteData?.count || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isWinner = count > 0 && count === maxCount;
          const colorIdx = (index * 3 + i) % BAR_COLORS.length;
          const color = BAR_COLORS[colorIdx];

          return (
            <div key={i} className="group">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span
                  className={`text-sm font-medium truncate ${
                    isWinner ? "text-slate-100" : "text-slate-300"
                  }`}
                >
                  {opt}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-500">{count}</span>
                  <span
                    className={`text-sm font-bold w-12 text-right ${
                      isWinner ? color.text : "text-slate-500"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${color.bar} ${
                    isWinner ? color.shadow : ""
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {poll.ends_at && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600 pt-1 border-t border-white/5">
          <Clock className="h-3 w-3" />
          Abstimmung endet: {formatDeadline(poll.ends_at)}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Main Slide ─────────────── */

export function TVPollsSlide() {
  const [polls, setPolls] = useState<TvPoll[]>([]);

  useEffect(() => {
    const load = () =>
      api
        .get("/tv/polls")
        .then((res) => setPolls(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (polls.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600">
        <Vote className="w-16 h-16 opacity-20" />
        <span className="text-2xl font-semibold">Keine aktiven Umfragen</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div
        className={`grid gap-4 max-w-full ${
          polls.length === 1
            ? "grid-cols-1 max-w-3xl mx-auto"
            : polls.length === 2
              ? "grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {polls.map((poll, i) => (
          <TvPollCard key={poll.id} poll={poll} index={i} />
        ))}
      </div>
    </div>
  );
}
