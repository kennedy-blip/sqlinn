import type { CellValue, ColumnDef, ColumnType, Row, TableDef } from "./database";
import type { QueryResult } from "./sql";

export function downloadText(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim() !== ""));
}

export function escapeCsv(value: CellValue): string {
  if (value === null || value === undefined) return "";
  const string = String(value);
  return /[",\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
}

export function downloadQueryCsv(result: QueryResult, filename = "querypulse_results.csv"): void {
  const header = result.columns.map((column) => escapeCsv(column.label)).join(",");
  const body = result.rows.map((row) => row.map((cell) => escapeCsv(cell)).join(","));
  downloadText(filename, [header, ...body].join("\n"), "text/csv");
}

export function downloadQueryJson(result: QueryResult, filename = "querypulse_results.json"): void {
  const records = result.rows.map((row) =>
    Object.fromEntries(result.columns.map((column, index) => [column.label, row[index] ?? null])),
  );
  downloadText(filename, JSON.stringify(records, null, 2), "application/json");
}

function sanitizeIdentifier(input: string, fallback = "imported_data"): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (normalized || fallback).replace(/^[0-9]/, "_$&");
}

function displayColumnName(input: string, index: number): string {
  const normalized = input.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  const safe = normalized || `column_${index + 1}`;
  return /^[0-9]/.test(safe) ? `_${safe}` : safe;
}

type ImportRecord = Record<string, unknown>;

function recordsToTable(
  records: ImportRecord[],
  requestedName: string,
  fallbackName: string,
): TableDef {
  if (records.length === 0) throw new Error("The file does not contain any data rows.");
  const rawKeys = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
  const keys = rawKeys.map((key, index) => displayColumnName(key, index));
  const keyMap = new Map(rawKeys.map((key, index) => [key, keys[index]]));

  const columns: ColumnDef[] = keys.map((name, index) => {
    const rawKey = rawKeys[index];
    const values = records
      .map((record) => record[rawKey])
      .filter((value) => value !== null && value !== undefined && value !== "");
    let type: ColumnType = "TEXT";
    if (values.length > 0 && values.every((value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))))) {
      type = values.every((value) => Number.isInteger(Number(value))) ? "INTEGER" : "REAL";
    }
    return {
      name,
      type,
      primaryKey: name.toLowerCase() === "id" && index === 0,
      nullable: false,
    };
  });

  columns.forEach((column) => {
    const distinct = new Set(records.map((record) => record[keyMap.get(column.name) ?? column.name]));
    if (column.primaryKey && distinct.size !== records.length) column.primaryKey = false;
  });

  const rows: Row[] = records.map((record) => {
    const row: Row = {};
    rawKeys.forEach((rawKey) => {
      const name = keyMap.get(rawKey) as string;
      const column = columns.find((candidate) => candidate.name === name);
      let value = record[rawKey];
      if (value === null || value === undefined || value === "") {
        row[name] = null;
      } else if (column?.type === "INTEGER" || column?.type === "REAL") {
        const numeric = Number(value);
        row[name] = Number.isFinite(numeric) ? numeric : null;
      } else if (typeof value === "object") {
        row[name] = JSON.stringify(value);
      } else if (typeof value === "boolean") {
        row[name] = value ? "true" : "false";
      } else {
        row[name] = String(value);
      }
    });
    return row;
  });

  // Fill in holes where records omit a key, so every row stays aligned to the schema.
  for (const row of rows) {
    for (const column of columns) {
      if (!(column.name in row)) row[column.name] = null;
    }
  }

  return {
    name: sanitizeIdentifier(requestedName, fallbackName),
    description: "Imported local dataset",
    columns,
    rows,
  };
}

export function parseCsvTable(text: string, requestedName: string): TableDef {
  const grid = parseCsv(text);
  if (grid.length < 2) throw new Error("CSV needs a header row and at least one data row.");
  const headers = grid[0].map((header, index) => header.trim() || `column_${index + 1}`);
  const records = grid.slice(1).map((row) => {
    const record: ImportRecord = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? null;
    });
    return record;
  });
  return recordsToTable(records, requestedName, "imported_csv");
}

export function parseJsonTable(text: string, requestedName: string): TableDef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON. Check the brackets and trailing commas.");
  }
  let records: ImportRecord[];
  if (Array.isArray(parsed)) {
    records = parsed.filter((row): row is ImportRecord => typeof row === "object" && row !== null && !Array.isArray(row));
  } else if (parsed && typeof parsed === "object") {
    const candidate = Object.values(parsed).find((value) => Array.isArray(value));
    if (Array.isArray(candidate)) {
      records = candidate.filter((row): row is ImportRecord => typeof row === "object" && row !== null && !Array.isArray(row));
    } else {
      records = [parsed as ImportRecord];
    }
  } else {
    throw new Error("JSON must contain an array of objects or an object with an array of records.");
  }
  if (records.length === 0) throw new Error("No object records were found in the JSON file.");
  return recordsToTable(records, requestedName, "imported_json");
}

export function inferNameFromFile(filename: string): string {
  return sanitizeIdentifier(filename.replace(/\.[^.]+$/, ""), "imported_data");
}

export const SAMPLE_CSV = `order_id,customer_id,product,revenue,status,ordered_at
101,184,Vector Credits,249.00,paid,2026-02-01
102,092,Team Seats,1080.00,paid,2026-02-01
103,047,Embedding Pack,89.50,pending,2026-02-02
104,156,Enterprise Add-on,2400.00,paid,2026-02-03
105,023,Starter Credits,29.00,refunded,2026-02-04
106,072,Team Seats,1080.00,paid,2026-02-05
107,119,Vector Credits,249.00,paid,2026-02-06
108,038,Embedding Pack,89.50,paid,2026-02-07
109,161,Enterprise Add-on,2400.00,pending,2026-02-08
110,015,Starter Credits,29.00,paid,2026-02-09
111,097,Team Seats,1080.00,paid,2026-02-10
112,142,Vector Credits,249.00,refunded,2026-02-11`;

export const SAMPLE_JSON = JSON.stringify(
  {
    experiments: [
      { id: "exp_01", name: "hybrid-retrieval", owner_id: 12, lift: 12.8, status: "completed", created_at: "2026-01-05" },
      { id: "exp_02", name: "query-rewrite", owner_id: 37, lift: 9.4, status: "completed", created_at: "2026-01-09" },
      { id: "exp_03", name: "rerank-v3", owner_id: 64, lift: null, status: "running", created_at: "2026-01-18" },
      { id: "exp_04", name: "cache-warming", owner_id: 89, lift: 4.1, status: "running", created_at: "2026-02-02" },
      { id: "exp_05", name: "chunk-overlap", owner_id: 118, lift: -2.3, status: "archived", created_at: "2026-02-07" },
    ],
  },
  null,
  2,
);
