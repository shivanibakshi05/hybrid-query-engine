import { astToSql } from '../ast-to-sql';
import { QueryAST } from '@hybrid-query-engine/parser';

describe('astToSql()', () => {
  test('SELECT *', () => {
    const ast: QueryAST = { select: [{ type: 'star' }], from: 'sales' };
    expect(astToSql(ast, 'data')).toBe('SELECT * FROM data');
  });

  test('SELECT columns', () => {
    const ast: QueryAST = {
      select: [{ type: 'column', name: 'region' }, { type: 'column', name: 'revenue' }],
      from: 'sales',
    };
    expect(astToSql(ast, 'data')).toBe('SELECT region, revenue FROM data');
  });

  test('WHERE comparison (number)', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: { type: 'comparison', col: 'revenue', op: '>', val: 1000 },
    };
    expect(astToSql(ast, 'data')).toBe('SELECT * FROM data WHERE revenue > 1000');
  });

  test('WHERE comparison (string)', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: { type: 'comparison', col: 'region', op: '=', val: 'North' },
    };
    expect(astToSql(ast, 'data')).toBe("SELECT * FROM data WHERE region = 'North'");
  });

  test('WHERE AND', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: {
        type: 'and',
        left: { type: 'comparison', col: 'revenue', op: '>', val: 500 },
        right: { type: 'comparison', col: 'region', op: '=', val: 'North' },
      },
    };
    expect(astToSql(ast, 'data')).toBe("SELECT * FROM data WHERE (revenue > 500 AND region = 'North')");
  });

  test('WHERE OR', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: {
        type: 'or',
        left: { type: 'comparison', col: 'revenue', op: '>', val: 1500 },
        right: { type: 'comparison', col: 'revenue', op: '<', val: 200 },
      },
    };
    expect(astToSql(ast, 'data')).toBe('SELECT * FROM data WHERE (revenue > 1500 OR revenue < 200)');
  });

  test('GROUP BY with aggregate', () => {
    const ast: QueryAST = {
      select: [{ type: 'column', name: 'region' }, { type: 'aggregate', fn: 'SUM', col: 'revenue' }],
      from: 'sales',
      groupBy: ['region'],
    };
    expect(astToSql(ast, 'data')).toBe('SELECT region, SUM(revenue) FROM data GROUP BY region');
  });

  test('ORDER BY and LIMIT', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      orderBy: [{ col: 'revenue', dir: 'DESC' }],
      limit: 10,
    };
    expect(astToSql(ast, 'data')).toBe('SELECT * FROM data ORDER BY revenue DESC LIMIT 10');
  });
});
