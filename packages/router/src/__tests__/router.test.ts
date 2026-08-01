import { route } from '../router';
import { QueryAST } from '@hybrid-query-engine/parser';

const MB_100 = 100 * 1024 * 1024;

const simpleAst: QueryAST = {
  select: [{ type: 'star' }],
  from: 'sales',
};

describe('route()', () => {
  test('small dataset online → wasm', () => {
    expect(route(simpleAst, MB_100 - 1, true)).toBe('wasm');
  });

  test('large dataset online → server', () => {
    expect(route(simpleAst, MB_100 + 1, true)).toBe('server');
  });

  test('large dataset offline → wasm (offline overrides size)', () => {
    expect(route(simpleAst, MB_100 + 1, false)).toBe('wasm');
  });

  test('OR condition → server', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: {
        type: 'or',
        left: { type: 'comparison', col: 'revenue', op: '>', val: 1000 },
        right: { type: 'comparison', col: 'revenue', op: '<', val: 100 },
      },
    };
    expect(route(ast, 1024, true)).toBe('server');
  });

  test('AND condition → wasm', () => {
    const ast: QueryAST = {
      select: [{ type: 'star' }],
      from: 'sales',
      where: {
        type: 'and',
        left: { type: 'comparison', col: 'revenue', op: '>', val: 100 },
        right: { type: 'comparison', col: 'revenue', op: '<', val: 2000 },
      },
    };
    expect(route(ast, 1024, true)).toBe('wasm');
  });
});
