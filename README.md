# Hybrid Analytical Query Engine

A SQL-like analytical query engine that executes queries **directly in the browser** via a Rust/WebAssembly columnar store, with automatic fallback to a Node.js + DuckDB backend for large datasets.

> Built as a deep-dive into query engine internals — columnar storage, SQL parsing, WebAssembly execution, and hybrid client/server routing.

---

## What It Does

Drag a CSV file into the browser, write a SQL-like query, get results and charts instantly — **without your data ever leaving your machine** for datasets under 100MB.

```sql
SELECT region, SUM(revenue), COUNT(*)
FROM sales
WHERE date > '2024-01-01'
GROUP BY region
ORDER BY SUM(revenue) DESC
LIMIT 10
```

- Small datasets (&lt;100MB) → executed in-browser via Rust/WASM. Zero network. Zero cost.
- Large datasets (&gt;100MB) → automatically routed to Node.js + DuckDB server.

---

## Architecture

```
User drops CSV in browser
         │
         ▼
   React Dashboard (Vite + Tailwind)
         │
         ▼
  TypeScript SQL Parser
  SQL string ──▶ AST (JSON)
         │
         ▼
    Query Router
  dataset < 100MB? ──▶ WASM Engine (Rust)
  dataset > 100MB? ──▶ Node.js + DuckDB (server)
         │
         ▼
  Result Dataset (JSON)
         │
         ▼
  Recharts + Table + Benchmark Panel
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Query Parser | TypeScript |
| Execution Engine | Rust → WebAssembly (wasm-pack) |
| Query Router | TypeScript |
| Backend | Node.js + Express + DuckDB |
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Monorepo | npm workspaces |

---

## Getting Started

### Prerequisites

- Node.js 22+
- Rust 1.96+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- wasm-pack (`curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh`)

### Install

```bash
git clone https://github.com/shivanibakshi05/hybrid-query-engine.git
cd hybrid-query-engine
npm install
```

### Run Tests

```bash
# All packages
npm run test

# Parser only
npm run test --workspace=packages/parser
```

### Build

```bash
# TypeScript packages
npm run build

# WASM engine (from packages/engine-wasm)
wasm-pack build --target web --out-dir pkg
```

---

## How It Works

### 1. Query Parser (`packages/parser`)

Takes a SQL string and produces an AST (Abstract Syntax Tree) — a structured JSON object representing the query's intent. Built in two stages:

- **Lexer** — tokenizes the SQL string into keywords, identifiers, operators, literals
- **Parser** — recursive descent walk over tokens, builds the typed AST

The same AST is consumed by both the WASM engine and the Node.js backend. Parsing logic lives in exactly one place.

### 2. WASM Engine (`packages/engine-wasm`)

A columnar in-memory data store written in Rust, compiled to WebAssembly. Stores data column-by-column (not row-by-row) — the same layout used by BigQuery, Snowflake, and DuckDB — enabling cache-efficient aggregations.

Implements: CSV ingestion, filter (WHERE), aggregation (SUM/COUNT/AVG/MIN/MAX), GROUP BY, ORDER BY.

### 3. Query Router

Decides where to execute based on dataset size and query complexity:

| Condition | Route |
|---|---|
| Dataset &lt; 100MB | WASM (in-browser) |
| Dataset &gt; 100MB | Node.js + DuckDB |
| Query contains JOIN | Node.js + DuckDB |
| User offline | Force WASM |

### 4. Node.js Server (`packages/server`)

Receives the same AST from the parser, translates it to SQL, and executes via DuckDB — a production-grade embeddable analytical database.

### 5. React Dashboard (`packages/ui`)

Drag-and-drop CSV upload, SQL query editor, results table, charts (Recharts), and a benchmark panel comparing WASM vs server execution time.

---

## License

MIT
