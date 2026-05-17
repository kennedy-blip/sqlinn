import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Database,
  KeyRound,
  Link2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  tableDdl,
  type ColumnDef,
  type ColumnType,
  type ForeignKey,
  type TableDef,
} from "@/lib/database";
import { cn } from "@/utils/cn";
import { HighlightedSql } from "./CodeEditor";
import { SectionLabel } from "./ui";

export interface BlueprintColumn {
  id: string;
  name: string;
  type: ColumnType;
  primaryKey: boolean;
  nullable: boolean;
  foreignKey: ForeignKey | null;
  defaultValue?: string;
}

export interface TableBlueprint {
  name: string;
  columns: BlueprintColumn[];
}

interface TableBuilderProps {
  draft: TableBlueprint;
  editingName: string | null;
  tables: TableDef[];
  onChange: (draft: TableBlueprint) => void;
  onCommit: (table: TableDef, originalName: string | null) => boolean;
  onNewDraft: () => void;
  notify: (message: string, detail?: string) => void;
}

const TYPES: ColumnType[] = ["INTEGER", "TEXT", "REAL", "BLOB"];

function nextColumnId(): string {
  return `col-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBlueprint(tables: TableDef[]): TableBlueprint {
  const reference = tables[0];
  return {
    name: "new_table",
    columns: [
      { id: nextColumnId(), name: "id", type: "INTEGER", primaryKey: true, nullable: false, foreignKey: null },
      {
        id: nextColumnId(),
        name: "record_name",
        type: "TEXT",
        primaryKey: false,
        nullable: true,
        foreignKey: reference
          ? { table: reference.name, column: reference.columns.find((column) => column.primaryKey)?.name ?? reference.columns[0].name }
          : null,
      },
      { id: nextColumnId(), name: "metric_value", type: "REAL", primaryKey: false, nullable: true, foreignKey: null },
      { id: nextColumnId(), name: "created_at", type: "TEXT", primaryKey: false, nullable: true, foreignKey: null },
    ],
  };
}

export function blueprintFromTable(table: TableDef): TableBlueprint {
  return {
    name: table.name,
    columns: table.columns.map((column) => ({
      id: nextColumnId(),
      name: column.name,
      type: column.type,
      primaryKey: Boolean(column.primaryKey),
      nullable: column.nullable !== false && !column.primaryKey,
      foreignKey: column.foreignKey ?? null,
      defaultValue: column.defaultValue,
    })),
  };
}

function cleanIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "_$&");
}

export function TableBuilder({ draft, editingName, tables, onChange, onCommit, onNewDraft, notify }: TableBuilderProps) {
  const [error, setError] = useState<string | null>(null);

  const toTable = (): TableDef => {
    const columns: ColumnDef[] = draft.columns.map((column) => ({
      name: cleanIdentifier(column.name) || "column",
      type: column.type,
      primaryKey: column.primaryKey || undefined,
      nullable: column.primaryKey ? false : column.nullable,
      foreignKey: column.foreignKey ?? undefined,
      defaultValue: column.defaultValue,
    }));
    return { name: cleanIdentifier(draft.name) || "new_table", columns, rows: [], description: "Designed in schema studio" };
  };

  const ddl = useMemo(() => tableDdl(toTable()), [draft]);
  const foreignKeyCount = draft.columns.filter((column) => column.foreignKey).length;

  const updateColumn = (id: string, patch: Partial<BlueprintColumn>) => {
    setError(null);
    onChange({
      ...draft,
      columns: draft.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
    });
  };

  const addColumn = () => {
    setError(null);
    const index = draft.columns.length + 1;
    onChange({
      ...draft,
      columns: [
        ...draft.columns,
        {
          id: nextColumnId(),
          name: `column_${index}`,
          type: "TEXT",
          primaryKey: false,
          nullable: true,
          foreignKey: null,
        },
      ],
    });
  };

  const removeColumn = (id: string) => {
    if (draft.columns.length === 1) {
      setError("A table needs at least one column.");
      return;
    }
    setError(null);
    onChange({ ...draft, columns: draft.columns.filter((column) => column.id !== id) });
  };

  const toggleForeignKey = (column: BlueprintColumn) => {
    if (column.foreignKey) {
      updateColumn(column.id, { foreignKey: null });
      return;
    }
    const candidates = tables.filter((table) => table.name !== draft.name);
    const target = candidates[0];
    if (!target) {
      setError("Commit another table before defining a foreign key.");
      return;
    }
    const targetColumn = target.columns.find((candidate) => candidate.primaryKey) ?? target.columns[0];
    updateColumn(column.id, { foreignKey: { table: target.name, column: targetColumn.name } });
  };

  const updateForeignKey = (column: BlueprintColumn, value: string) => {
    const [tableName, columnName] = value.split(".");
    const table = tables.find((candidate) => candidate.name === tableName);
    const targetColumn = table?.columns.find((candidate) => candidate.name === columnName);
    if (!table || !targetColumn) return;
    updateColumn(column.id, { foreignKey: { table: table.name, column: targetColumn.name } });
  };

  const copyDdl = async () => {
    try {
      await navigator.clipboard.writeText(ddl);
      notify("DDL copied to clipboard", `${toTable().name} schema is ready to paste.`);
    } catch {
      notify("Clipboard unavailable", "Select the DDL and copy it manually.");
    }
  };

  const commit = () => {
    const table = toTable();
    if (!cleanIdentifier(draft.name)) {
      setError("Give the table a valid name using letters, numbers, or underscores.");
      return;
    }
    if (!table.columns.length) {
      setError("Add at least one column before committing.");
      return;
    }
    const names = table.columns.map((column) => column.name);
    if (new Set(names).size !== names.length) {
      setError("Column names must be unique inside a table.");
      return;
    }
    if (table.columns.every((column) => !column.primaryKey)) {
      setError("Mark one column as the primary key before committing.");
      return;
    }
    const duplicate = tables.some(
      (existing) =>
        existing.name.toLowerCase() === table.name.toLowerCase() &&
        existing.name.toLowerCase() !== (editingName ?? "").toLowerCase(),
    );
    if (duplicate) {
      setError(`A table named "${table.name}" already exists in main.`);
      return;
    }
    const success = onCommit(table, editingName);
    if (!success) {
      setError("The blueprint could not be committed. Check for naming collisions.");
      return;
    }
    setError(null);
  };

  const availableReferenceTables = tables.filter((table) => table.name !== draft.name);

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-t border-[#1a2739] bg-[#080f19] xl:w-[354px] xl:border-l xl:border-t-0">
      <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-[#141e2e] px-3">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded border border-violet-500/20 bg-violet-500/[0.08]">
          <Code2 className="h-3 w-3 text-violet-300" />
        </span>
        <SectionLabel className="text-slate-300">Table blueprint</SectionLabel>
        <span className="ml-auto rounded border border-[#263449] bg-[#0c1624] px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-wider text-slate-500">
          {editingName ? "editing" : "new"}
        </span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-[#141f2f] p-3">
          <div className="flex items-center gap-2 rounded-md border border-[#223148] bg-[#0a1420] px-2 focus-within:border-cyan-500/40">
            <Database className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <input
              value={draft.name}
              onChange={(event) => {
                setError(null);
                onChange({ ...draft, name: event.target.value });
              }}
              className="h-[33px] min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-slate-200 outline-none placeholder:text-slate-600"
              placeholder="table_name"
              aria-label="Table name"
            />
            <span className="shrink-0 font-mono text-[8px] uppercase text-slate-600">main</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-600">
            <Link2 className="h-2.5 w-2.5 text-violet-400/70" />
            {foreignKeyCount} foreign {foreignKeyCount === 1 ? "key" : "keys"} · {draft.columns.length} columns
          </p>
        </div>

        <div className="p-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Columns</SectionLabel>
            <button
              type="button"
              onClick={addColumn}
              className="flex items-center gap-1 rounded border border-dashed border-[#2a3a50] px-1.5 py-[3px] text-[8.5px] font-medium text-slate-500 transition hover:border-cyan-500/30 hover:text-cyan-300"
            >
              <Plus className="h-2.5 w-2.5" />
              Add
            </button>
          </div>

          <div className="mt-2 space-y-1.5">
            {draft.columns.map((column) => (
              <div
                key={column.id}
                className="rounded-md border border-[#1c2a3d] bg-[#0a1420]/80 p-1.5 transition hover:border-[#273a52]"
              >
                <div className="flex items-center gap-1">
                  {column.primaryKey ? (
                    <KeyRound className="h-3 w-3 shrink-0 text-cyan-400" />
                  ) : column.foreignKey ? (
                    <Link2 className="h-3 w-3 shrink-0 text-violet-400" />
                  ) : (
                    <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full border border-slate-600" />
                  )}
                  <input
                    value={column.name}
                    onChange={(event) => updateColumn(column.id, { name: event.target.value })}
                    className="h-[23px] min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 font-mono text-[10.5px] text-slate-200 outline-none transition hover:bg-[#0d1826] focus:border-cyan-500/25 focus:bg-[#0a1522]"
                    aria-label="Column name"
                  />
                  <select
                    value={column.type}
                    onChange={(event) => updateColumn(column.id, { type: event.target.value as ColumnType })}
                    className="h-[23px] shrink-0 rounded border border-[#243449] bg-[#0b1624] px-1 font-mono text-[8.5px] text-slate-400 outline-none focus:border-cyan-500/30"
                    aria-label="Column type"
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeColumn(column.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-600 transition hover:bg-amber-500/10 hover:text-amber-400"
                    aria-label={`Remove ${column.name}`}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>

                <div className="mt-1 flex items-center gap-1 pl-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      updateColumn(column.id, {
                        primaryKey: !column.primaryKey,
                        nullable: column.primaryKey ? column.nullable : false,
                      })
                    }
                    className={cn(
                      "flex h-[17px] items-center gap-1 rounded border px-1 font-mono text-[7.5px] font-semibold uppercase tracking-wider transition",
                      column.primaryKey
                        ? "border-cyan-500/25 bg-cyan-500/[0.09] text-cyan-300"
                        : "border-[#263449] bg-transparent text-slate-600 hover:text-slate-400",
                    )}
                  >
                    <KeyRound className="h-2.5 w-2.5" />
                    PK
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleForeignKey(column)}
                    className={cn(
                      "flex h-[17px] items-center gap-1 rounded border px-1 font-mono text-[7.5px] font-semibold uppercase tracking-wider transition",
                      column.foreignKey
                        ? "border-violet-500/25 bg-violet-500/[0.09] text-violet-300"
                        : "border-[#263449] bg-transparent text-slate-600 hover:text-slate-400",
                    )}
                  >
                    <Link2 className="h-2.5 w-2.5" />
                    FK
                  </button>
                  <button
                    type="button"
                    onClick={() => updateColumn(column.id, { nullable: !column.nullable })}
                    className={cn(
                      "flex h-[17px] items-center rounded border px-1 font-mono text-[7.5px] uppercase tracking-wider transition",
                      column.nullable
                        ? "border-amber-500/20 bg-amber-500/[0.05] text-amber-400/90"
                        : "border-[#263449] bg-[#0d1725] text-slate-500",
                    )}
                    title="Toggle nullability"
                  >
                    {column.nullable ? "null" : "not null"}
                  </button>
                  <span className="ml-auto font-mono text-[7.5px] text-slate-700">C{String(draft.columns.indexOf(column) + 1).padStart(2, "0")}</span>
                </div>

                {column.foreignKey && (
                  <div className="mt-1 flex items-center gap-1.5 pl-0.5">
                    <span className="font-mono text-[8px] text-violet-400/70">references</span>
                    <select
                      value={`${column.foreignKey.table}.${column.foreignKey.column}`}
                      onChange={(event) => updateForeignKey(column, event.target.value)}
                      className="h-[20px] min-w-0 flex-1 rounded border border-violet-500/15 bg-[#0b1421] px-1 font-mono text-[8.5px] text-violet-300 outline-none focus:border-violet-400/40"
                      aria-label="Foreign key target"
                    >
                      {availableReferenceTables.map((table) =>
                        table.columns.map((candidate) => (
                          <option key={`${table.name}.${candidate.name}`} value={`${table.name}.${candidate.name}`}>
                            {table.name}.{candidate.name}
                          </option>
                        )),
                      )}
                    </select>
                    <ArrowUpRight className="h-2.5 w-2.5 text-violet-500" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-2 rounded border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-[9px] leading-relaxed text-amber-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <div className="overflow-hidden rounded-md border border-[#1b2a3d] bg-[#070e17]">
            <div className="flex h-[27px] items-center gap-1.5 border-b border-[#182436] bg-[#0a1420] px-2">
              <Code2 className="h-2.5 w-2.5 text-cyan-400" />
              <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">generated ddl</span>
              <button
                type="button"
                onClick={copyDdl}
                className="ml-auto flex h-[18px] items-center gap-1 rounded border border-[#263449] bg-[#0c1725] px-1 text-[8px] text-slate-500 transition hover:text-cyan-300"
              >
                <Copy className="h-2 w-2" />
                copy
              </button>
            </div>
            <HighlightedSql sql={ddl} className="scroll-thin max-h-[132px] overflow-auto px-2 py-2 text-[9px]" />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#172235] bg-[#080f19] p-2.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onNewDraft}
            className="flex h-[30px] w-[31px] shrink-0 items-center justify-center rounded-md border border-[#263449] bg-[#0b1624] text-slate-500 transition hover:border-[#344962] hover:text-slate-200"
            title="Start a clean blueprint"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={commit}
            className="flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-300/20 bg-gradient-to-b from-emerald-400 to-emerald-500 text-[10px] font-semibold text-[#04120d] shadow-[0_0_20px_rgba(16,185,129,0.12)] transition hover:from-emerald-300 hover:to-emerald-400"
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            Commit to workspace
          </button>
        </div>
        <p className="mt-1.5 text-center font-mono text-[7.5px] uppercase tracking-[0.1em] text-slate-700">
          sqlite dialect · in-memory
        </p>
      </div>
    </aside>
  );
}
