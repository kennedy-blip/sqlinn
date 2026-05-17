import { useMemo, useRef, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/utils/cn";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "JOIN", "LEFT", "RIGHT", "FULL", "OUTER", "INNER", "CROSS", "ON", "AS", "DISTINCT",
  "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "IS", "NULL", "ASC", "DESC", "CASE",
  "WHEN", "THEN", "ELSE", "END", "CAST", "TRUE", "FALSE", "WITH", "UNION", "ALL",
  "CREATE", "TABLE", "IF", "EXISTS", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
  "INTEGER", "TEXT", "REAL", "BLOB", "AUTOINCREMENT", "DEFAULT", "CONSTRAINT",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "DROP", "ALTER", "ADD",
  "PRAGMA", "BEGIN", "COMMIT", "TRANSACTION", "USE", "EXPLAIN", "LIKE",
]);

const SQL_FUNCTIONS = new Set([
  "COUNT", "SUM", "AVG", "MIN", "MAX", "ROUND", "ABS", "UPPER", "LOWER", "LENGTH",
  "COALESCE", "IFNULL", "TRIM", "SUBSTR", "GROUP_CONCAT", "TOTAL", "STRFTIME",
  "DATE", "DATETIME", "JSON_EXTRACT", "CAST",
]);

const SQL_TOKEN_PATTERN =
  /(--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:[^"]|"")*"|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b|<=|>=|<>|!=|\|\||[=<>+\-*/%]|[(),.;])/g;

const TOKEN_COLORS: Record<string, string> = {
  comment: "text-slate-600 italic",
  string: "text-emerald-300",
  number: "text-amber-300",
  keyword: "text-cyan-300",
  function: "text-violet-300",
  type: "text-sky-300",
  operator: "text-slate-400",
  punctuation: "text-slate-500",
  identifier: "text-slate-300",
  plain: "text-slate-300",
};

function classifyToken(token: string, nextChar: string): string {
  if (token.startsWith("--") || token.startsWith("/*")) return "comment";
  if (token.startsWith("'") || token.startsWith('"') || token.startsWith("`")) return "string";
  if (/^\d/.test(token)) return "number";
  if (["INTEGER", "TEXT", "REAL", "BLOB"].includes(token.toUpperCase())) return "type";
  if (SQL_FUNCTIONS.has(token.toUpperCase()) && nextChar === "(") return "function";
  if (SQL_KEYWORDS.has(token.toUpperCase())) return "keyword";
  if (/^[=<>!|+\-*/%]+$/.test(token)) return "operator";
  if (/^[(),.;]$/.test(token)) return "punctuation";
  return "identifier";
}

export function highlightSql(sql: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  const source = sql;
  const matches = Array.from(source.matchAll(SQL_TOKEN_PATTERN));

  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > cursor) {
      nodes.push(
        <span key={`plain-${key++}`} className={TOKEN_COLORS.plain}>
          {source.slice(cursor, index)}
        </span>,
      );
    }
    const token = match[0];
    const nextChar = source.slice(index + token.length).match(/\S/)?.[0] ?? "";
    const type = classifyToken(token, nextChar);
    nodes.push(
      <span key={`token-${key++}`} className={TOKEN_COLORS[type]}>
        {token}
      </span>,
    );
    cursor = index + token.length;
  }

  if (cursor < source.length) {
    nodes.push(
      <span key={`tail-${key++}`} className={TOKEN_COLORS.plain}>
        {source.slice(cursor)}
      </span>,
    );
  }

  return nodes;
}

export function HighlightedSql({ sql, className }: { sql: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto whitespace-pre font-mono text-[11.5px] leading-[1.9] text-slate-300",
        className,
      )}
    >
      <code>{highlightSql(sql)}</code>
    </pre>
  );
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  className?: string;
}

export function CodeEditor({ value, onChange, onRun, className }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const highlighted = useMemo(() => highlightSql(value), [value]);
  const lineCount = Math.max(value.split("\n").length, 1);

  const handleScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    }
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-textarea.scrollTop}px)`;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onRun();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.selectionStart = start + 2;
        textareaRef.current.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className={cn("relative flex min-h-0 overflow-hidden bg-[#080e18]", className)}>
      <div className="relative z-10 w-[46px] shrink-0 select-none overflow-hidden border-r border-[#162133] bg-[#09111c]">
        <div ref={gutterRef} className="py-[14px] text-right font-mono text-[10.5px] leading-[22px] text-slate-600 will-change-transform">
          {Array.from({ length: lineCount }, (_, index) => (
            <div key={index} className="pr-3">
              {index + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <code
            ref={highlightRef}
            className="block w-max min-w-full whitespace-pre py-[14px] pl-4 pr-10 font-mono text-[12px] leading-[22px] will-change-transform"
          >
            {highlighted}
            {"\n"}
          </code>
        </div>
        {!value && (
          <div className="pointer-events-none absolute left-4 top-[14px] font-mono text-[12px] leading-[22px] text-slate-600">
            SELECT * FROM users LIMIT 100;
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label="SQL query editor"
          className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent py-[14px] pl-4 pr-10 font-mono text-[12px] leading-[22px] text-transparent caret-cyan-300 outline-none selection:bg-cyan-400/20"
        />
      </div>
    </div>
  );
}
