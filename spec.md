# QueryPulse — Product Specification

**Version:** 1.0.0
**Repository:** kennedy-blip/sqlinn
**Status:** Implemented (this document describes the current build)

---

## 1. Overview

QueryPulse is a sovereign, local-first SQL studio, visual schema explorer, and instant
CSV/JSON workbench. It runs an in-memory relational query engine directly in the browser.
There is no WASM binary, no backend, no network request, and no telemetry. Dataset state
belongs to the tab.

The application is a single-page React app built with Vite and Tailwind CSS, bundled by
`vite-plugin-singlefile` into one self-contained HTML file.

## 2. Goals

- Give analysts a fast, private SQL playground that works offline.
- Keep every byte of data inside the browser tab — nothing is uploaded, stored, or tracked.
- Provide a visual schema explorer and ER diagram for relational modeling.
- Make CSV/JSON import and result export frictionless.

## 3. Non-Goals

- No server, no persistence layer, no multi-user collaboration.
- No write operations (INSERT/UPDATE/DELETE) against the engine — it is a read-only
  SELECT engine.
- No subqueries, CTEs, or UNION support in this build (explicitly rejected by the parser
  with guidance errors).

## 4. Architecture

```
index.html
src/
  main.tsx                 React entry point
  App.tsx                  Workspace shell, view switching, seed/import/export orchestration
  components/
    StudioHeader.tsx       Top bar: brand, dataset stats, seed / export / import actions
    SqlEditor.tsx          Multi-tab query studio, execution, history, exports
    SchemaExplorer.tsx     Sidebar tree of tables, columns, PK/FK badges, filter box
    ErdVisualizer.tsx      Draggable ER canvas with relationship edges and zoom
    TableBuilder.tsx       Table blueprint editor (columns, types, keys, DDL preview)
    ImportModal.tsx        CSV/JSON import dialog (file drop, paste, samples)
    ResultsGrid.tsx        Sortable/filterable result table with typed cell rendering
    WorkspacePulse.tsx     Right rail: engine health, stats, recent runs, suggestion
    CodeEditor.tsx         Transparent textarea + SQL syntax highlighting overlay
    ui.tsx                 Shared primitives: ToastStack, Modal, Kbd, SectionLabel, LiveDot
  lib/
    database.ts            TableDef/ColumnDef model, seed dataset, DDL + SQL dump generation
    sql.ts                 Tokenizer, recursive-descent parser, in-memory query executor
    io.ts                  CSV/JSON parsing, type inference, file download helpers
    presets.ts             Curated analytical query library (8 presets)
  utils/cn.ts              clsx + tailwind-merge helper
```

### 4.1 Data model (`src/lib/database.ts`)

- `ColumnType`: `INTEGER | TEXT | REAL | BLOB`
- `CellValue`: `string | number | boolean | null`
- `ColumnDef`: name, type, `primaryKey`, `nullable`, `defaultValue`, optional `foreignKey`
  reference `{ table, column }`
- `TableDef`: name, columns, rows, optional description

### 4.2 Query engine (`src/lib/sql.ts`)

- Hand-written tokenizer supporting strings (`'…'` with `''` escapes), quoted identifiers
  (`"…"`, `` `…` ``, `[...]`), numbers, operators, comments (`--`, `/* */`).
- Recursive-descent parser for a single `SELECT` statement: `DISTINCT`, select items with
  `AS` aliases, `FROM` with optional alias, `INNER/LEFT JOIN … ON`, `WHERE`, `GROUP BY`,
  `HAVING`, `ORDER BY … ASC/DESC`, `LIMIT/OFFSET` (including `LIMIT n, m` form).
- Expression tree supports literals, column references, `*` / `table.*`, binary/unary
  operators, function calls, `CASE WHEN`, `IN`, `BETWEEN`, `IS NULL`, `LIKE`, `CAST`.
- Executor evaluates against in-memory `TableDef[]` and returns a `QueryResult` with
  columns, rows, execution time (`ms`), scanned row count, and affected count.
- Errors are raised as `QueryError` with a human message plus a `hint`.

### 4.3 Supported SQL surface

- Aggregates: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `GROUP_CONCAT`, `TOTAL`
- Scalars: `ROUND`, `ABS`, `UPPER`, `LOWER`, `LENGTH`, `COALESCE`, `IFNULL`, `TRIM`,
  `SUBSTR`, `MIN`, `MAX`
- Operators: `=`, `<`, `>`, `<=`, `>=`, `!=`, `<>`, `+`, `-`, `*`, `/`, `%`, `||`, `AND`,
  `OR`, `NOT`, `LIKE`, `BETWEEN`, `IN`, `IS NULL`, `CAST`

## 5. Features

### 5.1 Query Studio
- Multi-tab SQL editor (add/close tabs; the last tab cannot be closed).
- Syntax-highlighted editor with line numbers, `⌘↵` / `Ctrl+Enter` to execute, Tab inserts
  two spaces.
- Curated query library (8 presets across JOIN / Aggregation / Funnel / Diagnostic).
- Execution timing, scanned-row count, sortable/filterable results grid.
- Export results as CSV or JSON; copy results as JSON; copy SQL to clipboard; SQL formatter.
- Run history (last 24 runs) with one-click reload.

### 5.2 Schema Explorer
- Table/column tree with PK/FK badges and type colors.
- Filter box (`/` shortcut) matching table/column names, types, and descriptions.
- One-click `SELECT * FROM <table>` snippet insertion into the editor.
- Live memory footprint estimate of the serialized workspace.

### 5.3 Schema Designer (ERD)
- Draggable table nodes on a grid canvas, zoom controls (60%–140%) and fit button.
- Relationship edges drawn from foreign keys with highlight on selection.
- Table blueprint editor: add/remove columns, set type/PK/nullable/default/FK, live DDL
  preview, copy DDL, commit with validation (unique names, at least one PK, no duplicate
  columns).
- Export schema DDL (no data) as `querypulse_schema.sql`.

### 5.4 Import / Export
- Import CSV or JSON via file picker, drag & drop, or paste; max 8 MB.
- Column type inference (INTEGER/REAL/TEXT), `id` detected as PK when unique.
- Sample CSV and JSON datasets included for instant try-out.
- Export full workspace as a SQL dump (`local_workspace_dump.sql`) with
  `PRAGMA foreign_keys = ON`, transaction, `CREATE TABLE` and batched `INSERT`s.
- Seed button resets the workspace to the sample dataset (184 users, 640 api_logs,
  184 embeddings_meta).

### 5.5 Workspace Pulse
- Engine health card with success rate and average execution time.
- Session stats: runs, returned rows, indexed rows, saved drafts.
- Table distribution bars and recent runs list.
- Suggested query shortcut.

## 6. Seed Dataset

| Table | Rows | Purpose |
| --- | --- | --- |
| `users` | 184 | Account directory and usage context |
| `api_logs` | 640 | Request telemetry from the edge |
| `embeddings_meta` | 184 | Vector collection registry |

Foreign keys: `api_logs.user_id → users.id`, `embeddings_meta.user_id → users.id`.
Data is generated deterministically with a seeded PRNG (`mulberry32(20260211)`).

## 7. Privacy & Security

- All parsing and execution happen in the browser main thread; no network calls are made
  by the app logic.
- No telemetry, no analytics, no cookies, no localStorage persistence.
- Imported files are read with the File API and never leave the tab.

## 8. Build & Run

```bash
npm install
npm run dev      # local development server
npm run build    # production build to dist/ (single self-contained file)
npm run preview  # preview the production build
```

## 9. Roadmap (not implemented)

- Subqueries and CTEs (currently rejected with guidance).
- Write operations (INSERT/UPDATE/DELETE) and transaction control.
- Persistence of workspace state across sessions.
