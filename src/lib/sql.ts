import type { CellValue, ColumnType, Row, TableDef } from "./database";

export class QueryError extends Error {
  hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "QueryError";
    this.hint = hint;
  }
}

export interface ResultColumn {
  key: string;
  label: string;
  type?: ColumnType;
}

export interface QueryResult {
  columns: ResultColumn[];
  rows: CellValue[][];
  ms: number;
  scanned: number;
  sql: string;
  affected: number;
}

type TokenType = "kw" | "id" | "num" | "str" | "op" | "punct" | "eof";

interface Token {
  type: TokenType;
  value: string;
  upper: string;
  pos: number;
}

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "JOIN", "LEFT", "RIGHT", "OUTER", "INNER", "CROSS", "ON", "AS", "DISTINCT",
  "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "IS", "NULL", "ASC", "DESC",
  "CASE", "WHEN", "THEN", "ELSE", "END", "CAST", "TRUE", "FALSE", "UNION", "ALL",
]);

const AGGREGATES = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX", "GROUP_CONCAT", "TOTAL"]);
const SCALARS = new Set([
  "ROUND", "ABS", "UPPER", "LOWER", "LENGTH", "COALESCE", "IFNULL", "TRIM",
  "SUBSTR", "MIN", "MAX",
]);

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "-" && next === "-") {
      const newline = sql.indexOf("\n", index);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }

    if (char === "/" && next === "*") {
      const close = sql.indexOf("*/", index + 2);
      index = close === -1 ? sql.length : close + 2;
      continue;
    }

    if (char === "'") {
      const start = index;
      index += 1;
      let value = "";
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          value += "'";
          index += 2;
        } else if (sql[index] === "'") {
          index += 1;
          break;
        } else {
          value += sql[index];
          index += 1;
        }
      }
      tokens.push({ type: "str", value, upper: value, pos: start });
      continue;
    }

    if (char === '"' || char === "`" || char === "[") {
      const closeChar = char === "[" ? "]" : char;
      const start = index;
      index += 1;
      let value = "";
      while (index < sql.length && sql[index] !== closeChar) {
        value += sql[index];
        index += 1;
      }
      index += 1;
      tokens.push({ type: "id", value, upper: value.toUpperCase(), pos: start });
      continue;
    }

    if (/[0-9]/.test(char) || (char === "." && next !== undefined && /[0-9]/.test(next))) {
      const start = index;
      let value = "";
      while (index < sql.length && /[0-9._]/.test(sql[index])) {
        value += sql[index];
        index += 1;
      }
      tokens.push({ type: "num", value, upper: value, pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      let value = "";
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index])) {
        value += sql[index];
        index += 1;
      }
      const upper = value.toUpperCase();
      tokens.push({ type: KEYWORDS.has(upper) ? "kw" : "id", value, upper, pos: start });
      continue;
    }

    const twoChar = sql.slice(index, index + 2);
    if (["<=", ">=", "!=", "<>", "||", "=="].includes(twoChar)) {
      tokens.push({ type: "op", value: twoChar, upper: twoChar, pos: index });
      index += 2;
      continue;
    }

    if ("=<>+-*/%".includes(char)) {
      tokens.push({ type: "op", value: char, upper: char, pos: index });
      index += 1;
      continue;
    }

    if ("(),.;".includes(char)) {
      tokens.push({ type: "punct", value: char, upper: char, pos: index });
      index += 1;
      continue;
    }

    throw new QueryError(`Unexpected character "${char}" at position ${index + 1}.`, "Only SELECT queries are supported by this local engine.");
  }

  tokens.push({ type: "eof", value: "", upper: "", pos: sql.length });
  return tokens;
}

type Expr =
  | { kind: "lit"; value: CellValue }
  | { kind: "col"; table?: string; name: string }
  | { kind: "star"; table?: string }
  | { kind: "binary"; op: string; left: Expr; right: Expr }
  | { kind: "unary"; op: string; expr: Expr }
  | { kind: "call"; name: string; args: Expr[]; distinct: boolean }
  | { kind: "case"; cases: { when: Expr; then: Expr }[]; otherwise?: Expr }
  | { kind: "in"; expr: Expr; values: Expr[]; negate: boolean }
  | { kind: "between"; expr: Expr; low: Expr; high: Expr; negate: boolean }
  | { kind: "isNull"; expr: Expr; negate: boolean }
  | { kind: "like"; expr: Expr; pattern: Expr; negate: boolean }
  | { kind: "cast"; expr: Expr; target: ColumnType };

interface SelectItem {
  expr: Expr;
  alias?: string;
}

interface Source {
  table: string;
  alias: string;
}

interface JoinSource extends Source {
  type: "INNER" | "LEFT";
  on: Expr;
}

interface Statement {
  distinct: boolean;
  items: SelectItem[];
  from?: Source;
  joins: JoinSource[];
  where?: Expr;
  groupBy: Expr[];
  having?: Expr;
  orderBy: { expr: Expr; direction: "ASC" | "DESC" }[];
  limit?: number;
  offset?: number;
}

class Parser {
  private tokens: Token[];
  private index = 0;

  constructor(sql: string) {
    this.tokens = tokenize(sql);
  }

  private current(): Token {
    return this.tokens[this.index];
  }

  private peek(offset = 1): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.current();
    this.index += 1;
    return token;
  }

  private isKeyword(word: string): boolean {
    return this.current().type === "kw" && this.current().upper === word;
  }

  private matchKeyword(...words: string[]): boolean {
    if (this.current().type === "kw" && words.includes(this.current().upper)) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expectKeyword(word: string): void {
    if (!this.matchKeyword(word)) {
      throw new QueryError(
        `Expected ${word} near "${this.current().value || "end of query"}".`,
        `${word} is required here. Check the statement structure.`,
      );
    }
  }

  private matchPunct(value: string): boolean {
    if (this.current().type === "punct" && this.current().value === value) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private matchStar(): boolean {
    if (this.current().value === "*" && (this.current().type === "op" || this.current().type === "punct")) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private expectPunct(value: string): void {
    if (!this.matchPunct(value)) {
      throw new QueryError(`Expected "${value}" near "${this.current().value || "end of query"}".`);
    }
  }

  private identifier(): string {
    const token = this.current();
    if (token.type !== "id" && token.type !== "kw") {
      throw new QueryError(`Expected an identifier near "${token.value || "end of query"}".`);
    }
    this.index += 1;
    return token.value;
  }

  parse(): Statement {
    if (this.current().type === "eof") {
      throw new QueryError("Your query is empty.", "Write a SELECT statement or load a preset query.");
    }
    if (this.isKeyword("WITH")) {
      throw new QueryError("Common table expressions are not supported yet.", "Use a JOIN or a derived column expression instead.");
    }
    this.expectKeyword("SELECT");
    const distinct = this.matchKeyword("DISTINCT");
    const items: SelectItem[] = [];

    do {
      items.push(this.parseSelectItem());
    } while (this.matchPunct(","));

    let from: Source | undefined;
    const joins: JoinSource[] = [];

    if (this.matchKeyword("FROM")) {
      from = this.parseSource();
      while (true) {
        let joinType: "INNER" | "LEFT" | null = null;
        if (this.matchKeyword("LEFT")) {
          this.matchKeyword("OUTER");
          joinType = "LEFT";
        } else if (this.matchKeyword("INNER")) {
          joinType = "INNER";
        } else if (this.isKeyword("JOIN")) {
          joinType = "INNER";
        }
        if (joinType === null) break;
        this.expectKeyword("JOIN");
        const source = this.parseSource();
        this.expectKeyword("ON");
        joins.push({ ...source, type: joinType, on: this.parseOr() });
      }
    }

    const where = this.matchKeyword("WHERE") ? this.parseOr() : undefined;

    let groupBy: Expr[] = [];
    if (this.matchKeyword("GROUP")) {
      this.expectKeyword("BY");
      groupBy = [];
      do {
        groupBy.push(this.parseOr());
      } while (this.matchPunct(","));
    }

    const having = this.matchKeyword("HAVING") ? this.parseOr() : undefined;

    const orderBy: { expr: Expr; direction: "ASC" | "DESC" }[] = [];
    if (this.matchKeyword("ORDER")) {
      this.expectKeyword("BY");
      do {
        const expr = this.parseOr();
        const direction = this.matchKeyword("DESC") ? "DESC" : (this.matchKeyword("ASC"), "ASC");
        orderBy.push({ expr, direction });
      } while (this.matchPunct(","));
    }

    let limit: number | undefined;
    let offset: number | undefined;
    if (this.matchKeyword("LIMIT")) {
      limit = this.parseNonNegativeInteger("LIMIT");
      if (this.matchPunct(",")) {
        offset = limit;
        limit = this.parseNonNegativeInteger("LIMIT");
      } else if (this.matchKeyword("OFFSET")) {
        offset = this.parseNonNegativeInteger("OFFSET");
      }
    } else if (this.matchKeyword("OFFSET")) {
      offset = this.parseNonNegativeInteger("OFFSET");
    }

    this.matchPunct(";");
    if (this.current().type !== "eof") {
      throw new QueryError(
        `Unexpected "${this.current().value}" after the query.`,
        "Run one SELECT statement at a time in this workspace.",
      );
    }

    return { distinct, items, from, joins, where, groupBy, having, orderBy, limit, offset };
  }

  private parseNonNegativeInteger(label: string): number {
    const token = this.current();
    if (token.type !== "num" || Number.isNaN(Number(token.value)) || !Number.isInteger(Number(token.value))) {
      throw new QueryError(`${label} expects a whole number.`);
    }
    this.index += 1;
    return Number(token.value);
  }

  private parseSelectItem(): SelectItem {
    if (this.matchStar()) return { expr: { kind: "star" } };
    if (this.current().type === "id" && this.peek().value === "." && this.peek(2).value === "*") {
      const table = this.identifier();
      this.next();
      this.next();
      return { expr: { kind: "star", table } };
    }
    const expr = this.parseOr();
    const alias = this.matchKeyword("AS") ? this.identifier() : undefined;
    return { expr, alias };
  }

  private parseSource(): Source {
    if (this.matchPunct("(")) {
      throw new QueryError("Subqueries are not supported in this studio build.", "Try a direct JOIN or filter the base table instead.");
    }
    const table = this.identifier();
    let alias = table;
    if (this.matchKeyword("AS")) alias = this.identifier();
    else if (this.current().type === "id") alias = this.identifier();
    return { table, alias };
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.matchKeyword("OR")) {
      left = { kind: "binary", op: "OR", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.matchKeyword("AND")) {
      left = { kind: "binary", op: "AND", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.matchKeyword("NOT")) return { kind: "unary", op: "NOT", expr: this.parseNot() };
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    if (this.current().type === "op" && ["=", "==", "!=", "<>", "<", ">", "<=", ">="].includes(this.current().value)) {
      const operator = this.next().value;
      return { kind: "binary", op: operator, left, right: this.parseAdditive() };
    }

    let negate = false;
    if (this.isKeyword("NOT") && ["IN", "LIKE", "BETWEEN"].includes(this.peek().upper)) {
      this.next();
      negate = true;
    }

    if (this.matchKeyword("IS")) {
      const not = this.matchKeyword("NOT");
      this.expectKeyword("NULL");
      return { kind: "isNull", expr: left, negate: not };
    }
    if (this.matchKeyword("LIKE")) {
      return { kind: "like", expr: left, pattern: this.parseAdditive(), negate };
    }
    if (this.matchKeyword("IN")) {
      this.expectPunct("(");
      const values: Expr[] = [];
      if (!this.matchPunct(")")) {
        do {
          values.push(this.parseOr());
        } while (this.matchPunct(","));
        this.expectPunct(")");
      }
      return { kind: "in", expr: left, values, negate };
    }
    if (this.matchKeyword("BETWEEN")) {
      const low = this.parseAdditive();
      this.expectKeyword("AND");
      const high = this.parseAdditive();
      return { kind: "between", expr: left, low, high, negate };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.current().type === "op" && ["+", "-", "||"].includes(this.current().value)) {
      const operator = this.next().value;
      left = { kind: "binary", op: operator, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.current().type === "op" && ["*", "/", "%"].includes(this.current().value)) {
      const operator = this.next().value;
      left = { kind: "binary", op: operator, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.current().type === "op" && ["-", "+"].includes(this.current().value)) {
      return { kind: "unary", op: this.next().value, expr: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.current();
    if (this.matchPunct("(")) {
      const expr = this.parseOr();
      this.expectPunct(")");
      return expr;
    }
    if (token.type === "num") {
      this.next();
      return { kind: "lit", value: Number(token.value) };
    }
    if (token.type === "str") {
      this.next();
      return { kind: "lit", value: token.value };
    }
    if (this.matchKeyword("NULL")) return { kind: "lit", value: null };
    if (this.matchKeyword("TRUE")) return { kind: "lit", value: true };
    if (this.matchKeyword("FALSE")) return { kind: "lit", value: false };
    if (this.matchKeyword("CASE")) {
      const cases: { when: Expr; then: Expr }[] = [];
      while (this.matchKeyword("WHEN")) {
        const when = this.parseOr();
        this.expectKeyword("THEN");
        cases.push({ when, then: this.parseOr() });
      }
      const otherwise = this.matchKeyword("ELSE") ? this.parseOr() : undefined;
      this.expectKeyword("END");
      return { kind: "case", cases, otherwise };
    }
    if (this.matchKeyword("CAST")) {
      this.expectPunct("(");
      const expr = this.parseOr();
      this.expectKeyword("AS");
      const rawType = this.identifier().toUpperCase();
      const allowed: ColumnType[] = ["INTEGER", "TEXT", "REAL", "BLOB"];
      const target = (allowed.find((type) => type === rawType) ?? "TEXT") as ColumnType;
      this.expectPunct(")");
      return { kind: "cast", expr, target };
    }
    if (token.type === "id") {
      this.next();
      if (this.matchPunct("(")) {
        const args: Expr[] = [];
        const distinct = this.matchKeyword("DISTINCT");
        if (!this.matchPunct(")")) {
          do {
            if (this.matchStar()) args.push({ kind: "star" });
            else args.push(this.parseOr());
          } while (this.matchPunct(","));
          this.expectPunct(")");
        }
        return { kind: "call", name: token.upper, args, distinct };
      }
      if (this.matchPunct(".")) {
        const name = this.identifier();
        return { kind: "col", table: token.value, name };
      }
      return { kind: "col", name: token.value };
    }
    throw new QueryError(
      `Unexpected "${token.value || "end of query"}".`,
      "Check for a missing alias, comma, or closing parenthesis.",
    );
  }
}

function hasAggregate(expr: Expr): boolean {
  switch (expr.kind) {
    case "call":
      return AGGREGATES.has(expr.name) || expr.args.some(hasAggregate);
    case "binary":
      return hasAggregate(expr.left) || hasAggregate(expr.right);
    case "unary":
      return hasAggregate(expr.expr);
    case "case":
      return expr.cases.some((item) => hasAggregate(item.when) || hasAggregate(item.then)) || (expr.otherwise ? hasAggregate(expr.otherwise) : false);
    case "in":
      return hasAggregate(expr.expr) || expr.values.some(hasAggregate);
    case "between":
      return hasAggregate(expr.expr) || hasAggregate(expr.low) || hasAggregate(expr.high);
    case "isNull":
      return hasAggregate(expr.expr);
    case "like":
      return hasAggregate(expr.expr) || hasAggregate(expr.pattern);
    case "cast":
      return hasAggregate(expr.expr);
    default:
      return false;
  }
}

function walkExpressions(expr: Expr, visit: (column: Extract<Expr, { kind: "col" }>) => void): void {
  switch (expr.kind) {
    case "col":
      visit(expr);
      break;
    case "binary":
      walkExpressions(expr.left, visit);
      walkExpressions(expr.right, visit);
      break;
    case "unary":
      walkExpressions(expr.expr, visit);
      break;
    case "call":
      expr.args.forEach((arg) => walkExpressions(arg, visit));
      break;
    case "case":
      expr.cases.forEach((item) => {
        walkExpressions(item.when, visit);
        walkExpressions(item.then, visit);
      });
      if (expr.otherwise) walkExpressions(expr.otherwise, visit);
      break;
    case "in":
      walkExpressions(expr.expr, visit);
      expr.values.forEach((value) => walkExpressions(value, visit));
      break;
    case "between":
      walkExpressions(expr.expr, visit);
      walkExpressions(expr.low, visit);
      walkExpressions(expr.high, visit);
      break;
    case "isNull":
      walkExpressions(expr.expr, visit);
      break;
    case "like":
      walkExpressions(expr.expr, visit);
      walkExpressions(expr.pattern, visit);
      break;
    case "cast":
      walkExpressions(expr.expr, visit);
      break;
    default:
      break;
  }
}

function checkFunctions(expr: Expr): void {
  if (expr.kind === "call" && !AGGREGATES.has(expr.name) && !SCALARS.has(expr.name)) {
    throw new QueryError(`Unknown SQL function "${expr.name}".`, "Try COUNT, SUM, AVG, MIN, MAX, ROUND, COALESCE, UPPER or LOWER.");
  }
  switch (expr.kind) {
    case "binary":
      checkFunctions(expr.left);
      checkFunctions(expr.right);
      break;
    case "unary":
      checkFunctions(expr.expr);
      break;
    case "call":
      expr.args.forEach(checkFunctions);
      break;
    case "case":
      expr.cases.forEach((item) => {
        checkFunctions(item.when);
        checkFunctions(item.then);
      });
      if (expr.otherwise) checkFunctions(expr.otherwise);
      break;
    case "in":
      checkFunctions(expr.expr);
      expr.values.forEach(checkFunctions);
      break;
    case "between":
      checkFunctions(expr.expr);
      checkFunctions(expr.low);
      checkFunctions(expr.high);
      break;
    case "isNull":
      checkFunctions(expr.expr);
      break;
    case "like":
      checkFunctions(expr.expr);
      checkFunctions(expr.pattern);
      break;
    case "cast":
      checkFunctions(expr.expr);
      break;
    default:
      break;
  }
}

interface SourceMeta {
  table: TableDef;
  alias: string;
}

interface EvalContext {
  row: Row | null;
  group: Row[];
}

const AGGREGATE_FUNCTIONS = new Set(["COUNT", "SUM", "AVG", "MIN", "MAX", "TOTAL", "GROUP_CONCAT"]);

function asNumber(value: CellValue): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareValues(a: CellValue, b: CellValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function likeToRegex(pattern: string): RegExp {
  let source = "^";
  for (const char of pattern) {
    if (char === "%") source += ".*";
    else if (char === "_") source += ".";
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${source}$`, "i");
}

function aggregate(name: string, arg: Expr | null, rows: Row[], distinct: boolean): CellValue {
  if (name === "COUNT" && arg === null) return rows.length;
  let values = rows.map((row) => (arg ? evaluate(arg, { row, group: [] }) : null));
  if (distinct) {
    values = Array.from(new Set(values.map((value) => JSON.stringify(value)))).map((value) => JSON.parse(value) as CellValue);
  }
  values = values.filter((value) => value !== null && value !== undefined);

  switch (name) {
    case "COUNT":
      return values.length;
    case "SUM":
      return values.reduce<number>((sum, value) => sum + (asNumber(value) ?? 0), 0);
    case "TOTAL":
      return values.reduce<number>((sum, value) => sum + (asNumber(value) ?? 0), -0);
    case "AVG": {
      if (values.length === 0) return null;
      return values.reduce<number>((sum, value) => sum + (asNumber(value) ?? 0), 0) / values.length;
    }
    case "MIN":
      return values.length ? values.reduce((min, value) => (compareValues(value, min) < 0 ? value : min)) : null;
    case "MAX":
      return values.length ? values.reduce((max, value) => (compareValues(value, max) > 0 ? value : max)) : null;
    case "GROUP_CONCAT":
      return values.map((value) => String(value)).join(", ");
    default:
      return null;
  }
}

function evaluate(expr: Expr, context: EvalContext): CellValue {
  switch (expr.kind) {
    case "lit":
      return expr.value;
    case "col": {
      const row = context.row;
      if (!row) return null;
      const key = expr.table ? `${expr.table}.${expr.name}` : expr.name;
      return row[key] ?? null;
    }
    case "star":
      return 1;
    case "unary": {
      const value = evaluate(expr.expr, context);
      if (expr.op === "NOT") return !value;
      const numeric = asNumber(value);
      if (numeric === null) return null;
      return expr.op === "-" ? -numeric : numeric;
    }
    case "binary": {
      if (expr.op === "AND") {
        return Boolean(evaluate(expr.left, context)) && Boolean(evaluate(expr.right, context));
      }
      if (expr.op === "OR") {
        return Boolean(evaluate(expr.left, context)) || Boolean(evaluate(expr.right, context));
      }
      const left = evaluate(expr.left, context);
      const right = evaluate(expr.right, context);
      if (expr.op === "||") {
        if (left === null && right === null) return null;
        return `${left ?? ""}${right ?? ""}`;
      }
      if (left === null || right === null) return null;
      if (expr.op === "+" || expr.op === "-" || expr.op === "*" || expr.op === "/" || expr.op === "%") {
        const a = asNumber(left) ?? 0;
        const b = asNumber(right) ?? 0;
        if (expr.op === "+") return typeof left === "string" || typeof right === "string" ? String(a + b) : a + b;
        if (expr.op === "-") return a - b;
        if (expr.op === "*") return a * b;
        if (expr.op === "/") return b === 0 ? null : a / b;
        return b === 0 ? null : a % b;
      }
      const comparison = compareValues(left, right);
      if (expr.op === "=" || expr.op === "==") return left === right || comparison === 0;
      if (expr.op === "!=" || expr.op === "<>") return !(left === right || comparison === 0);
      if (expr.op === "<") return comparison < 0;
      if (expr.op === ">") return comparison > 0;
      if (expr.op === "<=") return comparison <= 0;
      if (expr.op === ">=") return comparison >= 0;
      return false;
    }
    case "call": {
      if (AGGREGATE_FUNCTIONS.has(expr.name)) {
        if (!expr.args.length || expr.args[0].kind === "star") {
          return aggregate(expr.name, null, context.group, expr.distinct);
        }
        return aggregate(expr.name, expr.args[0], context.group, expr.distinct);
      }
      const values = expr.args.map((arg) => evaluate(arg, context));
      const num = asNumber(values[0]);
      switch (expr.name) {
        case "ROUND": {
          if (num === null) return null;
          const places = values[1] !== undefined ? Number(values[1]) : 0;
          const multiplier = 10 ** places;
          return Math.round(num * multiplier) / multiplier;
        }
        case "ABS":
          return num === null ? null : Math.abs(num);
        case "UPPER":
          return values[0] === null ? null : String(values[0]).toUpperCase();
        case "LOWER":
          return values[0] === null ? null : String(values[0]).toLowerCase();
        case "LENGTH":
          return values[0] === null ? null : String(values[0]).length;
        case "TRIM":
          return values[0] === null ? null : String(values[0]).trim();
        case "SUBSTR": {
          if (values[0] === null) return null;
          const text = String(values[0]);
          const start = Number(values[1] ?? 1) - 1;
          const length = values[2] !== undefined ? Number(values[2]) : undefined;
          return text.substr(start, length);
        }
        case "COALESCE":
          return values.find((value) => value !== null && value !== undefined) ?? null;
        case "IFNULL":
          return values[0] !== null && values[0] !== undefined ? values[0] : values[1] ?? null;
        default:
          return null;
      }
    }
    case "case": {
      for (const item of expr.cases) {
        if (evaluate(item.when, context)) return evaluate(item.then, context);
      }
      return expr.otherwise ? evaluate(expr.otherwise, context) : null;
    }
    case "isNull": {
      const value = evaluate(expr.expr, context);
      const isNull = value === null || value === undefined;
      return expr.negate ? !isNull : isNull;
    }
    case "like": {
      const value = evaluate(expr.expr, context);
      const pattern = evaluate(expr.pattern, context);
      if (value === null || pattern === null) return null;
      const matches = likeToRegex(String(pattern)).test(String(value));
      return expr.negate ? !matches : matches;
    }
    case "in": {
      const value = evaluate(expr.expr, context);
      const list = expr.values.map((item) => evaluate(item, context));
      const matches = list.some((item) => item === value || (item !== null && value !== null && String(item) === String(value)));
      return expr.negate ? !matches : matches;
    }
    case "between": {
      const value = asNumber(evaluate(expr.expr, context));
      const low = asNumber(evaluate(expr.low, context));
      const high = asNumber(evaluate(expr.high, context));
      if (value === null || low === null || high === null) return null;
      const within = value >= low && value <= high;
      return expr.negate ? !within : within;
    }
    case "cast": {
      const value = evaluate(expr.expr, context);
      if (value === null) return null;
      if (expr.target === "INTEGER") return Math.trunc(Number(value));
      if (expr.target === "REAL") return Number(value);
      return String(value);
    }
    default:
      return null;
  }
}

function guessExpressionLabel(expr: Expr): string {
  switch (expr.kind) {
    case "col":
      return expr.name;
    case "call":
      return `${expr.name.toLowerCase()}${expr.args[0]?.kind === "col" ? `(${expr.args[0].name})` : "()"}`;
    case "lit":
      return JSON.stringify(expr.value);
    case "binary":
      return `${guessExpressionLabel(expr.left)} ${expr.op.toLowerCase()} ${guessExpressionLabel(expr.right)}`;
    default:
      return "expression";
  }
}

export function runSql(tables: TableDef[], sql: string): QueryResult {
  const started = performance.now();
  const statement = new Parser(sql).parse();

  const sourceMeta: SourceMeta[] = [];
  const addSource = (source: Source) => {
    const table = tables.find((candidate) => candidate.name.toLowerCase() === source.table.toLowerCase());
    if (!table) {
      throw new QueryError(
        `Table "${source.table}" does not exist.`,
        `Available tables: ${tables.map((candidate) => candidate.name).join(", ")}.`,
      );
    }
    sourceMeta.push({ table, alias: source.alias });
    return table;
  };

  if (statement.from) addSource(statement.from);
  for (const join of statement.joins) addSource(join);

  const knownKeys = new Set<string>();
  const plainCounts = new Map<string, number>();
  for (const source of sourceMeta) {
    for (const column of source.table.columns) {
      knownKeys.add(`${source.alias}.${column.name}`);
      knownKeys.add(`${source.table.name}.${column.name}`);
      plainCounts.set(column.name, (plainCounts.get(column.name) ?? 0) + 1);
      if ((plainCounts.get(column.name) ?? 0) === 1) knownKeys.add(column.name);
    }
  }

  const aliases = new Set(statement.items.map((item) => item.alias).filter(Boolean) as string[]);
  const validateColumn = (column: Extract<Expr, { kind: "col" }>, allowAlias: boolean) => {
    const key = column.table ? `${column.table}.${column.name}` : column.name;
    if (allowAlias && !column.table && aliases.has(column.name)) return;
    if (!knownKeys.has(key)) {
      const prefix = column.table ? `${column.table}.` : "";
      throw new QueryError(
        `Column "${prefix}${column.name}" was not found.`,
        sourceMeta.length
          ? "Columns must exist in the selected tables. Use the schema explorer to check names and aliases."
          : "Add a FROM clause before referencing columns.",
      );
    }
  };

  for (const item of statement.items) {
    checkFunctions(item.expr);
    walkExpressions(item.expr, (column) => validateColumn(column, false));
    if (item.expr.kind === "star" && item.expr.table) {
      const alias = item.expr.table;
      if (!sourceMeta.some((source) => source.alias === alias || source.table.name === alias)) {
        throw new QueryError(`Unknown table alias "${alias}".`);
      }
    }
  }
  if (statement.where) {
    checkFunctions(statement.where);
    walkExpressions(statement.where, (column) => validateColumn(column, false));
    if (hasAggregate(statement.where)) {
      throw new QueryError("Aggregate functions cannot be used in WHERE.", "Move the aggregate filter into a HAVING clause.");
    }
  }
  statement.groupBy.forEach((expr) => {
    checkFunctions(expr);
    walkExpressions(expr, (column) => validateColumn(column, false));
  });
  if (statement.having) {
    checkFunctions(statement.having);
    walkExpressions(statement.having, (column) => validateColumn(column, true));
  }
  statement.joins.forEach((join) => {
    checkFunctions(join.on);
    walkExpressions(join.on, (column) => validateColumn(column, false));
  });
  if (statement.orderBy.length && statement.items.every((item) => item.expr.kind === "star")) {
    statement.orderBy.forEach((order) => {
      if (order.expr.kind === "col" && !order.expr.table && aliases.has(order.expr.name)) return;
      checkFunctions(order.expr);
      walkExpressions(order.expr, (column) => validateColumn(column, false));
    });
  }

  const qualify = (source: SourceMeta, row: Row, includePlain: boolean): Row => {
    const out: Row = {};
    for (const column of source.table.columns) {
      const value = row[column.name] ?? null;
      out[`${source.alias}.${column.name}`] = value;
      out[`${source.table.name}.${column.name}`] = value;
      if (includePlain && !(column.name in out)) out[column.name] = value;
    }
    return out;
  };

  let rows: Row[] = [];
  if (statement.from) {
    const firstTable = sourceMeta[0];
    rows = firstTable.table.rows.map((row) => qualify(firstTable, row, true));

    statement.joins.forEach((join, index) => {
      const rightTable = sourceMeta[index + 1];
      const qualifiedRight = rightTable.table.rows.map((row) => qualify(rightTable, row, false));
      const rightQualifiers = new Set([rightTable.alias, rightTable.table.name]);
      const leftQualifiers = new Set(
        sourceMeta.slice(0, index + 1).flatMap((source) => [source.alias, source.table.name]),
      );
      const belongsTo = (expr: Expr, qualifiers: Set<string>): expr is Extract<Expr, { kind: "col" }> =>
        expr.kind === "col" && Boolean(expr.table) && qualifiers.has(expr.table as string);

      let leftJoinKey: string | null = null;
      let rightJoinKey: string | null = null;
      if (join.on.kind === "binary" && join.on.op === "=") {
        if (belongsTo(join.on.left, leftQualifiers) && belongsTo(join.on.right, rightQualifiers)) {
          leftJoinKey = `${join.on.left.table}.${join.on.left.name}`;
          rightJoinKey = `${rightTable.alias}.${join.on.right.name}`;
        } else if (belongsTo(join.on.right, leftQualifiers) && belongsTo(join.on.left, rightQualifiers)) {
          leftJoinKey = `${join.on.right.table}.${join.on.right.name}`;
          rightJoinKey = `${rightTable.alias}.${join.on.left.name}`;
        }
      }

      const bucketKey = (value: CellValue): string =>
        value === null || value === undefined ? "null:" : `${typeof value}:${String(value)}`;
      const rightBuckets = new Map<string, Row[]>();
      if (leftJoinKey && rightJoinKey) {
        for (const rightRow of qualifiedRight) {
          const key = bucketKey(rightRow[rightJoinKey]);
          const bucket = rightBuckets.get(key);
          if (bucket) bucket.push(rightRow);
          else rightBuckets.set(key, [rightRow]);
        }
      }

      const nextRows: Row[] = [];
      for (const leftRow of rows) {
        let matched = false;
        const candidates = leftJoinKey ? rightBuckets.get(bucketKey(leftRow[leftJoinKey])) ?? [] : qualifiedRight;
        for (const rightRow of candidates) {
          const merged: Row = { ...leftRow };
          for (const [key, value] of Object.entries(rightRow)) {
            if (key.includes(".")) merged[key] = value;
            else if (!(key in merged)) merged[key] = value;
          }
          if (Boolean(evaluate(join.on, { row: merged, group: [] }))) {
            nextRows.push(merged);
            matched = true;
          }
        }
        if (!matched && join.type === "LEFT") {
          const merged: Row = { ...leftRow };
          for (const column of rightTable.table.columns) {
            merged[`${rightTable.alias}.${column.name}`] = null;
            merged[`${rightTable.table.name}.${column.name}`] = null;
          }
          nextRows.push(merged);
        }
      }
      rows = nextRows;
    });
  } else {
    rows = [{}];
  }

  const scanned = rows.length;
  const filtered = statement.where
    ? rows.filter((row) => Boolean(evaluate(statement.where as Expr, { row, group: [] })))
    : rows;

  type ItemMeta = { item: SelectItem; label: string; type?: ColumnType };
  const itemMeta: ItemMeta[] = [];

  for (const item of statement.items) {
    if (item.expr.kind === "star") {
      const starTable = item.expr.table;
      const sources = starTable
        ? sourceMeta.filter((source) => source.alias === starTable || source.table.name === starTable)
        : sourceMeta;
      if (!sources.length) {
        throw new QueryError("SELECT * needs at least one source table.");
      }
      for (const source of sources) {
        for (const column of source.table.columns) {
          itemMeta.push({
            item: { expr: { kind: "col", table: source.alias, name: column.name } },
            label: column.name,
            type: column.type,
          });
        }
      }
    } else {
      const itemExpr = item.expr;
      let type: ColumnType | undefined;
      if (itemExpr.kind === "col") {
        const columnTable = itemExpr.table;
        const columnName = itemExpr.name;
        type = sourceMeta
          .find((source) => source.alias === columnTable || source.table.name === columnTable)
          ?.table.columns.find((column) => column.name === columnName)?.type;
      } else if (itemExpr.kind === "call" && itemExpr.name === "COUNT") {
        type = "INTEGER";
      }
      itemMeta.push({ item, label: item.alias ?? guessExpressionLabel(item.expr), type });
    }
  }

  const hasAggregates =
    statement.items.some((item) => hasAggregate(item.expr)) ||
    Boolean(statement.having && hasAggregate(statement.having)) ||
    statement.orderBy.some((order) => hasAggregate(order.expr)) ||
    statement.groupBy.length > 0;

  const groups: { row: Row | null; group: Row[] }[] = [];
  if (hasAggregates) {
    if (statement.groupBy.length === 0) {
      groups.push({ row: filtered[0] ?? null, group: filtered });
    } else {
      const map = new Map<string, Row[]>();
      for (const row of filtered) {
        const key = JSON.stringify(statement.groupBy.map((expr) => evaluate(expr, { row, group: [] })));
        const bucket = map.get(key);
        if (bucket) bucket.push(row);
        else map.set(key, [row]);
      }
      for (const group of map.values()) groups.push({ row: group[0] ?? null, group });
    }
  } else {
    for (const row of filtered) groups.push({ row, group: [row] });
  }

  const passingGroups = groups.filter((group) =>
    statement.having ? Boolean(evaluate(statement.having as Expr, group)) : true,
  );

  const aliasIndex = new Map<string, number>();
  itemMeta.forEach((meta, index) => {
    if (meta.item.alias) aliasIndex.set(meta.item.alias.toLowerCase(), index);
  });

  const sortValue = (expr: Expr, entry: { values: CellValue[]; row: Row | null; group: Row[] }): CellValue => {
    if (expr.kind === "lit" && typeof expr.value === "number" && Number.isInteger(expr.value)) {
      return entry.values[expr.value - 1] ?? null;
    }
    if (expr.kind === "col" && !expr.table) {
      const index = aliasIndex.get(expr.name.toLowerCase());
      if (index !== undefined) return entry.values[index] ?? null;
    }
    return evaluate(expr, { row: entry.row, group: entry.group });
  };

  const projected = passingGroups.map((group) => ({
    values: itemMeta.map((meta) => evaluate(meta.item.expr, group)),
    row: group.row,
    group: group.group,
  }));

  const deduped = statement.distinct
    ? Array.from(new Map(projected.map((entry) => [JSON.stringify(entry.values), entry])).values())
    : projected;

  if (statement.orderBy.length) {
    deduped.sort((a, b) => {
      for (const order of statement.orderBy) {
        const comparison = compareValues(sortValue(order.expr, a), sortValue(order.expr, b));
        if (comparison !== 0) return order.direction === "DESC" ? -comparison : comparison;
      }
      return 0;
    });
  }

  const offset = statement.offset ?? 0;
  const limited = statement.limit !== undefined ? deduped.slice(offset, offset + statement.limit) : deduped.slice(offset);
  const columns: ResultColumn[] = itemMeta.map((meta, index) => ({
    key: `c${index}`,
    label: meta.label,
    type: meta.type,
  }));
  const outRows = limited.map((entry) => entry.values);

  return {
    columns,
    rows: outRows,
    ms: Math.max(0.1, performance.now() - started),
    scanned,
    sql: sql.trim(),
    affected: 0,
  };
}

export function formatSql(sql: string): string {
  let clean = sql.replace(/\s+/g, " ").trim();
  clean = clean.replace(/\s*,\s*/g, ", ");
  const breaks = [
    "FROM", "WHERE", "GROUP BY", "HAVING", "ORDER BY", "LIMIT", "OFFSET",
    "LEFT JOIN", "INNER JOIN", "JOIN",
  ];
  for (const key of breaks) {
    clean = clean.replace(new RegExp(`\\s+${key}\\s+`, "gi"), `\n${key} `);
  }
  clean = clean.replace(/\s+(AND|OR)\s+/gi, "\n  $1 ");
  clean = clean.replace(/^\s+/, "");
  return clean;
}

export function queryErrorMessage(error: unknown): { message: string; hint?: string } {
  if (error instanceof QueryError) return { message: error.message, hint: error.hint };
  if (error instanceof Error) return { message: error.message };
  return { message: "The query engine encountered an unknown error." };
}
