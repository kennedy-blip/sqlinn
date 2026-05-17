import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import type { CellValue } from "@/lib/database";
import type { QueryResult } from "@/lib/sql";
import { cn } from "@/utils/cn";

interface ResultsGridProps {
  result: QueryResult;
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
  paid: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
  completed: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-300",
  suspended: "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
  refunded: "border-amber-500/20 bg-amber-500/[0.08] text-amber-300",
  archived: "border-slate-500/20 bg-slate-500/[0.08] text-slate-400",
  trial: "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
  pending: "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
  running: "border-sky-500/20 bg-sky-500/[0.08] text-sky-300",
  Enterprise: "border-violet-500/20 bg-violet-500/[0.08] text-violet-300",
  Team: "border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-300",
  Pro: "border-sky-500/20 bg-sky-500/[0.06] text-sky-300",
  Free: "border-slate-600/30 bg-slate-600/[0.08] text-slate-400",
};

function Cell({ value, type }: { value: CellValue; type?: string }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/[0.07] px-1.5 py-[1px] font-mono text-[8.5px] font-medium uppercase tracking-wider text-amber-300/80">
        null
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="font-mono text-[11px] tabular-nums text-slate-300">
        {Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return <span className="font-mono text-[11px] text-violet-300">{value ? "true" : "false"}</span>;
  }
  if (STATUS_STYLES[value]) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded border px-1.5 py-[1px] text-[9.5px] font-medium",
          STATUS_STYLES[value],
        )}
      >
        <span className="h-1 w-1 rounded-full bg-current opacity-80" />
        {value}
      </span>
    );
  }
  if (type === "BLOB") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-amber-200/80">
        <span className="rounded-sm border border-amber-500/20 bg-amber-500/[0.06] px-1 text-[7px] font-semibold uppercase text-amber-400">
          blob
        </span>
        <span className="truncate">{String(value)}</span>
      </span>
    );
  }
  return (
    <span className="block truncate font-mono text-[11px] text-slate-300" title={String(value)}>
      {String(value)}
    </span>
  );
}

export function ResultsGrid({ result }: ResultsGridProps) {
  const [sort, setSort] = useState<{ index: number; direction: "asc" | "desc" } | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setSort(null);
    setFilter("");
  }, [result]);

  const filteredRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const indexes = result.rows
      .map((_row, index) => index)
      .filter((index) => {
        if (!needle) return true;
        return result.rows[index].some((cell) => String(cell ?? "null").toLowerCase().includes(needle));
      });

    if (!sort) return indexes;

    return [...indexes].sort((a, b) => {
      const left = result.rows[a][sort.index];
      const right = result.rows[b][sort.index];
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [filter, result, sort]);

  const toggleSort = (index: number) => {
    setSort((current) => {
      if (!current || current.index !== index) return { index, direction: "asc" };
      if (current.direction === "asc") return { index, direction: "desc" };
      return null;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-[#182334] bg-[#0a121e]/60 px-3">
        <div className="relative min-w-0 max-w-[230px] flex-1">
          <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter returned rows…"
            className="h-[23px] w-full rounded border border-[#1b293c] bg-[#080f19] pl-6 pr-2 text-[10px] text-slate-300 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/30"
            aria-label="Filter result rows"
          />
        </div>
        <span className="hidden items-center gap-1 font-mono text-[9px] text-slate-600 sm:flex">
          <SlidersHorizontal className="h-2.5 w-2.5" />
          click a header to sort
        </span>
        <span className="ml-auto font-mono text-[9px] text-slate-500">
          {filteredRows.length === result.rows.length ? result.rows.length : `${filteredRows.length} / ${result.rows.length}`} rows
        </span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#0c1522]">
            <tr>
              <th className="sticky left-0 z-20 w-[42px] min-w-[42px] border-b border-r border-[#1b283b] bg-[#0c1522] px-2 py-[7px] text-right font-mono text-[8.5px] font-normal text-slate-600">
                #
              </th>
              {result.columns.map((column, index) => {
                const active = sort?.index === index;
                return (
                  <th
                    key={column.key}
                    className="min-w-[128px] whitespace-nowrap border-b border-r border-[#182436] bg-[#0c1522] px-2.5 py-[6px] last:border-r-0"
                    style={{ maxWidth: 320 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(index)}
                      className="group flex w-full items-center gap-1.5 text-left"
                    >
                      <span className={cn("font-mono text-[9.5px] font-medium", active ? "text-cyan-300" : "text-slate-300")}>
                        {column.label}
                      </span>
                      {active ? (
                        sort?.direction === "asc" ? (
                          <ArrowUp className="h-2.5 w-2.5 text-cyan-400" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5 text-cyan-400" />
                        )
                      ) : (
                        <ArrowUpDown className="h-2.5 w-2.5 text-slate-700 opacity-0 transition group-hover:opacity-100" />
                      )}
                      <span className="ml-auto font-mono text-[7px] uppercase tracking-[0.08em] text-slate-600">
                        {column.type ?? (column.label === "id" ? "INTEGER" : "")}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((rowIndex, displayIndex) => {
              const row = result.rows[rowIndex];
              return (
                <tr key={rowIndex} className="group/row">
                  <td className="sticky left-0 z-[5] border-b border-r border-[#151f2f] bg-[#0a121d] px-2 py-[6px] text-right font-mono text-[9px] text-slate-700 group-hover/row:bg-[#0d1826] group-hover/row:text-slate-500">
                    {displayIndex + 1}
                  </td>
                  {result.columns.map((column, index) => (
                    <td
                      key={column.key}
                      className="max-w-[340px] overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-[#141f2e] px-2.5 py-[6px] transition group-hover/row:bg-cyan-500/[0.025] last:border-r-0"
                    >
                      <Cell value={row[index]} type={column.type} />
                    </td>
                  ))}
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={result.columns.length + 1} className="py-12 text-center">
                  <p className="text-[11px] text-slate-500">No rows match “{filter}”.</p>
                  <button
                    type="button"
                    onClick={() => setFilter("")}
                    className="mt-2 font-mono text-[9.5px] text-cyan-400 hover:text-cyan-300"
                  >
                    clear filter
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
