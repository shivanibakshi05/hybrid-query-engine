import { QueryAST } from '@hybrid-query-engine/parser';

export async function queryServer(
  ast: QueryAST,
  csv: string
): Promise<{ rows: Record<string, unknown>[]; executionTime: number }> {
  const res = await fetch('http://localhost:3001/query', {
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
