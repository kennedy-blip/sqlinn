export type ColumnType = "INTEGER" | "TEXT" | "REAL" | "BLOB";

export type CellValue = string | number | boolean | null;

export type Row = Record<string, CellValue>;

export interface ForeignKey {
  table: string;
  column: string;
}

export interface ColumnDef {
  name: string;
  type: ColumnType;
  primaryKey?: boolean;
  nullable?: boolean;
  defaultValue?: string;
  foreignKey?: ForeignKey;
}

export interface TableDef {
  name: string;
  columns: ColumnDef[];
  rows: Row[];
  description?: string;
}

export const COLUMN_TYPE_COLORS: Record<ColumnType, string> = {
  INTEGER: "text-cyan-300",
  TEXT: "text-emerald-300",
  REAL: "text-violet-300",
  BLOB: "text-amber-300",
};

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}m`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(2);
  }
  return String(value);
}

export function totalRows(tables: TableDef[]): number {
  return tables.reduce((sum, table) => sum + table.rows.length, 0);
}

export function escapeSql(value: CellValue): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function tableDdl(table: TableDef): string {
  const lines: string[] = [];
  for (const column of table.columns) {
    let line = `  ${column.name} ${column.type}`;
    if (column.primaryKey && column.type === "INTEGER") line += " PRIMARY KEY AUTOINCREMENT";
    else if (column.primaryKey) line += " PRIMARY KEY";
    else if (column.nullable === false) line += " NOT NULL";
    if (column.defaultValue !== undefined && column.defaultValue !== "") {
      line += ` DEFAULT ${column.defaultValue}`;
    }
    lines.push(line);
  }
  for (const column of table.columns) {
    if (column.foreignKey) {
      lines.push(
        `  FOREIGN KEY (${column.name}) REFERENCES ${column.foreignKey.table}(${column.foreignKey.column})`,
      );
    }
  }
  return `CREATE TABLE IF NOT EXISTS ${table.name} (\n${lines.join(",\n")}\n);`;
}

export function generateSqlDump(tables: TableDef[], includeData = true): string {
  const sections: string[] = [
    "-- QueryPulse local workspace dump",
    `-- Generated: ${new Date().toISOString()}`,
    "-- Engine: local in-memory SQLite-compatible schema",
    "",
    "PRAGMA foreign_keys = ON;",
    "BEGIN TRANSACTION;",
    "",
  ];

  for (const table of tables) {
    sections.push(`DROP TABLE IF EXISTS ${table.name};`, tableDdl(table), "");
    if (includeData && table.rows.length > 0) {
      const keys = table.columns.map((column) => column.name);
      const chunk = 50;
      for (let i = 0; i < table.rows.length; i += chunk) {
        const values = table.rows
          .slice(i, i + chunk)
          .map((row) => `  (${keys.map((key) => escapeSql(row[key])).join(", ")})`)
          .join(",\n");
        sections.push(
          `INSERT INTO ${table.name} (${keys.join(", ")}) VALUES\n${values};`,
          "",
        );
      }
    }
  }

  sections.push("COMMIT;", "");
  return sections.join("\n");
}

const FIRST_NAMES = [
  "Maya", "Elias", "Noor", "Theo", "Sana", "Kai", "Ines", "Rowan", "Jules", "Amina",
  "Luca", "Priya", "Niko", "Ada", "Emil", "Zara", "Miles", "Lea", "Owen", "Iris",
  "Sam", "Lena", "Arlo",
];

const LAST_NAMES = [
  "Chen", "Novak", "Haddad", "Bennett", "Patel", "Okafor", "Duarte", "Kim",
  "Fischer", "Moreau", "Singh", "Rossi", "Varga", "Nakamura", "Costa", "Anders",
];

const ROLES = ["Developer", "Data Scientist", "Analyst", "Owner", "Admin"];
const PLANS = ["Free", "Pro", "Pro", "Team", "Team", "Enterprise"];
const STATUSES = ["active", "active", "active", "active", "trial", "suspended"];
const COUNTRIES = ["US", "DE", "GB", "NL", "SG", "CA", "BR", "JP", "SE", "IN"];
const DOMAINS = ["pulse.dev", "northstar.io", "atlaslabs.co", "drift-labs.dev", "orbit.studio"];
const ENDPOINTS = ["/v1/embeddings", "/v1/chat/completions", "/v1/models", "/v1/files", "/v1/usage"];
const METHODS = ["GET", "POST", "GET", "POST", "DELETE"];
const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];
const MODELS = ["text-embedding-3-small", "text-embedding-3-large", "bge-small-en", "nomic-embed-text"];

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dateBetween(random: () => number, start: number, end: number): string {
  const stamp = start + Math.floor(random() * (end - start));
  const date = new Date(stamp);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function createSeedTables(): TableDef[] {
  const random = mulberry32(20260211);

  const users: Row[] = Array.from({ length: 184 }, (_, index) => {
    const id = index + 1;
    const first = FIRST_NAMES[index % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
    const plan = pick(random, PLANS);
    const status = pick(random, STATUSES);
    const multiplier = plan === "Enterprise" ? 4 : plan === "Team" ? 2.2 : plan === "Pro" ? 1 : 0.35;
    return {
      id,
      full_name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${String(id).padStart(2, "0")}@${
        DOMAINS[index % DOMAINS.length]
      }`,
      role: pick(random, ROLES),
      plan,
      status,
      monthly_queries: Math.round((120 + random() * 5_800) * multiplier),
      storage_mb: Math.round((8 + random() * 920) * multiplier * 10) / 10,
      country: pick(random, COUNTRIES),
      created_at: dateBetween(random, Date.UTC(2025, 2, 1), Date.UTC(2026, 0, 24)),
      last_active_at:
        status === "suspended"
          ? dateBetween(random, Date.UTC(2025, 10, 1), Date.UTC(2026, 0, 2))
          : dateBetween(random, Date.UTC(2026, 0, 5), Date.UTC(2026, 1, 11)),
    };
  });

  const apiLogs: Row[] = Array.from({ length: 640 }, (_, index) => {
    const endpoint = pick(random, ENDPOINTS);
    const failed = random() > 0.86;
    const statusCode = failed
      ? pick(random, [400, 401, 404, 429, 500])
      : pick(random, [200, 200, 200, 201, 204]);
    const base = endpoint === "/v1/embeddings" ? 74 : endpoint === "/v1/chat/completions" ? 142 : 31;
    return {
      id: index + 1,
      user_id: 1 + Math.floor(random() * 184),
      endpoint,
      method: endpoint === "/v1/models" || endpoint === "/v1/usage" ? "GET" : pick(random, METHODS),
      status_code: statusCode,
      latency_ms: Math.round((base + random() * 310 + (failed ? 160 : 0)) * 10) / 10,
      region: pick(random, REGIONS),
      request_bytes: Math.round(800 + random() * 42_000),
      created_at: dateBetween(random, Date.UTC(2026, 1, 8), Date.UTC(2026, 1, 12)),
    };
  });

  const embeddingsMeta: Row[] = Array.from({ length: 184 }, (_, index) => {
    const model = pick(random, MODELS);
    const dimensions =
      model === "text-embedding-3-large" ? 3072 : model === "text-embedding-3-small" ? 1536 : model === "bge-small-en" ? 384 : 768;
    const hex = Math.floor(random() * 0xfffffff)
      .toString(16)
      .padStart(7, "0");
    return {
      id: index + 1,
      user_id: index + 1,
      model,
      dimensions,
      chunk_count: Math.round(12 + random() * 2_400),
      tokens_used: Math.round(1_200 + random() * 128_000),
      vector: `0x${hex}${Math.floor(random() * 0xffffff).toString(16)}…`,
      created_at: dateBetween(random, Date.UTC(2025, 8, 1), Date.UTC(2026, 1, 10)),
    };
  });

  return [
    {
      name: "users",
      description: "Account directory and usage context",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true, nullable: false },
        { name: "full_name", type: "TEXT", nullable: false },
        { name: "email", type: "TEXT", nullable: false },
        { name: "role", type: "TEXT" },
        { name: "plan", type: "TEXT" },
        { name: "status", type: "TEXT" },
        { name: "monthly_queries", type: "INTEGER" },
        { name: "storage_mb", type: "REAL" },
        { name: "country", type: "TEXT" },
        { name: "created_at", type: "TEXT" },
        { name: "last_active_at", type: "TEXT" },
      ],
      rows: users,
    },
    {
      name: "api_logs",
      description: "Request telemetry from the edge",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true, nullable: false },
        { name: "user_id", type: "INTEGER", foreignKey: { table: "users", column: "id" } },
        { name: "endpoint", type: "TEXT" },
        { name: "method", type: "TEXT" },
        { name: "status_code", type: "INTEGER" },
        { name: "latency_ms", type: "REAL" },
        { name: "region", type: "TEXT" },
        { name: "request_bytes", type: "INTEGER" },
        { name: "created_at", type: "TEXT" },
      ],
      rows: apiLogs,
    },
    {
      name: "embeddings_meta",
      description: "Vector collection registry",
      columns: [
        { name: "id", type: "INTEGER", primaryKey: true, nullable: false },
        {
          name: "user_id",
          type: "INTEGER",
          foreignKey: { table: "users", column: "id" },
        },
        { name: "model", type: "TEXT" },
        { name: "dimensions", type: "INTEGER" },
        { name: "chunk_count", type: "INTEGER" },
        { name: "tokens_used", type: "INTEGER" },
        { name: "vector", type: "BLOB" },
        { name: "created_at", type: "TEXT" },
      ],
      rows: embeddingsMeta,
    },
  ];
}

export function findColumn(
  tables: TableDef[],
  table: string,
  column: string,
): ColumnDef | undefined {
  return tables
    .find((candidate) => candidate.name.toLowerCase() === table.toLowerCase())
    ?.columns.find((candidate) => candidate.name.toLowerCase() === column.toLowerCase());
}
