export type TokenType =
  | 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING'
  | 'COMMA' | 'DOT' | 'LPAREN' | 'RPAREN'
  | 'STAR' | 'OP' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER',
  'LIMIT', 'AND', 'OR', 'ASC', 'DESC', 'AS', 'IN', 'LIKE',
  'SUM', 'COUNT', 'AVG', 'MIN', 'MAX',
]);

const OPS = new Set(['=', '!=', '>=', '<=', '>', '<']);

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.trim();

  while (i < src.length) {
    // skip whitespace
    if (/\s/.test(src[i])) { i++; continue; }

    // string literal
    if (src[i] === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== "'") j++;
      tokens.push({ type: 'STRING', value: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // two-char operators
    if (i + 1 < src.length && OPS.has(src.slice(i, i + 2))) {
      tokens.push({ type: 'OP', value: src.slice(i, i + 2) });
      i += 2;
      continue;
    }

    // single-char operators and punctuation
    const single = src[i];
    if (OPS.has(single)) { tokens.push({ type: 'OP', value: single }); i++; continue; }
    if (single === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }
    if (single === '.') { tokens.push({ type: 'DOT', value: '.' }); i++; continue; }
    if (single === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
    if (single === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
    if (single === '*') { tokens.push({ type: 'STAR', value: '*' }); i++; continue; }

    // number
    if (/\d/.test(single)) {
      let j = i;
      while (j < src.length && /[\d.]/.test(src[j])) j++;
      tokens.push({ type: 'NUMBER', value: src.slice(i, j) });
      i = j;
      continue;
    }

    // identifier or keyword
    if (/[a-zA-Z_]/.test(single)) {
      let j = i;
      while (j < src.length && /[\w]/.test(src[j])) j++;
      const word = src.slice(i, j).toUpperCase();
      tokens.push({ type: KEYWORDS.has(word) ? 'KEYWORD' : 'IDENTIFIER', value: word });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character '${single}' at position ${i}`);
  }

  tokens.push({ type: 'EOF', value: '' });
  return tokens;
}
