import express from 'express';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import { QueryAST } from '@hybrid-query-engine/parser';
import { astToSql } from './ast-to-sql';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      receivedAt?: bigint;
    }
  }
}

const app = express();

// Registered before express.json() so it also covers body parsing. That is not
// a rounding error: the CSV arrives embedded in a JSON body, and JSON.parse on
// a 100MB payload costs more than the query itself.
app.use((req, _res, next) => {
  req.receivedAt = process.hrtime.bigint();
  next();
});

app.use(express.json({ limit: '500mb' }));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const msSince = (t: bigint) => Number(process.hrtime.bigint() - t) / 1e6;

const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * DuckDB returns integer columns as BigInt, which JSON.stringify refuses to
 * serialize — so any result set containing one used to fail the request. Narrow
 * to a number where that is lossless, and fall back to a string beyond the
 * safe-integer range rather than silently corrupting the value.
 */
export function toJsonSafe(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] =
        typeof value === 'bigint'
          ? value >= MIN_SAFE && value <= MAX_SAFE
            ? Number(value)
            : value.toString()
          : value;
    }
    return out;
  });
}

app.post('/query', async (req, res) => {
  const { ast, csv } = req.body as { ast: QueryAST; csv: string };
  const receivedAt = req.receivedAt ?? process.hrtime.bigint();
  const handlerAt = process.hrtime.bigint();
  const tempFile = path.join('/tmp', `hqe_${Date.now()}.csv`);

  try {
    fs.writeFileSync(tempFile, csv);
    const spilledAt = process.hrtime.bigint();

    const db = new duckdb.Database(':memory:');
    const conn = db.connect();
    const sql = astToSql(ast, `read_csv_auto('${tempFile}')`);

    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      conn.all(sql, (err, result) => {
        conn.close();
        if (err) reject(err);
        else resolve(result as Record<string, unknown>[]);
      });
    });

    res.json({
      rows: toJsonSafe(rows),
      // Kept for the existing UI badge: query execution as the client sees it.
      executionTime: Math.round(msSince(handlerAt)),
      timing: {
        bodyParseMs: +(Number(handlerAt - receivedAt) / 1e6).toFixed(1),
        spillToDiskMs: +(Number(spilledAt - handlerAt) / 1e6).toFixed(1),
        duckdbMs: +msSince(spilledAt).toFixed(1),
        serverTotalMs: +msSince(receivedAt).toFixed(1),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});

export { app };
