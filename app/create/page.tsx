"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import { CARTRIDGES } from "@/lib/cartridges"
import { CartridgeRunner, type LogLevel } from "@/components/cartridge-runner"

type LogEntry = { level: LogLevel; message: string; id: number }

export default function CreatePage() {
  const [code, setCode] = useState(CARTRIDGES[0].code)
  const [activeId, setActiveId] = useState(CARTRIDGES[0].id)
  const [runToken, setRunToken] = useState(0)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logIdRef = useRef(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  const pushLog = useCallback((level: LogLevel, message: string) => {
    setLogs((prev) => [...prev.slice(-199), { level, message, id: logIdRef.current++ }])
  }, [])

  const handleRun = useCallback(() => {
    setLogs([])
    setRunning(true)
    setRunToken((t) => t + 1)
  }, [])

  const handleStop = useCallback(() => {
    setRunning(false)
    setRunToken(0)
  }, [])

  const handleError = useCallback(
    (message: string) => {
      pushLog("error", message)
      setRunning(false)
    },
    [pushLog],
  )

  const loadCartridge = useCallback(
    (id: string) => {
      const cart = CARTRIDGES.find((c) => c.id === id)
      if (!cart) return
      setActiveId(id)
      setCode(cart.code)
      setRunning(false)
      setRunToken(0)
      setLogs([])
    },
    [],
  )

  // Tab inserts two spaces instead of moving focus.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const start = el.selectionStart
      const end = el.selectionEnd
      const next = code.slice(0, start) + "  " + code.slice(end)
      setCode(next)
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2
      })
    }
  }, [code])

  return (
    <main className="min-h-screen bg-neutral-950 text-emerald-50">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="font-mono text-xs uppercase tracking-[0.35em] text-emerald-500">coccoon · create</p>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-emerald-300 sm:text-3xl">
                Code a cartridge
              </h1>
            </div>
            <Link
              href="/"
              className="font-mono text-xs uppercase tracking-widest text-emerald-400 underline underline-offset-4 hover:text-emerald-300"
            >
              ← Menu
            </Link>
          </div>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-emerald-100/75">
            Write JavaScript that drives the same engine the built-in games use. Define{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">ready(engine)</code> and{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">
              process(delta, engine)
            </code>
            . Available globals:{" "}
            <span className="font-mono text-emerald-300">
              ImageList, Sprite, Text, color, Colors, GRID_W, GRID_H, MicroMoth, console
            </span>
            .
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-emerald-600">Starters</span>
          {CARTRIDGES.map((cart) => (
            <button
              key={cart.id}
              type="button"
              onClick={() => loadCartridge(cart.id)}
              title={cart.blurb}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs transition-colors ${
                activeId === cart.id
                  ? "border-emerald-500 bg-emerald-900/50 text-emerald-200"
                  : "border-emerald-950 bg-neutral-900/60 text-emerald-100/70 hover:border-emerald-700"
              }`}
            >
              {cart.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Editor */}
          <section aria-label="Code editor" className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {!running ? (
                <button
                  type="button"
                  onClick={handleRun}
                  className="rounded-md bg-emerald-500 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-950 transition-colors hover:bg-emerald-400"
                >
                  ▶ Run
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStop}
                  className="rounded-md bg-rose-500/90 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-rose-950 transition-colors hover:bg-rose-400"
                >
                  ■ Stop
                </button>
              )}
              <button
                type="button"
                onClick={() => loadCartridge(activeId)}
                className="rounded-md border border-emerald-900 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-600"
              >
                Reset
              </button>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-emerald-700">
                Tab = 2 spaces
              </span>
            </div>
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Cartridge source code"
              className="h-[520px] w-full resize-none rounded-lg border border-emerald-950 bg-black/80 p-4 font-mono text-[13px] leading-relaxed text-emerald-100 outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </section>

          {/* Preview + console */}
          <section aria-label="Preview" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-emerald-600">Preview</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                  running ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/40 text-neutral-400"
                }`}
              >
                {running ? "Running" : "Stopped"}
              </span>
            </div>

            {running ? (
              <CartridgeRunner
                code={code}
                runToken={runToken}
                onLog={pushLog}
                onError={handleError}
                onStarted={() => {}}
                onExit={handleStop}
              />
            ) : (
              <div
                className="flex w-full items-center justify-center rounded-lg border border-dashed border-emerald-950 bg-black/40 text-center"
                style={{ aspectRatio: `${32} / ${18}` }}
              >
                <p className="max-w-xs px-6 font-mono text-xs leading-relaxed text-emerald-100/50">
                  Press <span className="text-emerald-300">Run</span> to compile and start your cartridge. Click the
                  canvas to give it focus, then use the arrow keys / WASD.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase tracking-widest text-emerald-600">Console</span>
                {logs.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="font-mono text-[10px] uppercase tracking-wider text-emerald-700 underline underline-offset-2 hover:text-emerald-500"
                  >
                    clear
                  </button>
                ) : null}
              </div>
              <div className="h-32 overflow-auto rounded-lg border border-emerald-950 bg-black/80 p-3 font-mono text-xs leading-relaxed">
                {logs.length === 0 ? (
                  <p className="text-emerald-100/30">No output yet.</p>
                ) : (
                  logs.map((entry) => (
                    <div
                      key={entry.id}
                      className={
                        entry.level === "error"
                          ? "text-rose-400"
                          : entry.level === "warn"
                            ? "text-amber-300"
                            : "text-emerald-100/80"
                      }
                    >
                      <span className="select-none text-emerald-800">
                        {entry.level === "error" ? "✕ " : entry.level === "warn" ? "! " : "› "}
                      </span>
                      {entry.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
