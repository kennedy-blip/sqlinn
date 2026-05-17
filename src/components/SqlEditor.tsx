import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  Database,
  FileJson,
  FileSpreadsheet,
  History,
  Loader2,
  Play,
  Plus,
  Rows3,
  Sparkles,
  SquareTerminal,
  Timer,
  Wand2,
  X,
} from "lucide-react";
import type { TableDef } from "@/lib/database";
import { formatCompact } from "@/lib/database";
import { downloadQueryCsv, downloadQueryJson } from "@/lib/io";
import { INITIAL_QUERY, QUERY_PRESETS, type QueryPreset } from "@/lib/presets";
import { formatSql, queryErrorMessage, runSql, type QueryResult } from "@/lib/sql";
import type { ToastKind } from "./ui";
import { cn } from "@/utils/cn";
import { CodeEditor } from "./CodeEditor";
import { ResultsGrid } from "./ResultsGrid";
import { WorkspacePulse, type RunRecord } from "./WorkspacePulse";
import { EmptyState, Kbd, LiveDot } from "./ui";

export interface SnippetRequest {
  id: string;
  table: TableDef;
}

interface QueryTab {
  id: string;
  name: string;
  sql: string;
  saved: boolean;
  result: QueryResult | null;
  error: { message: string; hint?: string } | null;
  running: boolean;
}

interface SqlEditorProps {
  tables: TableDef[];
  insertSnippet: SnippetRequest | null;
  onSnippetApplied: () => void;
  notify: (message: string, detail?: string, kind?: ToastKind) => void;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
}

function buildInitialState(tables: TableDef[]): { tabs: QueryTab[]; history: RunRecord[] } {
  const definitions = [
    { preset: QUERY_PRESETS[0], name: "Top power users", saved: true },
    { preset: QUERY_PRESETS[3], name: "Latency watch", saved: false },
  ];
  const history: RunRecord[] = [];

  const tabs = definitions.map(({ preset, name, saved }, index) => {
    let result: QueryResult | null = null;
    let error: { message: string; hint?: string } | null = null;
    try {
      result = runSql(tables, preset.sql);
      history.unshift({
        id: `initial-run-${index}`,
        label: name,
        sql: preset.sql,
        rows: result.rows.length,
        ms: result.ms,
        status: "success",
        timestamp: timestamp(),
      });
    } catch (caught) {
      error = queryErrorMessage(caught);
    }
    return {
      id: `query-tab-${index}`,
      name,
      sql: preset.sql,
      saved,
      result,
      error,
      running: false,
    };
  });

  return { tabs, history };
}

export function SqlEditor({ tables, insertSnippet, onSnippetApplied, notify }: SqlEditorProps) {
  const [initial] = useState(() => buildInitialState(tables));
  const [tabs, setTabs] = useState<QueryTab[]>(initial.tabs);
  const [activeId, setActiveId] = useState(initial.tabs[0].id);
  const [history, setHistory] = useState<RunRecord[]>(initial.history);
  const [presetOpen, setPresetOpen] = useState(false);
  const [tabSequence, setTabSequence] = useState(3);
  const presetRef = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const lastRows = activeTab?.result?.rows.length ?? 0;
  const savedQueries = tabs.filter((tab) => tab.saved).length;

  useEffect(() => {
    if (!presetOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(event.target as Node)) setPresetOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [presetOpen]);

  useEffect(() => {
    if (!insertSnippet) return;
    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeId
          ? {
              ...tab,
              sql: `SELECT *\nFROM ${insertSnippet.table.name}\nLIMIT 100;`,
              name: `${insertSnippet.table.name}_preview`,
              error: null,
            }
          : tab,
      ),
    );
    notify("Schema snippet inserted", `SELECT * FROM ${insertSnippet.table.name} · press ⌘↵ to execute`, "info");
    onSnippetApplied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertSnippet?.id]);

  const updateActive = (updater: (tab: QueryTab) => QueryTab) => {
    setTabs((current) => current.map((tab) => (tab.id === activeId ? updater(tab) : tab)));
  };

  const execute = (sql: string, tabId: string, label: string) => {
    if (!sql.trim()) {
      setTabs((current) =>
        current.map((tab) =>
          tab.id === tabId
            ? { ...tab, error: { message: "Your query is empty.", hint: "Write a SELECT statement or open the query library." }, result: null }
            : tab,
        ),
      );
      return;
    }
    setTabs((current) =>
      current.map((tab) => (tab.id === tabId ? { ...tab, running: true, error: null } : tab)),
    );
    window.setTimeout(() => {
      try {
        const result = runSql(tables, sql);
        setTabs((current) =>
          current.map((tab) =>
            tab.id === tabId ? { ...tab, running: false, result, error: null } : tab,
          ),
        );
        setHistory((current) =>
          [
            {
              id: `run-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
              label,
              sql,
              rows: result.rows.length,
              ms: result.ms,
              status: "success" as const,
              timestamp: timestamp(),
            },
            ...current,
          ].slice(0, 24),
        );
      } catch (caught) {
        const error = queryErrorMessage(caught);
        setTabs((current) =>
          current.map((tab) => (tab.id === tabId ? { ...tab, running: false, error, result: null } : tab)),
        );
        setHistory((current) =>
          [
            {
              id: `run-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
              label,
              sql,
              rows: 0,
              ms: 0.1,
              status: "error" as const,
              timestamp: timestamp(),
            },
            ...current,
          ].slice(0, 24),
        );
      }
    }, 130);
  };

  const runCurrent = () => {
    if (!activeTab) return;
    execute(activeTab.sql, activeTab.id, activeTab.name);
  };

  const loadPreset = (preset: QueryPreset) => {
    if (!activeTab) return;
    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeId
          ? { ...tab, sql: preset.sql, name: preset.name, error: null }
          : tab,
      ),
    );
    setPresetOpen(false);
    execute(preset.sql, activeTab.id, preset.name);
  };

  const loadHistoryQuery = (sql: string, label: string) => {
    if (!activeTab) return;
    setTabs((current) =>
      current.map((tab) => (tab.id === activeId ? { ...tab, sql, name: label, error: null } : tab)),
    );
    execute(sql, activeTab.id, label);
  };

  const addTab = () => {
    const id = `query-tab-${Date.now()}`;
    const name = `Query ${String(tabSequence).padStart(2, "0")}`;
    setTabs((current) => [
      ...current,
      { id, name, sql: "", saved: false, result: null, error: null, running: false },
    ]);
    setActiveId(id);
    setTabSequence((current) => current + 1);
    notify("New query tab ready", "The in-memory engine accepts SELECT statements.", "info");
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      notify("Keep one query open", "The final workspace tab cannot be closed.", "info");
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === id);
    const nextTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(nextTabs);
    if (activeId === id) setActiveId(nextTabs[Math.max(0, index - 1)].id);
  };

  const toggleSaved = () => {
    if (!activeTab) return;
    updateActive((tab) => ({ ...tab, saved: !tab.saved }));
    notify(activeTab.saved ? "Draft removed from saved queries" : "Query saved to this session", activeTab.name, "success");
  };

  const formatCurrent = () => {
    if (!activeTab) return;
    updateActive((tab) => ({ ...tab, sql: formatSql(tab.sql) }));
    notify("Query formatted", "SQL clauses aligned for readability.", "info");
  };

  const copyQuery = async () => {
    if (!activeTab) return;
    try {
      await navigator.clipboard.writeText(activeTab.sql);
      notify("SQL copied to clipboard", activeTab.name, "success");
    } catch {
      notify("Clipboard unavailable", "Select the query text and copy it manually.", "error");
    }
  };

  const copyResults = async () => {
    if (!activeTab?.result) return;
    const records = activeTab.result.rows.map((row) =>
      Object.fromEntries(activeTab.result?.columns.map((column, index) => [column.label, row[index] ?? null]) ?? []),
    );
    try {
      await navigator.clipboard.writeText(JSON.stringify(records, null, 2));
      notify("Results copied as JSON", `${records.length} rows on the clipboard.`, "success");
    } catch {
      notify("Clipboard unavailable", "Use the JSON export instead.", "error");
    }
  };

  const exportCsv = () => {
    if (!activeTab?.result) return;
    downloadQueryCsv(activeTab.result, `${activeTab.name.replace(/\s+/g, "_").toLowerCase()}.csv`);
    notify("CSV exported", `${activeTab.result.rows.length} rows downloaded from ${activeTab.name}.`, "success");
  };

  const exportJson = () => {
    if (!activeTab?.result) return;
    downloadQueryJson(activeTab.result, `${activeTab.name.replace(/\s+/g, "_").toLowerCase()}.json`);
    notify("JSON exported", `${activeTab.result.rows.length} rows downloaded from ${activeTab.name}.`, "success");
  };

  if (!activeTab) return null;

  const isSuccess = Boolean(activeTab.result);
  const hasError = Boolean(activeTab.error);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="scroll-thin flex h-[38px] shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[#172235] bg-[#080e18] px-2">
          {tabs.map((tab) => {
            const active = tab.id === activeId;
            return (
              <div
                key={tab.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(tab.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setActiveId(tab.id);
                }}
                className={cn(
                  "group relative flex h-[31px] max-w-[190px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 transition",
                  active
                    ? "border-[#26364c] bg-[#0c1624] text-slate-200"
                    : "border-transparent text-slate-500 hover:bg-[#0b1420] hover:text-slate-300",
                )}
              >
                {active && <span className="absolute inset-x-0 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />}
                <SquareTerminal className={cn("h-3 w-3 shrink-0", active ? "text-cyan-400" : "text-slate-600")} />
                <span className="truncate text-[10.5px] font-medium">{tab.name}</span>
                {tab.saved && <span className="h-1 w-1 shrink-0 rounded-full bg-cyan-400/60" />}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className={cn(
                      "ml-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-slate-600 transition hover:bg-white/10 hover:text-slate-200",
                      !active && "opacity-0 group-hover:opacity-100",
                    )}
                    aria-label={`Close ${tab.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={addTab}
            className="ml-1 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded border border-[#223148] text-slate-500 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] hover:text-cyan-300"
            aria-label="New query tab"
            title="New query tab"
          >
            <Plus className="h-3 w-3" />
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2 pl-3">
            <span className="flex items-center gap-1.5 rounded border border-[#1d2b3e] bg-[#0a121e] px-1.5 py-[2px] font-mono text-[8px] text-slate-500">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              autosaved
            </span>
            <span className="hidden items-center gap-1 font-mono text-[8.5px] text-slate-600 sm:flex">
              <History className="h-2.5 w-2.5" />
              {history.length} runs
            </span>
          </div>
        </div>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-[#070b13] p-2.5">
          <section className="flex h-[350px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#1c2a3e] bg-[#0a111c] shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
            <div className="flex h-[40px] shrink-0 items-center gap-2 border-b border-[#182436] bg-gradient-to-b from-[#0d1725] to-[#0b1420] px-2.5">
              <span className="flex h-[23px] w-[23px] items-center justify-center rounded border border-cyan-500/20 bg-cyan-500/[0.07]">
                <SquareTerminal className="h-3 w-3 text-cyan-400" />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[11px] font-medium text-slate-200">SQL console</span>
                <span className="hidden rounded border border-[#253349] bg-[#0a1320] px-1.5 py-[1px] font-mono text-[8px] text-slate-500 sm:inline">
                  main
                </span>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSaved}
                  className={cn(
                    "flex h-[26px] w-[26px] items-center justify-center rounded border transition",
                    activeTab.saved
                      ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-300"
                      : "border-transparent text-slate-500 hover:border-[#263449] hover:bg-[#0d1826] hover:text-slate-300",
                  )}
                  title={activeTab.saved ? "Saved query" : "Save query"}
                >
                  <Bookmark className={cn("h-3.5 w-3.5", activeTab.saved && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={copyQuery}
                  className="hidden h-[26px] w-[26px] items-center justify-center rounded border border-transparent text-slate-500 transition hover:border-[#263449] hover:bg-[#0d1826] hover:text-slate-300 sm:flex"
                  title="Copy query"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={formatCurrent}
                  className="flex h-[26px] items-center gap-1.5 rounded border border-[#243247] bg-[#0b1522] px-2 text-[10px] font-medium text-slate-400 transition hover:border-[#334864] hover:text-slate-200"
                  title="Format query"
                >
                  <Wand2 className="h-3 w-3" />
                  <span className="hidden md:inline">Format</span>
                </button>

                <div className="relative" ref={presetRef}>
                  <button
                    type="button"
                    onClick={() => setPresetOpen((open) => !open)}
                    className={cn(
                      "flex h-[26px] items-center gap-1.5 rounded border px-2 text-[10px] font-medium transition",
                      presetOpen
                        ? "border-violet-400/35 bg-violet-500/[0.1] text-violet-200"
                        : "border-[#243247] bg-[#0b1522] text-slate-400 hover:border-[#334864] hover:text-slate-200",
                    )}
                    aria-expanded={presetOpen}
                  >
                    <Sparkles className="h-3 w-3 text-violet-400" />
                    <span className="hidden sm:inline">Library</span>
                    <ChevronDown className={cn("h-2.5 w-2.5 text-slate-600 transition", presetOpen && "rotate-180")} />
                  </button>
                  {presetOpen && (
                    <div className="absolute right-0 top-[32px] z-50 w-[min(380px,calc(100vw-32px))] animate-slide-up overflow-hidden rounded-lg border border-[#2a3a52] bg-[#0a131f] shadow-[0_24px_70px_rgba(0,0,0,0.65)]">
                      <div className="flex items-center justify-between border-b border-[#1b293c] px-3 py-2.5">
                        <div>
                          <p className="text-[11px] font-medium text-slate-200">Query library</p>
                          <p className="mt-0.5 text-[9px] text-slate-600">Analytical presets · {QUERY_PRESETS.length} templates</p>
                        </div>
                        <span className="rounded border border-violet-500/20 bg-violet-500/[0.07] px-1.5 py-0.5 font-mono text-[8px] text-violet-300">
                          curated
                        </span>
                      </div>
                      <div className="scroll-thin max-h-[390px] overflow-y-auto p-1.5">
                        {QUERY_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => loadPreset(preset)}
                            className="group flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-white/[0.04]"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#26364d] bg-[#0c1725] text-slate-500 group-hover:border-violet-500/30 group-hover:text-violet-300">
                              {preset.category === "JOIN" ? <Database className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-[10.5px] font-medium text-slate-200">{preset.name}</span>
                                <span className="rounded border border-[#2a384e] px-1 py-[1px] font-mono text-[7.5px] uppercase tracking-wider text-slate-500">
                                  {preset.category}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-[9px] leading-relaxed text-slate-500">{preset.description}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={runCurrent}
                  disabled={activeTab.running}
                  className="ml-0.5 flex h-[27px] items-center gap-1.5 rounded border border-cyan-300/30 bg-gradient-to-b from-cyan-400 to-cyan-500 px-2.5 text-[10.5px] font-semibold text-[#041016] shadow-[0_0_22px_rgba(6,182,212,0.14)] transition hover:from-cyan-300 hover:to-cyan-400 disabled:cursor-wait disabled:opacity-70"
                >
                  {activeTab.running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
                  {activeTab.running ? "Running" : "Run query"}
                  <span className="ml-0.5 hidden items-center gap-0.5 border-l border-[#062a32]/40 pl-1.5 font-mono text-[8px] font-medium text-[#06414c]/80 lg:flex">
                    <Kbd>⌘</Kbd>
                    <span>↵</span>
                  </span>
                </button>
              </div>
            </div>

            <CodeEditor
              value={activeTab.sql}
              onChange={(sql) => updateActive((tab) => ({ ...tab, sql, error: null }))}
              onRun={runCurrent}
              className="min-h-0 flex-1"
            />

            <div className="flex h-[29px] shrink-0 items-center gap-2.5 border-t border-[#182436] bg-[#09111c] px-2.5">
              {activeTab.running ? (
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-cyan-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  evaluating local relations…
                </span>
              ) : hasError ? (
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-amber-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  parse error
                </span>
              ) : isSuccess ? (
                <>
                  <span className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-400">
                    <span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="h-2 w-2" strokeWidth={3} />
                    </span>
                    query successful
                  </span>
                  <span className="h-2.5 w-px bg-[#263449]" />
                  <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                    <Timer className="h-2.5 w-2.5" />
                    {activeTab.result?.ms.toFixed(2)} ms
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                    <Rows3 className="h-2.5 w-2.5" />
                    {formatCompact(activeTab.result?.rows.length ?? 0)} rows
                  </span>
                  <span className="hidden items-center gap-1 font-mono text-[9px] text-slate-600 sm:flex">
                    scanned {formatCompact(activeTab.result?.scanned ?? 0)}
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-slate-500">
                  <span className="h-1 w-1 rounded-full bg-emerald-400/70" />
                  ready · SELECT engine
                </span>
              )}
              <div className="ml-auto flex items-center gap-2 font-mono text-[8.5px] text-slate-600">
                <span className="hidden sm:inline">Ln {activeTab.sql.split("\n").length}</span>
                <span className="hidden items-center gap-1 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#334155]" />
                  read-only
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                </span>
              </div>
            </div>
          </section>

          <section className="flex min-h-[262px] flex-1 flex-col overflow-hidden rounded-lg border border-[#1c2a3e] bg-[#0a111c] shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
            <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-[#182436] bg-gradient-to-b from-[#0d1725] to-[#0b1420] px-2.5">
              <Rows3 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-slate-200">Results</span>
              {isSuccess && <LiveDot className="ml-0.5" />}
              <span className="hidden h-3 w-px bg-[#263449] sm:block" />
              <span className="hidden rounded border border-[#26364c] bg-[#0a1522] px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-wider text-slate-500 sm:inline">
                select
              </span>
              {isSuccess && (
                <span className="rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-[1px] font-mono text-[8px] text-emerald-400">
                  {formatCompact(activeTab.result?.rows.length ?? 0)} returned
                </span>
              )}
              {hasError && (
                <span className="rounded border border-amber-500/20 bg-amber-500/[0.06] px-1.5 py-[1px] font-mono text-[8px] text-amber-400">
                  attention needed
                </span>
              )}

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyResults}
                  disabled={!isSuccess}
                  className="flex h-[24px] w-[24px] items-center justify-center rounded border border-transparent text-slate-500 transition hover:border-[#2a3a52] hover:bg-[#0d1826] hover:text-slate-200 disabled:opacity-35"
                  title="Copy results as JSON"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  disabled={!isSuccess}
                  className="flex h-[24px] items-center gap-1.5 rounded border border-[#26364c] bg-[#0b1522] px-2 font-mono text-[8.5px] font-medium text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-35"
                  title="Export results as CSV"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={exportJson}
                  disabled={!isSuccess}
                  className="flex h-[24px] items-center gap-1.5 rounded border border-[#26364c] bg-[#0b1522] px-2 font-mono text-[8.5px] font-medium text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-300 disabled:opacity-35"
                  title="Export results as JSON"
                >
                  <FileJson className="h-3 w-3" />
                  JSON
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {activeTab.running ? (
                <div className="flex h-full min-h-[170px] flex-col items-center justify-center gap-3">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/[0.06]">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-center text-[11px] font-medium text-slate-300">Scanning local relations</p>
                    <p className="mt-1 text-center font-mono text-[9px] text-slate-600">memory · no network · 0 disk I/O</p>
                  </div>
                </div>
              ) : hasError ? (
                <div className="scroll-thin flex h-full overflow-y-auto p-3">
                  <div className="my-auto w-full rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-[#0a111c] p-3.5">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/[0.08]">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-amber-200">Query could not be evaluated</p>
                        <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-amber-100/70">{activeTab.error?.message}</p>
                        {activeTab.error?.hint && (
                          <p className="mt-2 border-t border-amber-500/10 pt-2 text-[10px] leading-relaxed text-slate-500">
                            {activeTab.error.hint}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setPresetOpen(true)}
                          className="mt-3 flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-500/[0.05] px-2 py-1 text-[9.5px] font-medium text-amber-300 transition hover:bg-amber-500/[0.1]"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Open query library
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : isSuccess && activeTab.result ? (
                <ResultsGrid result={activeTab.result} />
              ) : (
                <EmptyState
                  icon={<SquareTerminal className="h-4 w-4" />}
                  title="Run a query to inspect the result set"
                  description="Your data is evaluated locally inside this tab. Use the query library for joins, cohorts, aggregates and diagnostics."
                  action={
                    <button
                      type="button"
                      onClick={runCurrent}
                      className="flex h-[28px] items-center gap-1.5 rounded border border-cyan-400/25 bg-cyan-400/[0.08] px-2.5 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-400/[0.14]"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Execute current query
                    </button>
                  }
                />
              )}
            </div>

            <div className="flex h-[26px] shrink-0 items-center gap-3 border-t border-[#151f2f] bg-[#09111c] px-2.5 font-mono text-[8px] text-slate-600">
              <span className="text-slate-500">{INITIAL_QUERY.split("\n")[0] === activeTab.sql.split("\n")[0] ? "curated query" : "workspace query"}</span>
              <span className="h-2 w-px bg-[#263449]" />
              <span>{isSuccess ? "in-memory cursor" : "engine idle"}</span>
              <span className="ml-auto hidden sm:inline">rows sorted client-side</span>
              <span>{isSuccess ? `${activeTab.result?.ms.toFixed(2)} ms` : "—"}</span>
            </div>
          </section>
        </div>
      </div>

      <WorkspacePulse
        tables={tables}
        history={history}
        lastRows={lastRows}
        savedQueries={savedQueries}
        onLoadQuery={loadHistoryQuery}
      />
    </div>
  );
}
