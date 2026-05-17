# QueryPulse

**A sovereign, local-first SQL studio, visual schema explorer, and instant CSV/JSON workbench.**

QueryPulse runs an in-memory relational query engine directly in the browser. There is no WASM binary, no backend, no network request, and no telemetry. Dataset state belongs to the tab.

## Highlights

- **Query Studio** — mult i-tab SQL edi tor with syntax highlighting, a curated analytical query library, ex ecution timings, sortable/filterable results, and CSV or JSON export.
- **Schema Explorer** — browse relations, typed columns, primary keys, foreign keys, row counts, in-memory footprint, and insert a ready-to-run `SELECT *` snippet with one  click.
- **Schema Designer** — draggable ERD cards with live relationship lines, a column/table blueprint editor, foreign-key ta rgeting, and auto-generated `CREATE TABLE` DDL.
- **Local ingestion** — import `.csv` or `.json`, infe r column types and primary keys, preview rows, and add the relation to the workspace without uploading anything.
- **Sovereign workspace tools** — seed the sample da taset, export a complete SQL data dump, and export normalized schema DDL.

## Included sample data

| Relation | Rows | Purp ose |
| --- | --- | --- |
| `users` | 184 | Account directory and usage context |
| `api_logs` | 640 | Edge request telemetr y |
| `embeddings_meta` | 184 | Vector collection registry |

## SQL support

The local engine evaluates `SELECT` statements with filtering, grouping, aggregates, sorting, limits, scalar functions, `CASE`, aliases, and `INNER` / `LEFT` joins. T he schema studio can commit new table blueprints to the workspace, but this build intentionally keeps the query executor read-only. Unsupported statements return a helpful diagnostic rather than touching data.

## Architecture

- React 19 + TypeScript + Vite
- Tailwind CSS (via the Vite plugin)
- `src/lib/database.ts` — relational schema types, sample data generation, DDL and dump generation
- `src/lib/sql.ts` — tokenizer, parser, SQL expression evaluator, result projection and joins
- `src/lib/io.ts` — CSV/JSON parsing, type inference, downloads
- `src/components/` — studio shell, schema explorer, editor/results, pulse rail, ERD/table builder, import dialog

## Run locally

```bash
npm install
npm run dev
npm run build
npm run preview
```

The production build is emitted to `dist/` as a self-contained app.
