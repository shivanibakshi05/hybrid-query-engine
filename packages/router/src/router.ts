import { QueryAST, WhereClause } from '@hybrid-query-engine/parser';

export type Route = 'wasm' | 'server';

const MB_100 = 100 * 1024 * 1024;

function hasOrCondition(where: WhereClause): boolean {
  if (where.type === 'or') return true;
  if (where.type === 'and') {
    return hasOrCondition(where.left) || hasOrCondition(where.right);
  }
  return false;
}

export function route(ast: QueryAST, fileSizeBytes: number, isOnline: boolean): Route {
  if (!isOnline) return 'wasm';
  if (fileSizeBytes > MB_100) return 'server';
  if (ast.where && hasOrCondition(ast.where)) return 'server';
  return 'wasm';
}
