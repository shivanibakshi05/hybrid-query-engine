import express from 'express';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import { QueryAST } from '@hybrid-query-engine/parser';
import { astToSql } from './ast-to-sql';

const app = express();
app.use(express.json({ limit: '500mb' }));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.post('/query', async (req, res) => {
  const { ast, csv } = req.body as { ast: QueryAST; csv: string };
  const start = Date.now();
  const tempFile = path.join('/tmp', `hqe_${Date.now()}.csv`);

  try {
    fs.writeFileSync(tempFile, csv);

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

    res.json({ rows, executionTime: Date.now() - start });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});

export { app };
