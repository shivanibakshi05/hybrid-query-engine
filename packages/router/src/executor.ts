import { QueryAST, WhereClause, SelectColumn } from '@hybrid-query-engine/parser';

export interface DataFrameInstance {
  filter(col: string, op: string, val: string): DataFrameInstance;
  group_aggregate(groupCol: string, aggFn: string, aggCol: string): DataFrameInstance;
  sort(col: string, ascending: boolean): DataFrameInstance;
  to_json(): string;
  free(): void;
}

export interface DataFrameClass {
  from_csv(csv: string): DataFrameInstance;
}

function flattenAnd(where: WhereClause): WhereClause[] {
  if (where.type === 'and') {
    return [...flattenAnd(where.left), ...flattenAnd(where.right)];
  }
  return [where];
}

export function executeQuery(
  ast: QueryAST,
  csv: string,
  DFClass: DataFrameClass
): Record<string, unknown>[] {
  let df = DFClass.from_csv(csv);
  let aggregate: Extract<SelectColumn, { type: 'aggregate' }> | undefined;

  try {
    if (ast.where) {
      for (const cond of flattenAnd(ast.where)) {
        if (cond.type === 'comparison') {
          const next = df.filter(cond.col, cond.op, String(cond.val));
          df.free();
          df = next;
        }
      }
    }

    if (ast.groupBy && ast.groupBy.length > 0) {
      const groupCol = ast.groupBy[0];
      aggregate = ast.select.find(
        (s): s is Extract<SelectColumn, { type: 'aggregate' }> => s.type === 'aggregate'
      );
      if (aggregate) {
        const next = df.group_aggregate(groupCol, aggregate.fn, aggregate.col);
        df.free();
        df = next;
      }
    }

    if (ast.orderBy && ast.orderBy.length > 0) {
      const order = ast.orderBy[0];
      const next = df.sort(order.col, order.dir === 'ASC');
      df.free();
      df = next;
    }

    let rows: Record<string, unknown>[] = JSON.parse(df.to_json());

    // The engine names the aggregate column after its source, and ORDER BY
    // still refers to that name, so SELECT ... AS alias is applied last.
    const alias = aggregate?.alias;
    if (alias && alias !== aggregate!.col) {
      const source = aggregate!.col;
      rows = rows.map(({ [source]: value, ...rest }) => ({ ...rest, [alias]: value }));
    }

    if (ast.limit !== undefined) {
      rows = rows.slice(0, ast.limit);
    }

    return rows;
  } finally {
    df.free();
  }
}
