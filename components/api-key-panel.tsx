"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useApiKey } from "@/lib/api-key"

// The menu's Atlas API key entry — coccoon's engine-level key, in a dialog.
// Games (currently Quantum Caverns) read the same key and run their quantum
// work on the Moth platform with it.
export function ApiKeyPanel() {
  const [key, setKey] = useApiKey()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const hasKey = key.length > 0

  useEffect(() => {
    if (!open) return
    setDraft(key)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, key])

  function save() {
    setKey(draft)
    setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 font-mono text-xs uppercase tracking-widest text-emerald-200 transition-colors hover:border-emerald-500 hover:bg-emerald-900/40"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${hasKey ? "bg-emerald-400" : "bg-amber-400"}`}
          aria-hidden
        />
        {hasKey ? "Atlas API key set" : "Set Atlas API key"}
      </button>
      <p className="max-w-md text-xs leading-relaxed text-emerald-100/50">
        One key for the whole engine. Games that run quantum work on{" "}
        <span className="font-mono text-emerald-300">Atlas</span> — like Quantum Caverns — use it. Kept only for this
        browser session.
      </p>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${inputId}-title`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-emerald-800/70 bg-neutral-950 p-6 shadow-2xl">
            <h2 id={`${inputId}-title`} className="font-mono text-sm font-semibold uppercase tracking-widest text-emerald-300">
              Atlas API key
            </h2>
            <p className="text-xs leading-relaxed text-emerald-100/70">
              Paste a <span className="font-mono">blur-core-v1</span> key from{" "}
              <a
                href="https://platform.mothquantum.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
              >
                Atlas, the Moth platform
              </a>
              . It is sent only to this app&apos;s server proxy and held for this browser session — never stored to disk.
            </p>
            <label htmlFor={inputId} className="sr-only">
              Atlas API key
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) save()
              }}
              placeholder="mq_..."
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-md border border-emerald-800/70 bg-neutral-900/70 px-3 py-2 font-mono text-sm text-emerald-100 outline-none placeholder:text-emerald-300/30 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
            />
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setKey("")
                  setDraft("")
                  setOpen(false)
                }}
                className="font-mono text-xs uppercase tracking-widest text-emerald-100/50 transition-colors hover:text-red-300"
              >
                Clear key
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-emerald-800/70 px-3 py-2 font-mono text-xs uppercase tracking-widest text-emerald-200 transition-colors hover:bg-emerald-900/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="rounded-md border border-emerald-500 bg-emerald-500/20 px-3 py-2 font-mono text-xs uppercase tracking-widest text-emerald-200 transition-colors hover:bg-emerald-500/30"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
