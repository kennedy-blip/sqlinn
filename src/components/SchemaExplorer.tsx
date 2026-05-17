import { useMemo, useState } from "react";
import {
  ChevronRight,
  CircleDot,
  Database,
  HardDrive,
  KeyRound,
  Layers3,
  Link2,
  Plus,
  Play,
  Search,
  ShieldCheck,
  Table2,
  X,
} from "lucide-react";
import { COLUMN_TYPE_COLORS, formatCompact, formatNumber, type TableDef } from "@/lib/database";
import { cn } from "@/utils/cn";
import { SectionLabel } from "./ui";

interface SchemaExplorerProps {
  tables: TableDef[];
  onSelectTable: (table: TableDef) => void;
  onCreateTable: () => void;
  onClose?: () => void;
}

export function SchemaExplorer({ tables, onSelectTable, onCreateTable, onClose }: SchemaExplorerProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    users: true,
    api_logs: true,
  });
  const [search, setSearch] = useState("");

  const bytes = useMemo(() => {
    try {
      return new Blob([JSON.stringify(tables)]).size;
    } catch {
      return 0;
    }
  }, [tables]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return tables;
    return tables
      .map((table) => ({
        ...table,
        columns: table.columns.filter(
          (column) =>
            column.name.toLowerCase().includes(query) ||
            column.type.toLowerCase().includes(query) ||
            table.name.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (table) =>
          table.name.toLowerCase().includes(query) ||
          table.description?.toLowerCase().includes(query) ||
          table.columns.length > 0,
      );
  }, [tables, query]);

  const total = tables.reduce((sum, table) => sum + table.rows.length, 0);
  const storageLabel = bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.round(bytes / 1000)} KB`;

  return (
    <aside className="flex h-full w-[276px] shrink-0 flex-col border-r border-[#172235] bg-[#080d17]">
      <div className="flex h-[43px] shrink-0 items-center gap-2 border-b border-[#141e2e] px-3">
        <Layers3 className="h-3.5 w-3.5 text-cyan-400" />
        <SectionLabel className="text-slate-400">Schema explorer</SectionLabel>
        <span className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded border border-[#223148] bg-[#0c1624] px-1 font-mono text-[9px] text-slate-500">
          {tables.length}
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-white/5 hover:text-slate-200 lg:hidden"
            aria-label="Close schema explorer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-b border-[#141e2e] px-2.5 py-2.5">
        <div className="flex items-center gap-2 rounded-md border border-[#1b293c] bg-[#0b1420] px-2 py-[7px]">
          <Database className="h-3.5 w-3.5 text-cyan-400" />
          <span className="truncate font-mono text-[11px] font-medium text-slate-200">local_workspace.db</span>
          <span className="ml-auto flex items-center gap-1 font-mono text-[8.5px] text-emerald-400">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            LIVE
          </span>
        </div>

        <div className="group relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter tables & columns"
            className="h-[29px] w-full rounded-md border border-[#192538] bg-[#080f19] pl-7 pr-10 font-sans text-[11px] text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/35 focus:bg-[#0a1420]"
            aria-label="Filter schema"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[#263449] bg-[#0c1725] px-1 font-mono text-[8px] text-slate-600">
            /
          </span>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-1.5 px-3 pb-1 pt-3">
          <ChevronRight className="h-3 w-3 text-slate-600" />
          <Database className="h-3 w-3 text-slate-500" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500">main</span>
          <span className="ml-auto font-mono text-[9px] text-slate-600">{formatCompact(total)} rows</span>
        </div>

        <div className="space-y-0.5 px-1.5 pb-3">
          {filtered.map((table) => {
            const isExpanded = query ? true : Boolean(expanded[table.name]);
            const columns = query
              ? table.columns.filter(
                  (column) =>
                    table.name.toLowerCase().includes(query) ||
                    column.name.toLowerCase().includes(query) ||
                    column.type.toLowerCase().includes(query),
                )
              : table.columns;
            return (
              <div key={table.name}>
                <div
                  className={cn(
                    "group flex h-[31px] cursor-pointer items-center rounded-md pr-1 transition",
                    isExpanded ? "bg-[#0d1725]" : "hover:bg-[#0c1421]",
                  )}
                  onClick={() =>
                    setExpanded((current) => ({ ...current, [table.name]: !current[table.name] }))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setExpanded((current) => ({ ...current, [table.name]: !current[table.name] }));
                    }
                  }}
                  aria-expanded={isExpanded}
                >
                  <ChevronRight
                    className={cn(
                      "mx-1 h-3 w-3 shrink-0 text-slate-600 transition-transform",
                      isExpanded && "rotate-90 text-slate-400",
                    )}
                  />
                  <Table2
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5 shrink-0 transition",
                      isExpanded ? "text-cyan-400" : "text-slate-500",
                    )}
                  />
                  <span className="truncate font-mono text-[11.5px] font-medium text-slate-300">{table.name}</span>
                  <span className="ml-auto rounded bg-[#08101a] px-1.5 py-[1px] font-mono text-[8.5px] text-slate-500 group-hover:hidden">
                    {formatCompact(table.rows.length)}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectTable(table);
                    }}
                    className="ml-auto hidden h-[20px] items-center gap-1 rounded border border-cyan-500/20 bg-cyan-500/[0.08] px-1.5 font-mono text-[8.5px] font-medium text-cyan-300 transition hover:bg-cyan-500/15 group-hover:flex"
                    title={`SELECT * FROM ${table.name}`}
                  >
                    <Play className="h-2.5 w-2.5 fill-current" />
                    SELECT
                  </button>
                </div>

                {isExpanded && (
                  <div className="relative ml-[23px] border-l border-[#1a2638] pb-1 pl-[9px]">
                    {columns.map((column) => (
                      <div
                        key={column.name}
                        className="group/column flex h-[25px] items-center gap-1.5 rounded pr-1.5 transition hover:bg-white/[0.025]"
                        title={`${column.name} ${column.type}${column.primaryKey ? " · primary key" : ""}${
                          column.foreignKey ? ` · references ${column.foreignKey.table}.${column.foreignKey.column}` : ""
                        }`}
                      >
                        {column.primaryKey ? (
                          <KeyRound className="h-[11px] w-[11px] shrink-0 text-cyan-400" />
                        ) : column.foreignKey ? (
                          <Link2 className="h-[11px] w-[11px] shrink-0 text-violet-400" />
                        ) : (
                          <CircleDot className="h-[8px] w-[8px] shrink-0 text-slate-700" />
                        )}
                        <span
                          className={cn(
                            "truncate font-mono text-[10.5px]",
                            column.primaryKey
                              ? "text-cyan-200"
                              : column.foreignKey
                                ? "text-violet-200"
                                : "text-slate-400",
                          )}
                        >
                          {column.name}
                        </span>
                        {column.primaryKey && (
                          <span className="rounded border border-cyan-500/20 bg-cyan-500/[0.07] px-[3px] font-mono text-[7px] font-semibold text-cyan-400">
                            PK
                          </span>
                        )}
                        {column.foreignKey && (
                          <span className="rounded border border-violet-500/20 bg-violet-500/[0.08] px-[3px] font-mono text-[7px] font-semibold text-violet-400">
                            FK
                          </span>
                        )}
                        <span
                          className={cn(
                            "ml-auto shrink-0 font-mono text-[8.5px] uppercase opacity-80",
                            COLUMN_TYPE_COLORS[column.type],
                          )}
                        >
                          {column.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {!filtered.length && (
            <div className="px-3 py-5 text-center text-[10.5px] text-slate-600">No schema objects match “{search}”.</div>
          )}
        </div>

        <div className="px-2.5 pb-3">
          <button
            type="button"
            onClick={onCreateTable}
            className="flex h-[29px] w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#26364c] bg-[#0a1320]/60 text-[10.5px] font-medium text-slate-500 transition hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] hover:text-cyan-300"
          >
            <Plus className="h-3 w-3" />
            New table blueprint
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#141e2e] p-2.5">
        <div className="rounded-lg border border-[#1a293d] bg-gradient-to-b from-[#0b1522] to-[#080f19] p-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] font-medium text-slate-300">Sovereign local data</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
          </div>
          <p className="mt-1 text-[9.5px] leading-relaxed text-slate-600">
            Everything runs in this tab. No requests, no telemetry.
          </p>
          <div className="mt-2.5 flex items-center justify-between font-mono text-[9px]">
            <span className="flex items-center gap-1 text-slate-500">
              <HardDrive className="h-2.5 w-2.5" />
              memory
            </span>
            <span className="text-slate-400">{storageLabel}</span>
          </div>
          <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[#142033]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
              style={{ width: `${Math.max(6, Math.min(100, (bytes / 3_000_000) * 100))}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[8.5px] text-slate-600">
            <span>local_workspace</span>
            <span>{formatNumber(total)} indexed rows</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
