import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Download,
  KeyRound,
  Link2,
  Maximize2,
  Minus,
  Network,
  Plus,
  Table2,
  ZoomIn,
} from "lucide-react";
import { generateSqlDump, type TableDef } from "@/lib/database";
import { downloadText } from "@/lib/io";
import { cn } from "@/utils/cn";
import {
  blueprintFromTable,
  createBlueprint,
  TableBuilder,
  type TableBlueprint,
} from "./TableBuilder";
import { SectionLabel } from "./ui";

interface ErdVisualizerProps {
  tables: TableDef[];
  onCommitBlueprint: (table: TableDef, originalName: string | null) => boolean;
  notify: (message: string, detail?: string) => void;
}

interface Position {
  x: number;
  y: number;
}

const NODE_WIDTH = 244;
const NODE_HEADER = 38;
const ROW_HEIGHT = 22;

const PRESET_POSITIONS: Record<string, Position> = {
  users: { x: 38, y: 62 },
  api_logs: { x: 382, y: 22 },
  embeddings_meta: { x: 382, y: 316 },
};

function fallbackPosition(index: number): Position {
  return { x: 38 + (index % 2) * 340, y: 440 + Math.floor(index / 2) * 200 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function ErdVisualizer({ tables, onCommitBlueprint, notify }: ErdVisualizerProps) {
  const [draft, setDraft] = useState<TableBlueprint>(() => createBlueprint(tables));
  const [editingName, setEditingName] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [positions, setPositions] = useState<Record<string, Position>>(() => ({ ...PRESET_POSITIONS }));
  const [drag, setDrag] = useState<{
    name: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const positionFor = (table: TableDef, index: number): Position =>
    positions[table.name] ?? fallbackPosition(index);

  const canvas = useMemo(() => {
    const maxX = tables.reduce((max, table, index) => Math.max(max, positionFor(table, index).x + NODE_WIDTH), 650);
    const maxY = tables.reduce(
      (max, table, index) =>
        Math.max(max, positionFor(table, index).y + NODE_HEADER + table.columns.length * ROW_HEIGHT),
      640,
    );
    return { width: Math.max(680, maxX + 48), height: Math.max(610, maxY + 110) };
  }, [positions, tables]);

  const relationships = useMemo(
    () =>
      tables.flatMap((table, tableIndex) =>
        table.columns
          .filter((column) => column.foreignKey)
          .map((column) => ({
            id: `${table.name}.${column.name}`,
            from: table.name,
            fromColumn: column.name,
            fromIndex: tableIndex,
            to: column.foreignKey?.table ?? "",
            toColumn: column.foreignKey?.column ?? "",
          })),
      ),
    [tables],
  );

  useEffect(() => {
    if (!drag) return;
    const handleMove = (event: PointerEvent) => {
      setPositions((current) => ({
        ...current,
        [drag.name]: {
          x: clamp(drag.originX + (event.clientX - drag.startX) / zoom, 4, canvas.width - NODE_WIDTH - 4),
          y: clamp(drag.originY + (event.clientY - drag.startY) / zoom, 4, canvas.height - 100),
        },
      }));
    };
    const handleUp = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, zoom, canvas.height, canvas.width]);

  const selectTable = (table: TableDef) => {
    setSelected(table.name);
    setEditingName(table.name);
    setDraft(blueprintFromTable(table));
  };

  const newDraft = () => {
    setSelected(null);
    setEditingName(null);
    setDraft(createBlueprint(tables));
  };

  const handleCommit = (table: TableDef, originalName: string | null): boolean => {
    const success = onCommitBlueprint(table, originalName);
    if (success) {
      setEditingName(table.name);
      setSelected(table.name);
      setDraft(blueprintFromTable(table));
    }
    return success;
  };

  const exportSchema = () => {
    downloadText("querypulse_schema.sql", generateSqlDump(tables, false), "text/sql");
    notify("Schema DDL exported", `${tables.length} CREATE TABLE statements downloaded.`);
  };

  const foreignKeyCount = relationships.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
      <div className="flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden xl:min-h-0">
        <div className="flex h-[42px] shrink-0 items-center gap-2 border-b border-[#172235] bg-[#080f19] px-3">
          <Network className="h-3.5 w-3.5 text-violet-400" />
          <SectionLabel className="text-slate-400">Relationship map</SectionLabel>
          <span className="rounded border border-[#243247] bg-[#0b1624] px-1.5 py-[1px] font-mono text-[8px] text-slate-500">
            {tables.length} entities
          </span>
          <span className="hidden h-3 w-px bg-[#263449] md:block" />
          <span className="hidden items-center gap-1.5 text-[9px] text-slate-600 md:flex">
            <span className="flex gap-[2px]">
              <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
              <span className="h-1 w-1 rounded-full bg-violet-400/70" />
            </span>
            drag headers to arrange
          </span>

          <div className="ml-auto flex items-center gap-1">
            <div className="flex h-[25px] items-center rounded border border-[#243247] bg-[#0b1522]">
              <button
                type="button"
                onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2))))}
                className="flex h-full w-[23px] items-center justify-center text-slate-500 transition hover:text-slate-200"
                aria-label="Zoom out"
              >
                <Minus className="h-2.5 w-2.5" />
              </button>
              <span className="w-[34px] text-center font-mono text-[8.5px] text-slate-500">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((current) => Math.min(1.4, Number((current + 0.1).toFixed(2))))}
                className="flex h-full w-[23px] items-center justify-center text-slate-500 transition hover:text-slate-200"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-2.5 w-2.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setZoom(0.9)}
              className="flex h-[25px] w-[25px] items-center justify-center rounded border border-[#243247] bg-[#0b1522] text-slate-500 transition hover:text-cyan-300"
              aria-label="Fit diagram"
              title="Fit diagram"
            >
              <Maximize2 className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={newDraft}
              className="flex h-[25px] items-center gap-1.5 rounded border border-[#26364c] bg-[#0b1522] px-2 text-[9.5px] font-medium text-slate-400 transition hover:border-violet-500/30 hover:text-violet-300"
            >
              <Plus className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">New table</span>
            </button>
            <button
              type="button"
              onClick={exportSchema}
              className="flex h-[25px] items-center gap-1.5 rounded border border-cyan-500/20 bg-cyan-500/[0.06] px-2 text-[9.5px] font-medium text-cyan-300 transition hover:border-cyan-400/35 hover:bg-cyan-500/[0.1]"
            >
              <Download className="h-2.5 w-2.5" />
              <span className="hidden md:inline">Export DDL</span>
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#070b13]">
          <div className="erd-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#070b13]/60 to-transparent" />

          <div className="scroll-thin relative h-full w-full overflow-auto">
            <div
              className="relative"
              style={{ width: canvas.width * zoom, height: canvas.height * zoom, minWidth: "100%", minHeight: "100%" }}
            >
              <div
                className="relative origin-top-left"
                style={{ width: canvas.width, height: canvas.height, transform: `scale(${zoom})` }}
              >
                <svg
                  className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
                  width={canvas.width}
                  height={canvas.height}
                  aria-hidden="true"
                >
                  <defs>
                    <marker id="erd-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#8b5cf6" opacity="0.85" />
                    </marker>
                    <filter id="line-glow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {relationships.map((relationship) => {
                    const fromTable = tables.find((table) => table.name === relationship.from);
                    const toTable = tables.find((table) => table.name === relationship.to);
                    if (!fromTable || !toTable) return null;
                    const fromPosition = positionFor(fromTable, relationship.fromIndex);
                    const toIndex = tables.findIndex((table) => table.name === toTable.name);
                    const toPosition = positionFor(toTable, toIndex);
                    const fromColumnIndex = fromTable.columns.findIndex((column) => column.name === relationship.fromColumn);
                    const toColumnIndex = toTable.columns.findIndex((column) => column.name === relationship.toColumn);
                    const sourceOnLeft = fromPosition.x + NODE_WIDTH > toPosition.x;
                    const startX = sourceOnLeft ? fromPosition.x : fromPosition.x + NODE_WIDTH;
                    const endX = sourceOnLeft ? toPosition.x + NODE_WIDTH : toPosition.x;
                    const startY = fromPosition.y + NODE_HEADER + Math.max(0, fromColumnIndex) * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const endY = toPosition.y + NODE_HEADER + Math.max(0, toColumnIndex) * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const distance = Math.max(58, Math.abs(endX - startX) * 0.48);
                    const controlOne = startX + (sourceOnLeft ? -distance : distance);
                    const controlTwo = endX + (sourceOnLeft ? distance : -distance);
                    const highlighted = selected === relationship.from || selected === relationship.to;
                    return (
                      <g key={relationship.id}>
                        <path
                          d={`M ${startX} ${startY} C ${controlOne} ${startY}, ${controlTwo} ${endY}, ${endX} ${endY}`}
                          fill="none"
                          stroke={highlighted ? "#a78bfa" : "#8b5cf6"}
                          strokeWidth={highlighted ? 1.6 : 1.1}
                          strokeOpacity={highlighted ? 0.95 : 0.42}
                          markerEnd="url(#erd-arrow)"
                          filter={highlighted ? "url(#line-glow)" : undefined}
                        />
                        <circle cx={startX} cy={startY} r={2.6} fill="#070b13" stroke={highlighted ? "#a78bfa" : "#8b5cf6"} strokeWidth="1.2" />
                        <text
                          x={(startX + endX) / 2}
                          y={(startY + endY) / 2 - 4}
                          textAnchor="middle"
                          fill={highlighted ? "#c4b5fd" : "#7c6aa2"}
                          fontSize="7.5"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {relationship.toColumn}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {tables.map((table, index) => {
                  const position = positionFor(table, index);
                  const accent =
                    table.name === "users"
                      ? { line: "from-cyan-400 to-emerald-400", icon: "text-cyan-400", bg: "bg-cyan-500/[0.07]", border: "border-cyan-500/20" }
                      : table.name === "api_logs"
                        ? { line: "from-violet-400 to-fuchsia-400", icon: "text-violet-400", bg: "bg-violet-500/[0.07]", border: "border-violet-500/20" }
                        : table.name === "embeddings_meta"
                          ? { line: "from-emerald-400 to-teal-400", icon: "text-emerald-400", bg: "bg-emerald-500/[0.07]", border: "border-emerald-500/20" }
                          : { line: "from-amber-400 to-orange-400", icon: "text-amber-400", bg: "bg-amber-500/[0.07]", border: "border-amber-500/20" };
                  const isSelected = selected === table.name;
                  return (
                    <div
                      key={table.name}
                      className={cn(
                        "absolute z-10 select-none overflow-hidden rounded-lg border bg-[#0a1320]/95 shadow-[0_16px_38px_rgba(0,0,0,0.32)] transition-shadow",
                        isSelected ? "border-cyan-400/45 shadow-[0_0_0_1px_rgba(6,182,212,0.12),0_20px_44px_rgba(0,0,0,0.45)]" : "border-[#213046] hover:border-[#32465f]",
                      )}
                      style={{ left: position.x, top: position.y, width: NODE_WIDTH }}
                      onClick={() => selectTable(table)}
                    >
                      <div className={cn("absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r", accent.line)} />
                      <div
                        className={cn("flex cursor-grab items-center gap-2 border-b border-[#1a2739] bg-[#0c1725] px-2.5 pb-2 pt-[10px]", drag?.name === table.name && "cursor-grabbing")}
                        onPointerDown={(event) => {
                          if ((event.target as HTMLElement).closest("button")) return;
                          event.preventDefault();
                          setSelected(table.name);
                          setDrag({
                            name: table.name,
                            startX: event.clientX,
                            startY: event.clientY,
                            originX: position.x,
                            originY: position.y,
                          });
                        }}
                      >
                        <span className={cn("flex h-[22px] w-[22px] items-center justify-center rounded border", accent.border, accent.bg)}>
                          <Table2 className={cn("h-3 w-3", accent.icon)} />
                        </span>
                        <span className="truncate font-mono text-[11px] font-medium text-slate-200">{table.name}</span>
                        <span className="ml-auto rounded border border-[#263449] bg-[#09121d] px-1.5 py-[1px] font-mono text-[7.5px] text-slate-500">
                          {table.rows.length.toLocaleString()} rows
                        </span>
                      </div>
                      <div className="py-1">
                        {table.columns.map((column, columnIndex) => (
                          <div
                            key={column.name}
                            className={cn(
                              "flex h-[22px] items-center gap-1.5 px-2.5 transition",
                              column.primaryKey
                                ? "bg-cyan-500/[0.035]"
                                : column.foreignKey
                                  ? "bg-violet-500/[0.035]"
                                  : columnIndex % 2 === 0
                                    ? "bg-white/[0.006]"
                                    : "",
                            )}
                          >
                            {column.primaryKey ? (
                              <KeyRound className="h-[10px] w-[10px] shrink-0 text-cyan-400" />
                            ) : column.foreignKey ? (
                              <Link2 className="h-[10px] w-[10px] shrink-0 text-violet-400" />
                            ) : (
                              <span className="ml-[2px] h-[3px] w-[3px] shrink-0 rounded-full bg-slate-700" />
                            )}
                            <span className={cn("truncate font-mono text-[9px]", column.primaryKey ? "text-cyan-200" : column.foreignKey ? "text-violet-200" : "text-slate-400")}>
                              {column.name}
                            </span>
                            {column.primaryKey && (
                              <span className="rounded border border-cyan-500/20 bg-cyan-500/[0.07] px-[2px] font-mono text-[6px] font-semibold text-cyan-400">PK</span>
                            )}
                            {column.foreignKey && (
                              <span className="rounded border border-violet-500/20 bg-violet-500/[0.08] px-[2px] font-mono text-[6px] font-semibold text-violet-400">FK</span>
                            )}
                            <span className="ml-auto shrink-0 font-mono text-[7px] uppercase tracking-wide text-slate-600">{column.type}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          selectTable(table);
                        }}
                        className="flex h-[22px] w-full items-center gap-1 border-t border-[#172235] bg-[#09121c] px-2.5 font-mono text-[7.5px] text-slate-600 transition hover:bg-[#0d1826] hover:text-cyan-300"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        edit schema
                        <ArrowUpRight className="ml-auto h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={newDraft}
                  className="absolute z-10 flex w-[244px] items-center gap-2.5 rounded-lg border border-dashed border-[#2a3b51] bg-[#0a1320]/50 p-3 text-left transition hover:border-violet-400/35 hover:bg-violet-500/[0.04]"
                  style={{ left: 38, top: Math.min(canvas.height - 82, 455) }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#2c3d54] bg-[#0c1725] text-slate-500">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    <span className="block text-[10px] font-medium text-slate-400">Draft a new relation</span>
                    <span className="mt-0.5 block font-mono text-[7.5px] text-slate-600">columns · keys · constraints</span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-20 hidden items-center gap-3 rounded-md border border-[#1c2b3d] bg-[#080f19]/90 px-2.5 py-1.5 shadow-lg backdrop-blur sm:flex">
            <span className="flex items-center gap-1 font-mono text-[8px] text-slate-500">
              <KeyRound className="h-2.5 w-2.5 text-cyan-400" />
              primary
            </span>
            <span className="flex items-center gap-1 font-mono text-[8px] text-slate-500">
              <Link2 className="h-2.5 w-2.5 text-violet-400" />
              foreign · {foreignKeyCount}
            </span>
            <span className="h-2.5 w-px bg-[#263449]" />
            <span className="font-mono text-[8px] text-slate-600">local schema</span>
          </div>

          <div className="pointer-events-none absolute bottom-2.5 right-2.5 z-20 hidden rounded-md border border-[#1c2b3d] bg-[#080f19]/90 px-2.5 py-1.5 font-mono text-[8px] text-slate-600 shadow-lg backdrop-blur md:block">
            in-memory schema · no network
          </div>
        </div>
      </div>

      <TableBuilder
        draft={draft}
        editingName={editingName}
        tables={tables}
        onChange={setDraft}
        onCommit={handleCommit}
        onNewDraft={newDraft}
        notify={notify}
      />
    </div>
  );
}
