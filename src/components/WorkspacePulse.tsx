import { Activity, ArrowUpRight, Check, Clock3, Database, Gauge, Sparkles, Table2, Zap } from "lucide-react";
import { formatCompact, totalRows, type TableDef } from "@/lib/database";
import { QUERY_PRESETS } from "@/lib/presets";
import { cn } from "@/utils/cn";
import { LiveDot, SectionLabel } from "./ui";

export interface RunRecord {
  id: string;
  label: string;
  sql: string;
  rows: number;
  ms: number;
  status: "success" | "error";
  timestamp: string;
}

interface WorkspacePulseProps {
  tables: TableDef[];
  history: RunRecord[];
  lastRows: number;
  savedQueries: number;
  onLoadQuery: (sql: string, label: string) => void;
}

const BAR_COLORS = ["from-cyan-400 to-cyan-500", "from-violet-400 to-violet-500", "from-emerald-400 to-emerald-500", "from-amber-400 to-amber-500"];

export function WorkspacePulse({ tables, history, lastRows, savedQueries, onLoadQuery }: WorkspacePulseProps) {
  const rows = totalRows(tables);
  const totalRuns = Math.max(history.length, 1);
  const successes = history.filter((run) => run.status === "success").length;
  const successRate = history.length ? Math.round((successes / history.length) * 100) : 100;
  const averageMs = history.length
    ? Math.max(0.1, history.reduce((sum, run) => sum + run.ms, 0) / history.length)
    : 0.1;
  const suggestion = QUERY_PRESETS[2];

  return (
    <aside className="scroll-thin hidden w-[274px] shrink-0 overflow-y-auto border-l border-[#172235] bg-[#080d17] xl:block">
      <div className="flex h-[43px] items-center gap-2 border-b border-[#141e2e] px-3.5">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <SectionLabel className="text-slate-400">Query pulse</SectionLabel>
        <span className="ml-auto flex items-center gap-1.5 rounded border border-emerald-500/15 bg-emerald-500/[0.05] px-1.5 py-[2px] font-mono text-[8px] uppercase tracking-wider text-emerald-400">
          <LiveDot />
          live
        </span>
      </div>

      <div className="space-y-2.5 p-2.5">
        <div className="relative overflow-hidden rounded-lg border border-[#1b2b3a] bg-gradient-to-br from-[#0b1723] via-[#0a1420] to-[#08101a] p-3">
          <div className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-500/[0.055] blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3 w-3 text-emerald-400" />
                <span className="text-[10.5px] font-medium text-slate-200">Engine healthy</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-600">All relations indexed in memory</p>
            </div>
            <span className="font-mono text-[9px] text-emerald-400">{successRate}%</span>
          </div>

          <div className="relative mt-2.5 h-10">
            <svg viewBox="0 0 220 40" className="h-full w-full overflow-visible" aria-hidden="true">
              <defs>
                <linearGradient id="pulse-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 28 L18 28 L25 24 L31 28 L48 28 L55 18 L62 32 L69 12 L76 28 L92 28 L101 23 L109 28 L127 28 L135 16 L142 33 L149 10 L157 28 L174 28 L181 24 L190 28 L204 28 L212 20 L220 28 L220 40 L0 40 Z"
                fill="url(#pulse-fill)"
              />
              <path
                d="M0 28 L18 28 L25 24 L31 28 L48 28 L55 18 L62 32 L69 12 L76 28 L92 28 L101 23 L109 28 L127 28 L135 16 L142 33 L149 10 L157 28 L174 28 L181 24 L190 28 L204 28 L212 20 L220 28"
                fill="none"
                stroke="#10b981"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="relative mt-1.5 flex items-center justify-between border-t border-white/[0.04] pt-2 font-mono text-[8.5px] text-slate-600">
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-cyan-500" />
              {averageMs < 1 ? averageMs.toFixed(2) : averageMs.toFixed(1)} ms avg
            </span>
            <span>0 network calls</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Runs", value: formatCompact(history.length), sub: "this session", icon: Activity, color: "text-cyan-400" },
            { label: "Returned", value: formatCompact(lastRows), sub: "current result", icon: Table2, color: "text-emerald-400" },
            { label: "Indexed", value: formatCompact(rows), sub: `${tables.length} relations`, icon: Database, color: "text-violet-400" },
            { label: "Saved", value: formatCompact(savedQueries), sub: "query drafts", icon: Check, color: "text-amber-400" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[#192638] bg-[#0a131f]/80 p-2.5">
              <div className="flex items-center gap-1.5">
                <stat.icon className={cn("h-2.5 w-2.5", stat.color)} />
                <span className="text-[9px] uppercase tracking-[0.08em] text-slate-600">{stat.label}</span>
              </div>
              <div className="mt-1 font-mono text-[15px] font-medium tracking-[-0.03em] text-slate-200">{stat.value}</div>
              <div className="mt-0.5 text-[8.5px] text-slate-600">{stat.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[#192638] bg-[#0a131f]/70 p-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Table distribution</SectionLabel>
            <span className="font-mono text-[8px] uppercase tracking-wider text-slate-600">rows</span>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {tables.slice(0, 4).map((table, index) => (
              <div key={table.name}>
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-sm bg-gradient-to-br", BAR_COLORS[index % BAR_COLORS.length])} />
                  <span className="truncate font-mono text-[9.5px] text-slate-400">{table.name}</span>
                  <span className="ml-auto font-mono text-[9px] tabular-nums text-slate-600">
                    {formatCompact(table.rows.length)}
                  </span>
                </div>
                <div className="ml-3.5 mt-1 h-[3px] overflow-hidden rounded-full bg-[#131f30]">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r", BAR_COLORS[index % BAR_COLORS.length])}
                    style={{ width: `${Math.max(4, Math.min(100, rows ? (table.rows.length / rows) * 100 : 0))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#192638] bg-[#0a131f]/70 p-2.5">
          <div className="flex items-center justify-between px-0.5 pb-1">
            <SectionLabel>Recent runs</SectionLabel>
            <Clock3 className="h-2.5 w-2.5 text-slate-600" />
          </div>
          <div className="space-y-0.5">
            {history.slice(0, 5).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => onLoadQuery(run.sql, run.label)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/[0.035]"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    run.status === "success"
                      ? "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-400"
                      : "border-amber-500/20 bg-amber-500/[0.08] text-amber-400",
                  )}
                >
                  <Check className="h-2 w-2" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-medium text-slate-300">{run.label}</span>
                  <span className="mt-[-1px] block font-mono text-[8px] text-slate-600">
                    {run.rows} rows · {run.timestamp}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[8.5px] text-slate-600">{run.ms.toFixed(1)}ms</span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onLoadQuery(suggestion.sql, suggestion.name)}
          className="group relative w-full overflow-hidden rounded-lg border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.09] via-[#0c1422] to-[#09111b] p-3 text-left transition hover:border-violet-400/35"
        >
          <div className="absolute -right-5 -top-6 h-20 w-20 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="relative flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-300" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-violet-300/90">Suggested query</span>
            <ArrowUpRight className="ml-auto h-3 w-3 text-slate-600 transition group-hover:text-violet-300" />
          </div>
          <p className="relative mt-1.5 text-[11px] font-medium text-slate-200">{suggestion.name}</p>
          <p className="relative mt-0.5 text-[9px] leading-relaxed text-slate-500">{suggestion.description}</p>
          <div className="relative mt-2 flex items-center gap-1.5 font-mono text-[8px] text-slate-600">
            <span className="rounded border border-[#28374e] bg-[#0d1826] px-1 py-[1px]">{suggestion.category}</span>
            <span>press to load</span>
          </div>
        </button>

        <div className="flex items-center justify-between px-1 pb-1 pt-0.5 font-mono text-[8px] text-slate-700">
          <span>session_{Math.max(1, totalRuns).toString().padStart(3, "0")}</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-emerald-400/60" />
            sovereign engine
          </span>
        </div>
      </div>
    </aside>
  );
}
