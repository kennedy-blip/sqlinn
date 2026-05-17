import { useCallback, useRef, useState } from "react";
import {
  Braces,
  ChevronRight,
  Database,
  FileUp,
  Network,
  ShieldCheck,
  SquareTerminal,
  Terminal,
  Zap,
} from "lucide-react";
import { SchemaExplorer } from "@/components/SchemaExplorer";
import { StudioHeader } from "@/components/StudioHeader";
import { SqlEditor, type SnippetRequest } from "@/components/SqlEditor";
import { ErdVisualizer } from "@/components/ErdVisualizer";
import { ImportModal } from "@/components/ImportModal";
import { ToastStack, type ToastItem, type ToastKind } from "@/components/ui";
import { createSeedTables, formatCompact, generateSqlDump, totalRows, type TableDef } from "@/lib/database";
import { downloadText } from "@/lib/io";
import { cn } from "@/utils/cn";

type WorkspaceView = "studio" | "designer";

export default function App() {
  const [tables, setTables] = useState<TableDef[]>(() => createSeedTables());
  const [view, setView] = useState<WorkspaceView>("studio");
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [snippet, setSnippet] = useState<SnippetRequest | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const toastSequence = useRef(0);

  const notify = useCallback((message: string, detail?: string, kind: ToastKind = "success") => {
    toastSequence.current += 1;
    const id = `toast-${Date.now()}-${toastSequence.current}`;
    setToasts((current) => [...current, { id, message, detail, kind }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const handleSeed = () => {
    setTables(createSeedTables());
    setEditorKey((key) => key + 1);
    setView("studio");
    notify("Sample dataset seeded", "184 users · 640 api_logs · 184 embeddings_meta loaded in memory.", "success");
  };

  const handleExportDump = () => {
    const dump = generateSqlDump(tables);
    downloadText("local_workspace_dump.sql", dump, "text/sql");
    notify("Workspace SQL dump exported", `${tables.length} tables and ${formatCompact(totalRows(tables))} rows captured.`, "success");
  };

  const handleImport = (table: TableDef) => {
    setTables((current) => [...current, table]);
    setView("designer");
    notify(`Imported ${table.name}`, `${formatCompact(table.rows.length)} rows · ${table.columns.length} inferred columns · local only.`, "success");
  };

  const handleSelectTable = (table: TableDef) => {
    setSnippet({ id: `snippet-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, table });
    setView("studio");
    setSidebarOpen(false);
  };

  const handleCreateTable = () => {
    setView("designer");
    setSidebarOpen(false);
    notify("New table blueprint", "Describe columns and keys, then commit the generated DDL.", "info");
  };

  const handleCommitBlueprint = (table: TableDef, originalName: string | null): boolean => {
    const duplicate = tables.some(
      (existing) =>
        existing.name.toLowerCase() === table.name.toLowerCase() &&
        existing.name.toLowerCase() !== (originalName ?? "").toLowerCase(),
    );
    if (duplicate) {
      notify("Table name already exists", `Choose another name for "${table.name}".`, "error");
      return false;
    }

    if (originalName) {
      const existing = tables.find((candidate) => candidate.name === originalName);
      if (!existing) {
        notify("Original table was not found", "Start a new blueprint and try again.", "error");
        return false;
      }
      const remappedRows = existing.rows.map((row) => {
        const nextRow: Record<string, string | number | boolean | null> = {};
        for (const column of table.columns) {
          nextRow[column.name] = Object.prototype.hasOwnProperty.call(row, column.name) ? row[column.name] : null;
        }
        return nextRow;
      });
      setTables((current) =>
        current.map((candidate) =>
          candidate.name === originalName
            ? {
                ...table,
                rows: remappedRows,
                description: existing.description ?? table.description,
              }
            : candidate,
        ),
      );
      notify("Schema committed", `${table.name} · ${table.columns.length} columns · ${formatCompact(remappedRows.length)} rows preserved.`, "success");
    } else {
      setTables((current) => [...current, table]);
      notify("Table created in workspace", `${table.name} · ${table.columns.length} columns · ready for SELECT queries.`, "success");
    }
    return true;
  };

  const rows = totalRows(tables);
  const foreignKeys = tables.reduce(
    (count, table) => count + table.columns.filter((column) => column.foreignKey).length,
    0,
  );

  return (
    <div className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-[#070a12] text-slate-300">
      <StudioHeader
        tables={tables}
        onSeed={handleSeed}
        onExportDump={handleExportDump}
        onImport={() => setImportOpen(true)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <nav className="relative z-30 flex h-[40px] shrink-0 items-center gap-2 border-b border-[#172235] bg-[#080d17] px-2.5">
        <span className="mr-1 hidden items-center gap-1.5 pl-1 lg:flex">
          <Terminal className="h-3 w-3 text-slate-600" />
          <span className="font-mono text-[8.5px] uppercase tracking-[0.15em] text-slate-600">Workspace</span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setView("studio")}
            className={cn(
              "group relative flex h-[29px] items-center gap-1.5 rounded-md border px-2.5 text-[10.5px] font-medium transition",
              view === "studio"
                ? "border-[#2a3b51] bg-[#0e1a28] text-slate-200 shadow-sm"
                : "border-transparent text-slate-500 hover:bg-[#0c1421] hover:text-slate-300",
            )}
            aria-current={view === "studio" ? "page" : undefined}
          >
            <SquareTerminal className={cn("h-3 w-3", view === "studio" ? "text-cyan-400" : "text-slate-600")} />
            Query Studio
            {view === "studio" && <span className="absolute inset-x-2.5 -bottom-[6px] h-[1.5px] rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />}
          </button>
          <button
            type="button"
            onClick={() => setView("designer")}
            className={cn(
              "group relative flex h-[29px] items-center gap-1.5 rounded-md border px-2.5 text-[10.5px] font-medium transition",
              view === "designer"
                ? "border-[#2a3b51] bg-[#0e1a28] text-slate-200 shadow-sm"
                : "border-transparent text-slate-500 hover:bg-[#0c1421] hover:text-slate-300",
            )}
            aria-current={view === "designer" ? "page" : undefined}
          >
            <Network className={cn("h-3 w-3", view === "designer" ? "text-violet-400" : "text-slate-600")} />
            Schema Designer
            {view === "designer" && <span className="absolute inset-x-2.5 -bottom-[6px] h-[1.5px] rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />}
          </button>
        </div>

        <div className="ml-2 hidden items-center gap-1.5 text-slate-600 lg:flex">
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="font-mono text-[9px]">main</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="font-mono text-[9px] text-slate-500">{view === "studio" ? "query_workspace" : "schema_blueprints"}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded border border-[#1d2b3e] bg-[#0a121e] px-2 py-1 md:flex">
            <Braces className="h-2.5 w-2.5 text-violet-400" />
            <span className="font-mono text-[8.5px] text-slate-500">
              {tables.length} tables · {formatCompact(rows)} rows · {foreignKeys} fk
            </span>
          </span>
          <span className="flex items-center gap-1.5 rounded border border-emerald-500/15 bg-emerald-500/[0.035] px-2 py-1">
            <Zap className="h-2.5 w-2.5 text-emerald-400" />
            <span className="font-mono text-[8.5px] uppercase tracking-[0.06em] text-emerald-400/90">engine ready</span>
          </span>
          <span className="hidden items-center gap-1.5 text-slate-600 xl:flex">
            <span className="font-mono text-[8px]">⌘↵</span>
            <span className="font-mono text-[8px]">execute</span>
          </span>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1">
        <div className="hidden shrink-0 lg:flex">
          <SchemaExplorer
            tables={tables}
            onSelectTable={handleSelectTable}
            onCreateTable={handleCreateTable}
          />
        </div>

        {sidebarOpen && (
          <div className="fixed inset-0 z-[60] flex lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-[#03060c]/75 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close schema explorer"
            />
            <div className="relative z-10 h-full animate-slide-in-left">
              <SchemaExplorer
                tables={tables}
                onSelectTable={handleSelectTable}
                onCreateTable={handleCreateTable}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={cn("min-h-0 flex-1", view === "studio" ? "flex" : "hidden")}>
            <SqlEditor
              key={editorKey}
              tables={tables}
              insertSnippet={snippet}
              onSnippetApplied={() => setSnippet(null)}
              notify={notify}
            />
          </div>
          <div className={cn("min-h-0 flex-1", view === "designer" ? "flex" : "hidden")}>
            <ErdVisualizer tables={tables} onCommitBlueprint={handleCommitBlueprint} notify={notify} />
          </div>
        </main>
      </div>

      <footer className="flex h-[25px] shrink-0 items-center gap-3 border-t border-[#172235] bg-[#080d17] px-3 font-mono text-[8px] text-slate-600">
        <span className="flex items-center gap-1.5 text-emerald-400/90">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          Ready
        </span>
        <span className="h-2.5 w-px bg-[#233148]" />
        <span className="flex items-center gap-1 text-slate-500">
          <Database className="h-2.5 w-2.5" />
          local_workspace.db
        </span>
        <span className="hidden sm:inline">main · 0 pending writes</span>
        <span className="hidden items-center gap-1 md:flex">
          <FileUp className="h-2.5 w-2.5" />
          import: csv/json
        </span>
        <span className="hidden md:inline">sqlite-compatible · read-only select engine</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-1 sm:flex">
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-500/80" />
            sovereign local-first
          </span>
          <span className="h-2.5 w-px bg-[#233148]" />
          <span>UTF-8</span>
          <span className="text-slate-700">v1.0.0</span>
        </div>
      </footer>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        tables={tables}
        onImport={handleImport}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
