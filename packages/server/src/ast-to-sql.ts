import { QueryAST, WhereClause, SelectColumn } from '@hybrid-query-engine/parser';

function whereToSql(where: WhereClause): string {
  if (where.type === 'comparison') {
    const val = typeof where.val === 'string' ? `'${where.val}'` : where.val;
    return `${where.col} ${where.op} ${val}`;
  }
  if (where.type === 'and') {
    return `(${whereToSql(where.left)} AND ${whereToSql(where.right)})`;
  }
  return `(${whereToSql(where.left)} OR ${whereToSql(where.right)})`;
}

function selectColToSql(col: SelectColumn): string {
  if (col.type === 'star') return '*';
  if (col.type === 'column') return col.name;
  const expr = `${col.fn}(${col.col})`;
  return col.alias ? `${expr} AS ${col.alias}` : expr;
}

export function astToSql(ast: QueryAST, fromClause: string): string {
  const select = ast.select.map(selectColToSql).join(', ');
  let sql = `SELECT ${select} FROM ${fromClause}`;

  if (ast.where) sql += ` WHERE ${whereToSql(ast.where)}`;

  if (ast.groupBy && ast.groupBy.length > 0) {
    sql += ` GROUP BY ${ast.groupBy.join(', ')}`;
  }

  if (ast.orderBy && ast.orderBy.length > 0) {
    const clauses = ast.orderBy.map(o => {
      const col = o.fn ? `${o.fn}(${o.col})` : o.col;
      return `${col} ${o.dir}`;
    });
    sql += ` ORDER BY ${clauses.join(', ')}`;
  }

  if (ast.limit !== undefined) sql += ` LIMIT ${ast.limit}`;

  return sql;
}
