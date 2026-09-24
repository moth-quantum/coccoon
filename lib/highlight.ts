// A tiny, dependency-free tokenizer for TypeScript / JavaScript source.
// It exists so the source viewer can show syntax-highlighted code while still
// rendering one line at a time (needed for the line-number gutter).
//
// The scanner walks the whole string once, emitting typed tokens. Block
// comments and template strings can span multiple lines, so we tokenize the
// full source first and only split into lines afterwards — that keeps
// multi-line constructs correctly coloured across line boundaries.

export type TokenType =
  | "comment"
  | "string"
  | "keyword"
  | "number"
  | "function"
  | "type"
  | "punctuation"
  | "plain"

export type Token = { text: string; type: TokenType }

const KEYWORDS = new Set([
  "abstract", "as", "async", "await", "break", "case", "catch", "class",
  "const", "continue", "debugger", "declare", "default", "delete", "do",
  "else", "enum", "export", "extends", "false", "finally", "for", "from",
  "function", "get", "if", "implements", "import", "in", "instanceof",
  "interface", "is", "keyof", "let", "new", "null", "of", "private",
  "protected", "public", "readonly", "return", "set", "static", "super",
  "switch", "this", "throw", "true", "try", "type", "typeof", "undefined",
  "var", "void", "while", "yield",
])

// Built-in / common types get a distinct colour so signatures read clearly.
const TYPES = new Set([
  "string", "number", "boolean", "any", "unknown", "never", "object",
  "Array", "Promise", "Record", "Map", "Set", "Math", "JSON", "Object",
  "Uint8Array", "Float64Array", "Int32Array",
])

const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c)
const isIdent = (c: string) => /[A-Za-z0-9_$]/.test(c)
const isDigit = (c: string) => /[0-9]/.test(c)

export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = src.length
  const push = (text: string, type: TokenType) => {
    if (text) tokens.push({ text, type })
  }

  while (i < n) {
    const c = src[i]

    // Line comment
    if (c === "/" && src[i + 1] === "/") {
      let j = i + 2
      while (j < n && src[j] !== "\n") j++
      push(src.slice(i, j), "comment")
      i = j
      continue
    }

    // Block comment (may span lines)
    if (c === "/" && src[i + 1] === "*") {
      let j = i + 2
      while (j < n && !(src[j] === "*" && src[j + 1] === "/")) j++
      j = Math.min(n, j + 2)
      push(src.slice(i, j), "comment")
      i = j
      continue
    }

    // Strings: ", ', `
    if (c === '"' || c === "'" || c === "`") {
      const quote = c
      let j = i + 1
      while (j < n) {
        if (src[j] === "\\") {
          j += 2
          continue
        }
        if (src[j] === quote) {
          j++
          break
        }
        j++
      }
      push(src.slice(i, j), "string")
      i = j
      continue
    }

    // Numbers (incl. decimals, hex, scientific)
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? ""))) {
      let j = i + 1
      while (j < n && /[0-9a-fA-FxXeE._+-]/.test(src[j])) j++
      push(src.slice(i, j), "number")
      i = j
      continue
    }

    // Identifiers / keywords
    if (isIdentStart(c)) {
      let j = i + 1
      while (j < n && isIdent(src[j])) j++
      const word = src.slice(i, j)
      // look ahead past whitespace for "(" to detect a call/definition
      let k = j
      while (k < n && (src[k] === " " || src[k] === "\t")) k++
      const isCall = src[k] === "("

      if (KEYWORDS.has(word)) push(word, "keyword")
      else if (TYPES.has(word)) push(word, "type")
      else if (isCall) push(word, "function")
      else if (/^[A-Z]/.test(word)) push(word, "type")
      else push(word, "plain")
      i = j
      continue
    }

    // Punctuation / operators
    if (/[{}()[\].,;:?=<>!&|+\-*/%^~]/.test(c)) {
      push(c, "punctuation")
      i++
      continue
    }

    // Whitespace and anything else
    push(c, "plain")
    i++
  }

  return tokens
}

/**
 * Tokenizes source and groups the tokens into lines. Tokens whose text spans
 * newlines (block comments, template strings) are split so each line holds
 * only its own slice while keeping the original token type.
 */
export function tokenizeLines(src: string): Token[][] {
  const normalized = src.replace(/\n$/, "")
  const tokens = tokenize(normalized)
  const lines: Token[][] = [[]]
  for (const tok of tokens) {
    const parts = tok.text.split("\n")
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ text: part, type: tok.type })
    })
  }
  return lines
}
