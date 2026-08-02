import { useState } from 'react';
import { parse } from '@hybrid-query-engine/parser';
import { route, executeQuery } from '@hybrid-query-engine/router';
import { DataFrame } from '../../engine-wasm/pkg-bundler/engine_wasm';
import { queryServer, serverAvailable } from './lib/serverEngine';
import CsvDropzone from './components/CsvDropzone';
import QueryEditor from './components/QueryEditor';
import ResultsTable from './components/ResultsTable';
import ResultsChart from './components/ResultsChart';

export default function App() {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [query, setQuery] = useState('SELECT * FROM data LIMIT 10');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [usedRoute, setUsedRoute] = useState<'wasm' | 'server' | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downgraded, setDowngraded] = useState(false);

  async function loadSample() {
    const res = await fetch(`${import.meta.env.BASE_URL}sample-sales.csv`);
    const text = await res.text();
    setCsvText(text);
    setFileName('sample-sales.csv');
    setFileSize(new Blob([text]).size);
    setRows([]);
    setQuery(
      'SELECT region, SUM(revenue) AS total FROM data GROUP BY region ORDER BY SUM(revenue) DESC'
    );
  }

  async function runQuery() {
    if (!csvText) return;
    setLoading(true);
    setError(null);
    try {
      const ast = parse(query);
      const wanted = route(ast, fileSize, navigator.onLine);
      // No DuckDB server in the hosted build — run everything in WASM and say so
      // rather than failing on a connection error.
      const r = wanted === 'server' && !serverAvailable ? 'wasm' : wanted;
      setDowngraded(r !== wanted);
      setUsedRoute(r);

      if (r === 'wasm') {
        const start = performance.now();
        setRows(executeQuery(ast, csvText, DataFrame));
        setExecTime(Math.round(performance.now() - start));
      } else {
        const { rows: result, executionTime } = await queryServer(ast, csvText);
        setRows(result);
        setExecTime(executionTime);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Hybrid Query Engine</h1>
      <p className="text-gray-500 text-sm mb-4">
        In-browser WASM · Fallback to DuckDB server
      </p>

      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={loadSample}
          className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
        >
          Load sample dataset
        </button>
        <span className="text-xs text-gray-500">
          500 rows of sales data — or drop your own CSV below
        </span>
      </div>

      {!serverAvailable && (
        <div className="mb-4 p-3 bg-gray-900 border border-gray-700 rounded text-xs text-gray-400">
          Running in <span className="text-cyan-400">browser-only mode</span> — no
          DuckDB server is configured for this build, so every query executes in
          WASM. Your data never leaves this tab. Run the server locally to see
          the hybrid routing path.
        </div>
      )}

      <CsvDropzone
        onLoad={(text, name, size) => {
          setCsvText(text);
          setFileName(name);
          setFileSize(size);
          setRows([]);
        }}
      />

      {fileName && (
        <p className="text-xs text-gray-500 mt-2">
          {fileName} — {(fileSize / 1024).toFixed(1)} KB
          {fileSize > 100 * 1024 * 1024 && (
            <span className="text-amber-400 ml-2">→ will use server</span>
          )}
        </p>
      )}

      <QueryEditor
        value={query}
        onChange={setQuery}
        onRun={runQuery}
        loading={loading}
      />

      {error && (
        <div className="mt-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                usedRoute === 'wasm'
                  ? 'bg-cyan-900 text-cyan-300'
                  : 'bg-blue-900 text-blue-300'
              }`}
            >
              {usedRoute === 'wasm' ? '⚡ WASM' : '🌐 Server (DuckDB)'}
            </span>
            {execTime !== null && (
              <span className="text-xs text-gray-400">{execTime}ms</span>
            )}
            <span className="text-xs text-gray-400">{rows.length} rows</span>
            {downgraded && (
              <span className="text-xs text-amber-400">
                would route to server — no server configured, ran in WASM
              </span>
            )}
          </div>
          <ResultsTable rows={rows} />
          <ResultsChart rows={rows} />
        </>
      )}
    </div>
  );
}
