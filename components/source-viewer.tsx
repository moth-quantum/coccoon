"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { tokenizeLines, type TokenType } from "@/lib/highlight"

const TOKEN_COLORS: Record<TokenType, string> = {
  comment: "text-neutral-500 italic",
  string: "text-amber-300",
  keyword: "text-violet-400",
  number: "text-orange-300",
  function: "text-sky-300",
  type: "text-emerald-300",
  punctuation: "text-neutral-400",
  plain: "text-neutral-200",
}

export type SourceFile = {
  /** whitelist key understood by /api/source */
  key: string
  /** tab label shown to the user */
  label: string
  /** short description of the file's role */
  note?: string
}

type Accent = "emerald" | "indigo"

const ACCENTS: Record<
  Accent,
  { trigger: string; tabActive: string; tabIdle: string; ring: string; dot: string }
> = {
  emerald: {
    trigger:
      "border-emerald-800/70 text-emerald-300 hover:bg-emerald-900/40",
    tabActive: "bg-emerald-900/60 text-emerald-100",
    tabIdle: "text-emerald-300/70 hover:text-emerald-100 hover:bg-emerald-900/30",
    ring: "focus-visible:ring-emerald-500/50",
    dot: "text-emerald-400",
  },
  indigo: {
    trigger: "border-indigo-800/70 text-indigo-300 hover:bg-indigo-900/40",
    tabActive: "bg-indigo-900/60 text-indigo-100",
    tabIdle: "text-indigo-300/70 hover:text-indigo-100 hover:bg-indigo-900/30",
    ring: "focus-visible:ring-indigo-500/50",
    dot: "text-indigo-400",
  },
}

export function SourceViewer({
  files,
  title,
  accent = "emerald",
}: {
  files: SourceFile[]
  title: string
  accent?: Accent
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [cache, setCache] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const a = ACCENTS[accent]
  const current = files[active]

  const load = useCallback(
    async (key: string) => {
      if (cache[key] !== undefined) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/source?f=${encodeURIComponent(key)}`)
        if (!res.ok) throw new Error(`Failed to load source (${res.status})`)
        const text = await res.text()
        setCache((c) => ({ ...c, [key]: text }))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load source")
      } finally {
        setLoading(false)
      }
    },
    [cache],
  )

  useEffect(() => {
    if (open && current) void load(current.key)
  }, [open, current, load])

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey, true)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey, true)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const code = current ? cache[current.key] : undefined
  const lines = useMemo(() => (code !== undefined ? tokenizeLines(code) : []), [code])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md border px-3 py-2 text-xs uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 ${a.trigger} ${a.ring}`}
      >
        View code
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} source code`}
          className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-[1100px] flex-col px-4 py-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-200">
                {title} <span className={a.dot}>· source</span>
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className={`rounded-md border px-3 py-2 text-xs uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 ${a.trigger} ${a.ring}`}
              >
                Close (Esc)
              </button>
            </div>

            {files.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                      i === active ? a.tabActive : a.tabIdle
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {current?.note && (
              <p className="mt-3 text-xs leading-relaxed text-neutral-400">{current.note}</p>
            )}

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-neutral-800 bg-neutral-900/70">
              {loading && code === undefined && (
                <p className="p-4 font-mono text-xs text-neutral-500">Loading source…</p>
              )}
              {error && <p className="p-4 font-mono text-xs text-red-400">{error}</p>}
              {code !== undefined && (
                <pre className="min-w-full overflow-x-auto p-0 text-[12.5px] leading-relaxed">
                  <code className="block font-mono">
                    {lines.map((tokens, i) => (
                      <span key={i} className="flex">
                        <span
                          aria-hidden
                          className="sticky left-0 w-12 shrink-0 select-none border-r border-neutral-800 bg-neutral-900/70 px-2 py-0 text-right text-neutral-600"
                        >
                          {i + 1}
                        </span>
                        <span className="whitespace-pre px-3">
                          {tokens.length === 0
                            ? " "
                            : tokens.map((t, j) => (
                                <span key={j} className={TOKEN_COLORS[t.type]}>
                                  {t.text}
                                </span>
                              ))}
                        </span>
                      </span>
                    ))}
                  </code>
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
