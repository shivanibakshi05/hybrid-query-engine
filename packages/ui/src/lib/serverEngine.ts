import { QueryAST } from '@hybrid-query-engine/parser';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3001' : '');

/**
 * Whether a DuckDB fallback server is reachable for this build. The hosted demo
 * ships without one, so queries the router would send to the server run in WASM
 * instead (see `resolveRoute` in App.tsx).
 */
export const serverAvailable = SERVER_URL !== '';

export async function queryServer(
  ast: QueryAST,
  csv: string
): Promise<{ rows: Record<string, unknown>[]; executionTime: number }> {
  const res = await fetch(`${SERVER_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ast, csv }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Server error');
  }

  return res.json();
}
