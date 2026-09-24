"use client"

import { useMemo, useRef, type KeyboardEvent, type UIEvent } from "react"
import { tokenizeLines, type TokenType } from "@/lib/highlight"

// Editable code needs a caret and native text-editing, but a <textarea> can't
// colour its own contents. The classic fix: render a syntax-highlighted <pre>
// behind a transparent <textarea>. Both share identical box metrics (font,
// line-height, padding, border, whitespace) so glyphs line up exactly, and the
// textarea's scroll is mirrored onto the highlight layer.

const TOKEN_COLORS: Record<TokenType, string> = {
  comment: "text-neutral-500 italic",
  string: "text-amber-300",
  keyword: "text-violet-400",
  number: "text-orange-300",
  function: "text-sky-300",
  type: "text-emerald-300",
  punctuation: "text-neutral-400",
  plain: "text-emerald-100",
}

// Every metric that affects glyph position must match on both layers.
const SHARED =
  "m-0 box-border h-[520px] w-full rounded-lg border p-4 font-mono text-[13px] leading-relaxed whitespace-pre overflow-auto"

export function CodeEditor({
  value,
  onChange,
  onKeyDown,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  ariaLabel?: string
}) {
  const preRef = useRef<HTMLPreElement>(null)

  // Split into lines for colouring. tokenizeLines drops a single trailing
  // newline, so re-add an empty final line to keep the line count identical
  // to what the textarea renders (otherwise the last blank line desyncs).
  const lines = useMemo(() => {
    const l = tokenizeLines(value)
    if (value.endsWith("\n")) l.push([])
    return l
  }, [value])

  const syncScroll = (e: UIEvent<HTMLTextAreaElement>) => {
    const pre = preRef.current
    if (!pre) return
    pre.scrollTop = e.currentTarget.scrollTop
    pre.scrollLeft = e.currentTarget.scrollLeft
  }

  return (
    <div className="relative">
      <pre
        ref={preRef}
        aria-hidden
        className={`${SHARED} pointer-events-none absolute inset-0 border-emerald-950 bg-black/80 text-emerald-100`}
      >
        <code className="block">
          {lines.map((tokens, i) => (
            <span key={i}>
              {tokens.map((t, j) => (
                <span key={j} className={TOKEN_COLORS[t.type]}>
                  {t.text}
                </span>
              ))}
              {i < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </code>
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={ariaLabel}
        className={`${SHARED} relative resize-none border-transparent bg-transparent text-transparent caret-emerald-300 outline-none focus:ring-2 focus:ring-emerald-500/50`}
      />
    </div>
  )
}
