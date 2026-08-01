import { DataFrame } from '../../../engine-wasm/pkg-node/engine_wasm';
import { executeQuery } from '../executor';
import { parse } from '@hybrid-query-engine/parser';

const CSV = `name,region,revenue
Alice,North,1000
Bob,South,500
Carol,North,2000
Dave,South,1500`;

describe('executeQuery()', () => {
  test('filter: WHERE revenue > 999', () => {
    const ast = parse('SELECT * FROM sales WHERE revenue > 999');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows).toHaveLength(3);
  });

  test('filter: WHERE revenue > 1500', () => {
    const ast = parse('SELECT * FROM sales WHERE revenue > 1500');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBe(2000);
  });

  test('GROUP BY with SUM', () => {
    const ast = parse('SELECT region, SUM(revenue) FROM sales GROUP BY region');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows).toHaveLength(2);
    const north = rows.find(r => r.region === 'North');
    const south = rows.find(r => r.region === 'South');
    expect(north?.revenue).toBe(3000);
    expect(south?.revenue).toBe(2000);
  });

  test('ORDER BY revenue DESC', () => {
    const ast = parse('SELECT * FROM sales ORDER BY revenue DESC');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows[0].revenue).toBe(2000);
    expect(rows[3].revenue).toBe(500);
  });

  test('LIMIT 2', () => {
    const ast = parse('SELECT * FROM sales ORDER BY revenue DESC LIMIT 2');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows).toHaveLength(2);
  });

  test('AND: WHERE revenue > 600 AND revenue < 1500', () => {
    const ast = parse('SELECT * FROM sales WHERE revenue > 600 AND revenue < 1500');
    const rows = executeQuery(ast, CSV, DataFrame);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');
  });
});
