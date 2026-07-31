import { parse } from '../index';

describe('SELECT clause', () => {
  test('parses SELECT *', () => {
    const ast = parse('SELECT * FROM sales');
    expect(ast.select).toEqual([{ type: 'star' }]);
    expect(ast.from).toBe('sales');
  });

  test('parses column list', () => {
    const ast = parse('SELECT region, revenue FROM sales');
    expect(ast.select).toEqual([
      { type: 'column', name: 'region' },
      { type: 'column', name: 'revenue' },
    ]);
  });

  test('parses aggregate functions', () => {
    const ast = parse('SELECT region, SUM(revenue), COUNT(*) FROM sales');
    expect(ast.select[1]).toEqual({ type: 'aggregate', fn: 'SUM', col: 'revenue', alias: undefined });
    expect(ast.select[2]).toEqual({ type: 'aggregate', fn: 'COUNT', col: '*', alias: undefined });
  });

  test('parses aggregate with alias', () => {
    const ast = parse('SELECT SUM(revenue) AS total FROM sales');
    expect(ast.select[0]).toEqual({ type: 'aggregate', fn: 'SUM', col: 'revenue', alias: 'total' });
  });
});

describe('WHERE clause', () => {
  test('parses simple comparison', () => {
    const ast = parse("SELECT * FROM sales WHERE region = 'west'");
    expect(ast.where).toEqual({ type: 'comparison', col: 'region', op: '=', val: 'west' });
  });

  test('parses numeric comparison', () => {
    const ast = parse('SELECT * FROM sales WHERE revenue > 1000');
    expect(ast.where).toEqual({ type: 'comparison', col: 'revenue', op: '>', val: 1000 });
  });

  test('parses AND condition', () => {
    const ast = parse("SELECT * FROM sales WHERE region = 'west' AND revenue > 500");
    expect(ast.where?.type).toBe('and');
  });

  test('parses OR condition', () => {
    const ast = parse("SELECT * FROM sales WHERE region = 'west' OR region = 'east'");
    expect(ast.where?.type).toBe('or');
  });
});

describe('GROUP BY clause', () => {
  test('parses GROUP BY single column', () => {
    const ast = parse('SELECT region, SUM(revenue) FROM sales GROUP BY region');
    expect(ast.groupBy).toEqual(['region']);
  });

  test('parses GROUP BY multiple columns', () => {
    const ast = parse('SELECT region, product, SUM(revenue) FROM sales GROUP BY region, product');
    expect(ast.groupBy).toEqual(['region', 'product']);
  });
});

describe('ORDER BY clause', () => {
  test('parses ORDER BY column ASC', () => {
    const ast = parse('SELECT * FROM sales ORDER BY revenue ASC');
    expect(ast.orderBy).toEqual([{ col: 'revenue', fn: undefined, dir: 'ASC' }]);
  });

  test('parses ORDER BY column DESC', () => {
    const ast = parse('SELECT * FROM sales ORDER BY revenue DESC');
    expect(ast.orderBy?.[0].dir).toBe('DESC');
  });

  test('parses ORDER BY aggregate', () => {
    const ast = parse('SELECT region, SUM(revenue) FROM sales GROUP BY region ORDER BY SUM(revenue) DESC');
    expect(ast.orderBy).toEqual([{ col: 'revenue', fn: 'SUM', dir: 'DESC' }]);
  });
});

describe('LIMIT clause', () => {
  test('parses LIMIT', () => {
    const ast = parse('SELECT * FROM sales LIMIT 10');
    expect(ast.limit).toBe(10);
  });
});

describe('full query', () => {
  test('parses a complete query', () => {
    const ast = parse(
      "SELECT region, SUM(revenue), COUNT(*) FROM sales WHERE date > '2024-01-01' GROUP BY region ORDER BY SUM(revenue) DESC LIMIT 10"
    );
    expect(ast.from).toBe('sales');
    expect(ast.select).toHaveLength(3);
    expect(ast.where).toBeDefined();
    expect(ast.groupBy).toEqual(['region']);
    expect(ast.orderBy?.[0].dir).toBe('DESC');
    expect(ast.limit).toBe(10);
  });
});
