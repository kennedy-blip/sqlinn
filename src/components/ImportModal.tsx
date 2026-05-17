import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  FileJson,
  FileSpreadsheet,
  FileUp,
  ShieldCheck,
  Sparkles,
  Table2,
  UploadCloud,
  X,
} from "lucide-react";
import { formatCompact, type TableDef } from "@/lib/database";
import { inferNameFromFile, parseCsvTable, parseJsonTable, SAMPLE_CSV, SAMPLE_JSON } from "@/lib/io";
import { cn } from "@/utils/cn";
import { Modal, SectionLabel } from "./ui";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  tables: TableDef[];
  onImport: (table: TableDef) => void;
}

type ImportFormat = "csv" | "json";

function uniqueTableName(base: string, tables: TableDef[]): string {
  const names = new Set(tables.map((table) => table.name.toLowerCase()));
  if (!names.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (names.has(`${base}_${suffix}`.toLowerCase())) suffix += 1;
  return `${base}_${suffix}`;
}

export function ImportModal({ open, onClose, tables, onImport }: ImportModalProps) {
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [content, setContent] = useState("");
  const [tableName, setTableName] = useState("");
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    if (!content.trim()) return null;
    try {
      const table = format === "csv" ? parseCsvTable(content, tableName || "imported_data") : parseJsonTable(content, tableName || "imported_data");
      return { table, error: null as string | null };
    } catch (caught) {
      return { table: null, error: caught instanceof Error ? caught.message : "The file could not be parsed." };
    }
  }, [content, format, tableName]);

  const finalName = parsed?.table ? uniqueTableName(parsed.table.name, tables) : "";
  const byteSize = new Blob([content]).size;

  const reset = () => {
    setContent("");
    setFilename("");
    setTableName("");
    setError(null);
    setPasteOpen(false);
  };

  const readFile = async (file: File) => {
    if (file.size > 8_000_000) {
      setError("This demo importer accepts files up to 8 MB. Try a smaller local extract.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "json") {
      setError("Choose a .csv or .json file. Both formats stay inside your browser.");
      return;
    }
    setFormat(ext === "json" ? "json" : "csv");
    setFilename(file.name);
    setTableName(inferNameFromFile(file.name));
    setError(null);
    try {
      setContent(await file.text());
    } catch {
      setError("The file could not be read. Check its permissions and try again.");
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const loadSample = (kind: ImportFormat) => {
    setFormat(kind);
    setFilename(kind === "csv" ? "local_orders.csv" : "retrieval_experiments.json");
    setTableName(kind === "csv" ? "local_orders" : "experiments");
    setContent(kind === "csv" ? SAMPLE_CSV : SAMPLE_JSON);
    setError(null);
  };

  const handleImport = () => {
    if (!parsed?.table) return;
    onImport({ ...parsed.table, name: finalName });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} width="max-w-[760px]">
      <div className="flex items-start gap-3 border-b border-[#1b293c] bg-gradient-to-r from-[#0d1825] to-[#0a121d] px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-500/[0.08]">
          <FileUp className="h-4 w-4 text-cyan-300" />
        </span>
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-slate-100">Import a local dataset</h2>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
            CSV or JSON is parsed in memory and added to your sovereign workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded border border-transparent text-slate-500 transition hover:border-[#2a3a52] hover:bg-white/5 hover:text-slate-200"
          aria-label="Close import dialog"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="scroll-thin max-h-[calc(100vh-190px)] overflow-y-auto">
        <div className="grid gap-4 p-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-1 rounded-md border border-[#1e2c40] bg-[#0a1420] p-0.5">
              {(["csv", "json"] as ImportFormat[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    setFormat(kind);
                    setError(null);
                  }}
                  className={cn(
                    "flex h-[27px] flex-1 items-center justify-center gap-1.5 rounded text-[9.5px] font-medium transition",
                    format === kind
                      ? "border border-[#2a3a50] bg-[#101c2b] text-slate-200 shadow-sm"
                      : "border border-transparent text-slate-500 hover:text-slate-300",
                  )}
                >
                  {kind === "csv" ? <FileSpreadsheet className="h-3 w-3 text-emerald-400" /> : <FileJson className="h-3 w-3 text-cyan-400" />}
                  {kind.toUpperCase()}
                </button>
              ))}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={format === "csv" ? ".csv,text/csv" : ".json,application/json"}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
            />

            {content ? (
              <div className="mt-2.5 flex items-center gap-2.5 rounded-md border border-[#223148] bg-[#0a1522] p-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[#2a3a50] bg-[#0b1725]">
                  {format === "csv" ? <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> : <FileJson className="h-3.5 w-3.5 text-cyan-400" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10.5px] font-medium text-slate-200">{filename || "pasted_data." + format}</p>
                  <p className="mt-0.5 font-mono text-[8.5px] text-slate-600">
                    {format.toUpperCase()} · {byteSize > 1000 ? `${(byteSize / 1000).toFixed(1)} KB` : `${byteSize} B`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setContent("")}
                  className="flex h-5 w-5 items-center justify-center rounded text-slate-600 transition hover:bg-white/5 hover:text-slate-300"
                  aria-label="Remove selected file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  "mt-2.5 flex min-h-[152px] flex-col items-center justify-center rounded-md border border-dashed p-4 text-center transition",
                  dragging
                    ? "border-cyan-400/50 bg-cyan-500/[0.07]"
                    : "border-[#2a3b51] bg-[#0a1320]/60 hover:border-[#354a64] hover:bg-[#0b1624]",
                )}
              >
                <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#2a3b51] bg-[#0c1825]">
                  <UploadCloud className={cn("h-4 w-4", dragging ? "text-cyan-300" : "text-slate-500")} />
                </span>
                <p className="text-[10.5px] font-medium text-slate-300">
                  Drop your {format.toUpperCase()} here
                </p>
                <p className="mt-1 text-[9px] leading-relaxed text-slate-600">or choose a file from your machine · max 8 MB</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2.5 flex h-[24px] items-center gap-1.5 rounded border border-[#2d3d54] bg-[#0d1826] px-2 text-[9px] font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-300"
                >
                  <FileUp className="h-2.5 w-2.5" />
                  Choose file
                </button>
              </div>
            )}

            <div className="mt-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPasteOpen((current) => !current)}
                className="flex items-center gap-1 text-[9px] text-slate-500 transition hover:text-slate-300"
              >
                <Braces className="h-2.5 w-2.5" />
                Paste raw data
                <ChevronDown className={cn("h-2.5 w-2.5 transition", pasteOpen && "rotate-180")} />
              </button>
              <span className="ml-auto text-[8.5px] text-slate-600">need a sample?</span>
              <button
                type="button"
                onClick={() => loadSample("csv")}
                className="rounded border border-[#263449] bg-[#0b1522] px-1.5 py-[2px] font-mono text-[8px] text-slate-500 transition hover:text-emerald-300"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => loadSample("json")}
                className="rounded border border-[#263449] bg-[#0b1522] px-1.5 py-[2px] font-mono text-[8px] text-slate-500 transition hover:text-cyan-300"
              >
                JSON
              </button>
            </div>

            {pasteOpen && (
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setFilename("");
                  if (!tableName) setTableName(format === "csv" ? "pasted_csv" : "pasted_json");
                }}
                placeholder={format === "csv" ? "id,name,revenue\\n1,Northstar,249.00" : '[{"id": 1, "name": "Northstar"}]'}
                className="scroll-thin mt-2 h-[118px] w-full resize-none rounded-md border border-[#223148] bg-[#070e17] p-2.5 font-mono text-[9.5px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-500/35"
                aria-label="Paste CSV or JSON data"
              />
            )}

            <div className="mt-3">
              <SectionLabel>Destination table</SectionLabel>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-[#223148] bg-[#0a1420] px-2 focus-within:border-cyan-500/40">
                <Table2 className="h-3 w-3 shrink-0 text-emerald-400" />
                <input
                  value={tableName}
                  onChange={(event) => setTableName(event.target.value)}
                  placeholder="imported_data"
                  className="h-[31px] min-w-0 flex-1 bg-transparent font-mono text-[10.5px] text-slate-200 outline-none placeholder:text-slate-600"
                  aria-label="Destination table name"
                />
                <span className="font-mono text-[8px] uppercase text-slate-600">main</span>
              </div>
              {parsed?.table && finalName !== parsed.table.name && (
                <p className="mt-1.5 text-[8.5px] leading-relaxed text-amber-400/80">
                  Name already exists. This dataset will be imported as <span className="font-mono">{finalName}</span>.
                </p>
              )}
            </div>

            <div className="mt-2.5 flex items-start gap-1.5 rounded border border-emerald-500/10 bg-emerald-500/[0.035] px-2 py-1.5">
              <ShieldCheck className="mt-[1px] h-2.5 w-2.5 shrink-0 text-emerald-400" />
              <p className="text-[8.5px] leading-relaxed text-slate-500">
                No file leaves this browser tab. Types are inferred automatically; you can edit them later in the schema studio.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col rounded-md border border-[#1d2b3e] bg-[#080f19]">
            <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-[#182436] bg-[#0b1420] px-2.5">
              <Sparkles className="h-3 w-3 text-violet-300" />
              <span className="text-[10px] font-medium text-slate-300">Preview & inference</span>
              {parsed?.table && (
                <span className="ml-auto flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/[0.06] px-1.5 py-[1px] font-mono text-[7.5px] uppercase tracking-wider text-emerald-400">
                  <Check className="h-2 w-2" />
                  ready
                </span>
              )}
            </div>

            {parsed?.error || error ? (
              <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
                <span className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/[0.07]">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </span>
                <p className="text-[10.5px] font-medium text-amber-200">Could not infer this dataset</p>
                <p className="mt-1 max-w-[230px] text-[9px] leading-relaxed text-slate-500">{parsed?.error ?? error}</p>
                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadSample("csv")}
                    className="rounded border border-[#2b3b51] bg-[#0c1725] px-2 py-1 text-[8.5px] text-slate-400 transition hover:text-slate-200"
                  >
                    Try sample CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSample("json")}
                    className="rounded border border-[#2b3b51] bg-[#0c1725] px-2 py-1 text-[8.5px] text-slate-400 transition hover:text-slate-200"
                  >
                    Try JSON
                  </button>
                </div>
              </div>
            ) : parsed?.table ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#182436] px-2.5 py-2">
                  <span className="font-mono text-[9px] text-slate-400">{formatCompact(parsed.table.rows.length)} rows</span>
                  <span className="h-2.5 w-px bg-[#263449]" />
                  <span className="font-mono text-[9px] text-slate-400">{parsed.table.columns.length} columns</span>
                  <span className="ml-auto flex items-center gap-1 font-mono text-[8px] text-slate-600">
                    inferred <ArrowRight className="h-2.5 w-2.5" />
                    <span className="text-cyan-400">{parsed.table.columns.filter((column) => column.type === "INTEGER").length} int</span>
                    <span className="text-violet-400">{parsed.table.columns.filter((column) => column.type === "REAL").length} real</span>
                    <span className="text-emerald-400">{parsed.table.columns.filter((column) => column.type === "TEXT").length} text</span>
                  </span>
                </div>

                <div className="scroll-thin max-h-[205px] min-h-[140px] flex-1 overflow-auto">
                  <table className="w-max min-w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-[#0b1522]">
                      <tr>
                        {parsed.table.columns.map((column) => (
                          <th key={column.name} className="border-b border-r border-[#1b293c] px-2 py-[5px] last:border-r-0">
                            <div className="flex items-center gap-1">
                              {column.primaryKey && <span className="text-[7px] text-cyan-400">PK</span>}
                              <span className="font-mono text-[8.5px] font-medium text-slate-300">{column.name}</span>
                              <span className="ml-auto font-mono text-[6.5px] uppercase text-slate-600">{column.type}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.table.rows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {parsed.table?.columns.map((column) => (
                            <td key={column.name} className="max-w-[120px] truncate border-b border-r border-[#141f2e] px-2 py-[5px] font-mono text-[8.5px] text-slate-400 last:border-r-0">
                              {row[column.name] === null || row[column.name] === undefined ? (
                                <span className="text-[7px] uppercase text-amber-400/70">null</span>
                              ) : (
                                String(row[column.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-[#182436] p-2">
                  <div className="rounded border border-[#1b293c] bg-[#0a1420] px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Table2 className="h-2.5 w-2.5 text-cyan-400" />
                      <span className="font-mono text-[8.5px] text-slate-300">{finalName}</span>
                      <span className="ml-auto font-mono text-[7px] uppercase text-slate-600">create table</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {parsed.table.columns.slice(0, 6).map((column) => (
                        <span key={column.name} className="rounded border border-[#253449] bg-[#0b1624] px-1 font-mono text-[6.5px] text-slate-500">
                          {column.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
                <div className="relative mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#223148] bg-gradient-to-b from-[#0c1725] to-[#09111b]">
                  <Table2 className="h-4 w-4 text-slate-600" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#223148] bg-[#0b1522]">
                    <Sparkles className="h-2 w-2 text-violet-400" />
                  </span>
                </div>
                <p className="text-[10.5px] font-medium text-slate-300">Your data preview appears here</p>
                <p className="mt-1 max-w-[220px] text-[9px] leading-relaxed text-slate-600">
                  Drop a CSV or JSON file to infer column types, row counts and primary keys.
                </p>
                <button
                  type="button"
                  onClick={() => loadSample("csv")}
                  className="mt-3 flex items-center gap-1.5 rounded border border-[#2b3b51] bg-[#0c1725] px-2 py-1 text-[8.5px] text-slate-400 transition hover:border-emerald-500/25 hover:text-emerald-300"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Load a sample dataset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[#1b293c] bg-[#09111b] px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[8.5px] text-slate-600">
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
          local-only ingestion
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-[29px] items-center rounded-md border border-[#26364c] bg-[#0b1522] px-2.5 text-[10px] font-medium text-slate-400 transition hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parsed?.table}
            className="flex h-[29px] items-center gap-1.5 rounded-md border border-cyan-300/25 bg-gradient-to-b from-cyan-400 to-cyan-500 px-3 text-[10px] font-semibold text-[#041016] transition hover:from-cyan-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:border-[#243247] disabled:from-[#1a283a] disabled:to-[#162334] disabled:text-slate-600"
          >
            <Table2 className="h-3 w-3" />
            Import table
            {parsed?.table && <span className="font-mono text-[8px] opacity-60">{formatCompact(parsed.table.rows.length)} rows</span>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
