import { tokenize, Token } from './lexer';
import { QueryAST, SelectColumn, WhereClause, OrderByClause, Operator } from './types';

const AGGREGATE_FNS = new Set(['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']);

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  private expect(value: string): Token {
    const t = this.consume();
    if (t.value !== value) throw new Error(`Expected '${value}' but got '${t.value}'`);
    return t;
  }

  private isKeyword(value: string): boolean {
    return this.peek().type === 'KEYWORD' && this.peek().value === value;
  }

  parse(): QueryAST {
    this.expect('SELECT');
    const select = this.parseSelectList();
    this.expect('FROM');
    const from = this.consume().value.toLowerCase();

    const ast: QueryAST = { select, from };

    if (this.isKeyword('WHERE')) {
      this.consume();
      ast.where = this.parseWhere();
    }

    if (this.isKeyword('GROUP')) {
      this.consume();
      this.expect('BY');
      ast.groupBy = this.parseIdentifierList();
    }

    if (this.isKeyword('ORDER')) {
      this.consume();
      this.expect('BY');
      ast.orderBy = this.parseOrderByList();
    }

    if (this.isKeyword('LIMIT')) {
      this.consume();
      ast.limit = parseInt(this.consume().value, 10);
    }

    return ast;
  }

  private parseSelectList(): SelectColumn[] {
    const cols: SelectColumn[] = [];
    cols.push(this.parseSelectColumn());
    while (this.peek().type === 'COMMA') {
      this.consume();
      cols.push(this.parseSelectColumn());
    }
    return cols;
  }

  private parseSelectColumn(): SelectColumn {
    const t = this.peek();

    if (t.type === 'STAR') {
      this.consume();
      return { type: 'star' };
    }

    if (t.type === 'KEYWORD' && AGGREGATE_FNS.has(t.value)) {
      const fn = this.consume().value as 'SUM' | 'COUNT' | 'AVG' | 'MIN' | 'MAX';
      this.expect('(');
      const col = this.peek().type === 'STAR' ? (this.consume().value) : this.consume().value.toLowerCase();
      this.expect(')');
      let alias: string | undefined;
      if (this.isKeyword('AS')) {
        this.consume();
        alias = this.consume().value.toLowerCase();
      }
      return { type: 'aggregate', fn, col, alias };
    }

    const name = this.consume().value.toLowerCase();
    return { type: 'column', name };
  }

  private parseIdentifierList(): string[] {
    const ids: string[] = [this.consume().value.toLowerCase()];
    while (this.peek().type === 'COMMA') {
      this.consume();
      ids.push(this.consume().value.toLowerCase());
    }
    return ids;
  }

  private parseOrderByList(): OrderByClause[] {
    const items: OrderByClause[] = [];
    items.push(this.parseOrderByItem());
    while (this.peek().type === 'COMMA') {
      this.consume();
      items.push(this.parseOrderByItem());
    }
    return items;
  }

  private parseOrderByItem(): OrderByClause {
    const t = this.peek();
    let col: string;
    let fn: OrderByClause['fn'];

    if (t.type === 'KEYWORD' && AGGREGATE_FNS.has(t.value)) {
      fn = this.consume().value as OrderByClause['fn'];
      this.expect('(');
      col = this.consume().value.toLowerCase();
      this.expect(')');
    } else {
      col = this.consume().value.toLowerCase();
    }

    let dir: 'ASC' | 'DESC' = 'ASC';
    if (this.isKeyword('ASC') || this.isKeyword('DESC')) {
      dir = this.consume().value as 'ASC' | 'DESC';
    }

    return { col, fn, dir };
  }

  private parseWhere(): WhereClause {
    let left = this.parseWhereAtom();

    while (this.isKeyword('AND') || this.isKeyword('OR')) {
      const op = this.consume().value;
      const right = this.parseWhereAtom();
      left = { type: op === 'AND' ? 'and' : 'or', left, right };
    }

    return left;
  }

  private parseWhereAtom(): WhereClause {
    const col = this.consume().value.toLowerCase();
    const opToken = this.consume();
    const op = opToken.value as Operator;

    if (op === 'IN') {
      this.expect('(');
      const vals: string[] = [];
      vals.push(this.consume().value);
      while (this.peek().type === 'COMMA') {
        this.consume();
        vals.push(this.consume().value);
      }
      this.expect(')');
      return { type: 'comparison', col, op: 'IN', val: vals };
    }

    const valToken = this.consume();
    const val = valToken.type === 'NUMBER' ? parseFloat(valToken.value) : valToken.value;
    return { type: 'comparison', col, op, val };
  }
}

export function parse(sql: string): QueryAST {
  const tokens = tokenize(sql);
  return new Parser(tokens).parse();
}
