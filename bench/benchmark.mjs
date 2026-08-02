/**
 * Benchmarks the WASM and DuckDB execution paths against the same queries at
 * increasing dataset sizes, and prints a markdown table.
 *
 *   npm run bench                 # default sizes
 *   npm run bench -- 1 10 50 200  # sizes in MB
 *
 * Both paths are measured end-to-end, the way the app actually runs them: the
 * WASM path parses a CSV string held in memory, the DuckDB path reads a file
 * from disk. That asymmetry is real and is the point of the comparison.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { parse } = require(path.join(root, 'packages/parser/dist/index.js'));
const { executeQuery } = require(path.join(root, 'packages/router/dist/index.js'));
const { DataFrame } = require(path.join(root, 'packages/engine-wasm/pkg-node/engine_wasm.js'));
const { astToSql } = require(path.join(root, 'packages/server/dist/ast-to-sql.js'));
const duckdb = require('duckdb');

const QUERIES = [
  ['filter', "SELECT * FROM data WHERE revenue > 5000"],
  ['group + aggregate', 'SELECT region, SUM(revenue) FROM data GROUP BY region'],
  [
    'group + aggregate + sort',
    'SELECT region, SUM(revenue) FROM data GROUP BY region ORDER BY SUM(revenue) DESC',
  ],
];

const REPS = 3;
const REGIONS = ['North America', 'Europe', 'APAC', 'LATAM'];
const CATEGORIES = ['Laptops', 'Phones', 'Tablets', 'Monitors', 'Accessories'];

function generateCsv(targetBytes) {
  const header = 'order_id,date,region,category,units,unit_price,revenue,discount_pct\n';
  const parts = [header];
  let size = header.length;
  let i = 0;
  // Deterministic pseudo-random so runs are comparable.
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  while (size < targetBytes) {
    i++;
    const region = REGIONS[(rand() * REGIONS.length) | 0];
    const category = CATEGORIES[(rand() * CATEGORIES.length) | 0];
    const units = 1 + ((rand() * 40) | 0);
    const price = (20 + rand() * 1400).toFixed(2);
    const revenue = (units * price).toFixed(2);
    const discount = (rand() * 25) | 0;
    const month = 1 + ((rand() * 12) | 0);
    const day = 1 + ((rand() * 28) | 0);
    const row = `${1000 + i},2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')},${region},${category},${units},${price},${revenue},${discount}\n`;
    parts.push(row);
    size += row.length;
  }
  return { csv: parts.join(''), rows: i };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function timeWasm(ast, csv) {
  const times = [];
  for (let i = 0; i < REPS; i++) {
    const t0 = performance.now();
    executeQuery(ast, csv, DataFrame);
    times.push(performance.now() - t0);
  }
  return median(times);
}

const SERVER = process.env.BENCH_SERVER ?? 'http://localhost:3001';
// Typical consumer upload speed. The server path has to ship the whole CSV
// before DuckDB sees it; that cost is invisible on localhost but dominates in
// production, so we project it explicitly rather than pretending it is zero.
const UPLOAD_MBPS = Number(process.env.BENCH_UPLOAD_MBPS ?? 50);

async function serverIsUp() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Full HTTP round trip: serialize CSV into the request body, POST, parse reply.
 * Also returns the server's own breakdown so we can separate client-side
 * serialization from what the server actually spent.
 */
async function timeHttp(ast, csv) {
  const times = [];
  let timing = null;
  for (let i = 0; i < REPS; i++) {
    const t0 = performance.now();
    const res = await fetch(`${SERVER}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ast, csv }),
    });
    if (!res.ok) throw new Error(`server ${res.status}`);
    const body = await res.json();
    times.push(performance.now() - t0);
    timing = body.timing ?? null;
  }
  return { total: median(times), timing };
}

function projectedUploadMs(bytes) {
  return (bytes * 8) / (UPLOAD_MBPS * 1_000_000) * 1000;
}

async function timeDuckdb(ast, csvPath) {
  const sql = astToSql(ast, `read_csv_auto('${csvPath}')`);
  const times = [];
  for (let i = 0; i < REPS; i++) {
    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    const t0 = performance.now();
    await new Promise((resolve, reject) => {
      conn.all(sql, (err) => (err ? reject(err) : resolve()));
    });
    times.push(performance.now() - t0);
    conn.close();
  }
  return median(times);
}

function fmt(ms) {
  if (ms === null) return 'n/a';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}

async function main() {
  const sizes = process.argv.slice(2).map(Number).filter(Boolean);
  const targets = sizes.length ? sizes : [1, 10, 50, 100];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hqe-bench-'));
  const results = [];
  const httpUp = await serverIsUp();
  process.stderr.write(
    httpUp
      ? `server up at ${SERVER} — measuring HTTP round trip\n`
      : `no server at ${SERVER} — skipping HTTP columns (start it with: npm run start -w @hybrid-query-engine/server)\n`
  );

  for (const mb of targets) {
    process.stderr.write(`generating ${mb}MB dataset... `);
    const { csv, rows } = generateCsv(mb * 1024 * 1024);
    const csvPath = path.join(tmpDir, `${mb}mb.csv`);
    fs.writeFileSync(csvPath, csv);
    process.stderr.write(`${rows.toLocaleString()} rows\n`);

    for (const [label, sql] of QUERIES) {
      const ast = parse(sql);
      let wasm = null;
      let wasmNote = '';
      try {
        wasm = timeWasm(ast, csv);
      } catch (e) {
        wasmNote = e instanceof RangeError ? 'out of memory' : 'failed';
        process.stderr.write(`  WASM ${label} @ ${mb}MB: ${wasmNote}\n`);
      }
      const duck = await timeDuckdb(ast, csvPath);
      let http = null;
      let timing = null;
      if (httpUp) {
        try {
          const r = await timeHttp(ast, csv);
          http = r.total;
          timing = r.timing;
        } catch (e) {
          process.stderr.write(`  HTTP ${label} @ ${mb}MB failed: ${e.message}\n`);
        }
      }
      const upload = projectedUploadMs(Buffer.byteLength(csv));
      results.push({ mb, rows, label, wasm, duck, http, timing, upload, wasmNote });
      process.stderr.write(
        `  ${label} @ ${mb}MB — wasm ${wasm === null ? wasmNote : fmt(wasm)}, duckdb ${fmt(duck)}` +
          (http === null ? '' : `, http ${fmt(http)}`) +
          (timing ? ` (parse ${timing.bodyParseMs}ms, spill ${timing.spillToDiskMs}ms, duck ${timing.duckdbMs}ms)` : '') +
          `, +upload ${fmt(upload)}\n`
      );
    }
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });

  const httpCol = results.some((r) => r.http !== null);
  const head = ['Dataset', 'Rows', 'Query', 'WASM', 'DuckDB (exec only)'];
  const align = ['---', '---:', '---', '---:', '---:'];
  if (httpCol) {
    head.push('DuckDB over HTTP (localhost)');
    align.push('---:');
  }
  head.push(`Server total @ ${UPLOAD_MBPS} Mbps`, 'Winner');
  align.push('---:', '---');

  console.log(`\n| ${head.join(' | ')} |`);
  console.log(`| ${align.join(' | ')} |`);
  for (const r of results) {
    const serverTotal = r.upload + r.duck;
    const winner =
      r.wasm === null ? 'server' : r.wasm < serverTotal ? 'WASM' : 'server';
    const cells = [
      `${r.mb} MB`,
      r.rows.toLocaleString(),
      r.label,
      r.wasm === null ? `❌ ${r.wasmNote}` : fmt(r.wasm),
      fmt(r.duck),
    ];
    if (httpCol) cells.push(r.http === null ? 'n/a' : fmt(r.http));
    cells.push(fmt(serverTotal), winner);
    console.log(`| ${cells.join(' | ')} |`);
  }
  console.log(
    `\n_Node ${process.version}, ${os.cpus()[0].model}, ${os.arch()}. Median of ${REPS} runs._` +
      `\n_"Server total" = DuckDB execution + the CSV upload it needs first, projected at ${UPLOAD_MBPS} Mbps.` +
      ` The WASM path has no transfer cost — the data is already in the tab._`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
