export type SelectColumn =
  | { type: 'column'; name: string }
  | { type: 'aggregate'; fn: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX'; col: string; alias?: string }
  | { type: 'star' };

export type Operator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'IN';

export type WhereClause =
  | { type: 'comparison'; col: string; op: Operator; val: string | number | string[] }
  | { type: 'and'; left: WhereClause; right: WhereClause }
  | { type: 'or'; left: WhereClause; right: WhereClause };

export type OrderByClause = {
  col: string;
  fn?: 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
  dir: 'ASC' | 'DESC';
};

export interface QueryAST {
  select: SelectColumn[];
  from: string;
  where?: WhereClause;
  groupBy?: string[];
  orderBy?: OrderByClause[];
  limit?: number;
}
