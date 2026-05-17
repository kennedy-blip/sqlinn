import {
  Activity,
  ChevronDown,
  Database,
  DatabaseZap,
  Download,
  FileUp,
  Menu,
  Rows3,
  ShieldCheck,
  Table2,
} from "lucide-react";
import { formatCompact, totalRows, type TableDef } from "@/lib/database";
import { Kbd, LiveDot } from "./ui";

interface StudioHeaderProps {
  tables: TableDef[];
  onSeed: () => void;
  onExportDump: () => void;
  onImport: () => void;
  onOpenSidebar: () => void;
}

function LogoMark() {
  return (
    <span className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[9px] border border-cyan-300/20 bg-gradient-to-br from-cyan-400 via-cyan-500 to-emerald-500 shadow-[0_0_24px_rgba(6,182,212,0.2)]">
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.45),transparent_45%)]" />
      <Activity className="relative h-[17px] w-[17px] text-[#041018]" strokeWidth={2.7} />
    </span>
  );
}

export function StudioHeader({ tables, onSeed, onExportDump, onImport, onOpenSidebar }: StudioHeaderProps) {
  const rows = totalRows(tables);

  return (
    <header className="relative z-40 flex h-[60px] shrink-0 items-center gap-2.5 border-b border-[#172235] bg-[#070c15]/95 px-3 backdrop-blur-xl sm:gap-3 sm:px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent" />

      <button
        type="button"
        onClick={onOpenSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[#223048] text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300 lg:hidden"
        aria-label="Open schema explorer"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <LogoMark />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.025em] text-slate-50">Query</span>
          <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-[15px] font-semibold tracking-[-0.025em] text-transparent">
            Pulse
          </span>
        </div>
        <span className="hidden rounded border border-[#1f3147] bg-[#0b1624] px-1.5 py-[2px] font-mono text-[8.5px] font-medium uppercase tracking-[0.14em] text-slate-500 sm:inline">
          Studio
        </span>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-[#1c283b] md:block" />

      <div className="hidden min-w-0 items-center gap-2 rounded-md border border-[#1b293c] bg-[#0b1420]/80 py-1 pl-1.5 pr-2.5 md:flex">
        <span className="flex h-[27px] w-[27px] items-center justify-center rounded-[5px] border border-cyan-500/20 bg-cyan-500/[0.08]">
          <Database className="h-3.5 w-3.5 text-cyan-400" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-[11px] font-medium text-slate-200">local_workspace.db</span>
            <ChevronDown className="h-2.5 w-2.5 shrink-0 text-slate-600" />
          </div>
          <div className="mt-[-1px] flex items-center gap-1.5">
            <LiveDot />
            <span className="text-[9px] uppercase tracking-[0.08em] text-slate-500">In-Memory Engine</span>
          </div>
        </div>
      </div>

      <div className="hidden items-center gap-1 xl:flex">
        <span className="flex h-6 items-center gap-1.5 rounded-md border border-[#1b293c] bg-[#0a121e] px-2 text-[10px] text-slate-500">
          <Table2 className="h-3 w-3 text-slate-500" />
          <span className="font-mono text-slate-300">{tables.length}</span>
          tables
        </span>
        <span className="flex h-6 items-center gap-1.5 rounded-md border border-[#1b293c] bg-[#0a121e] px-2 text-[10px] text-slate-500">
          <Rows3 className="h-3 w-3 text-slate-500" />
          <span className="font-mono text-slate-300">{formatCompact(rows)}</span>
          rows
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="mr-1 hidden items-center gap-1.5 rounded-md border border-emerald-500/15 bg-emerald-500/[0.045] px-2 py-1 2xl:flex">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-300/90">Local-first</span>
          <span className="font-mono text-[9px] text-slate-600">no network</span>
        </div>

        <button
          type="button"
          onClick={onSeed}
          className="group flex h-[30px] items-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] font-medium text-slate-400 transition hover:border-[#233148] hover:bg-[#0d1724] hover:text-slate-200"
          title="Reset the in-memory workspace with the sample dataset"
        >
          <DatabaseZap className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-cyan-300" />
          <span className="hidden xl:inline">Seed Sample Dataset</span>
        </button>

        <button
          type="button"
          onClick={onExportDump}
          className="group flex h-[30px] items-center gap-1.5 rounded-md border border-transparent px-2 text-[11px] font-medium text-slate-400 transition hover:border-[#233148] hover:bg-[#0d1724] hover:text-slate-200"
          title="Download a complete SQL dump"
        >
          <Download className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-slate-200" />
          <span className="hidden xl:inline">Export SQL Dump</span>
        </button>

        <button
          type="button"
          onClick={onImport}
          className="flex h-[30px] items-center gap-1.5 rounded-md border border-cyan-400/25 bg-cyan-400/[0.08] px-2.5 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.14] hover:text-cyan-100"
          title="Import a CSV or JSON file"
        >
          <FileUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import CSV/JSON</span>
        </button>

        <div className="ml-1 hidden h-[30px] items-center gap-1.5 rounded-md border border-[#1f2d42] bg-[#0a121e] px-2 lg:flex">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd>
          <span className="ml-0.5 text-[9px] text-slate-500">run</span>
        </div>
      </div>
    </header>
  );
}
