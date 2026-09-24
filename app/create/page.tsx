"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CARTRIDGES } from "@/lib/cartridges"
import { CartridgeRunner, type CartridgeAsset, type LogLevel } from "@/components/cartridge-runner"
import { CodeEditor } from "@/components/code-editor"
import { SourceViewer } from "@/components/source-viewer"

type LogEntry = { level: LogLevel; message: string; id: number }
type MediaAsset = CartridgeAsset & { kind: "image" | "audio" }

export default function CreatePage() {
  const [code, setCode] = useState(CARTRIDGES[0].code)
  const [activeId, setActiveId] = useState(CARTRIDGES[0].id)
  const [runToken, setRunToken] = useState(0)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const logIdRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const consoleRef = useRef<HTMLDivElement>(null)
  const logScrollRef = useRef<HTMLDivElement>(null)

  // Revoke every object URL when the page unmounts so uploaded media doesn't leak.
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  useEffect(() => {
    return () => {
      for (const a of assetsRef.current) URL.revokeObjectURL(a.url)
    }
  }, [])

  const handleDownload = useCallback(() => {
    const cart = CARTRIDGES.find((c) => c.id === activeId)
    const base = (cart?.name ?? "cartridge").toLowerCase().replace(/[^a-z0-9_]+/g, "-").replace(/^-+|-+$/g, "")
    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${base || "cartridge"}.ts`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [code, activeId])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAddMediaClick = useCallback(() => {
    mediaInputRef.current?.click()
  }, [])

  const handleMediaChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    setAssets((prev) => {
      const next = [...prev]
      for (const file of files) {
        const kind: MediaAsset["kind"] =
          file.type.startsWith("audio/") || /\.(wav|mp3|ogg)$/i.test(file.name) ? "audio" : "image"
        const url = URL.createObjectURL(file)
        // Re-uploading a file with the same name replaces it (revoke the old URL).
        const existing = next.findIndex((a) => a.name === file.name)
        if (existing >= 0) {
          URL.revokeObjectURL(next[existing].url)
          next[existing] = { name: file.name, url, kind }
        } else {
          next.push({ name: file.name, url, kind })
        }
      }
      return next
    })
  }, [])

  const removeAsset = useCallback((name: string) => {
    setAssets((prev) => {
      const target = prev.find((a) => a.name === name)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.name !== name)
    })
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const text = await file.text()
    setCode(text)
    setActiveId("")
    setRunning(false)
    setRunToken(0)
    setLogs([])
  }, [])

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
      requestAnimationFrame(() => {
        consoleRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
        if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight
      })
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
                Load a cartridge
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
            Write a cartridge exactly like the built-in demos: import from{" "}
            <span className="font-mono text-emerald-300">@/lib/coccoon</span> (and{" "}
            <span className="font-mono text-emerald-300">@/lib/micromoth</span>) and{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">export</code> a class that{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">implements Game</code>{" "}
            with{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">ready(engine)</code> and{" "}
            <code className="rounded bg-emerald-950/70 px-1 py-0.5 font-mono text-emerald-300">
              process(delta, engine)
            </code>
            . Reading a demo&apos;s source teaches you everything you need here. To vibe-code a game, hand an LLM the{" "}
            <a
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-emerald-300 underline underline-offset-4 hover:text-emerald-200"
            >
              starter kit
            </a>
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
          <div className="ml-auto flex items-center gap-3">
            <a
              href="/llms.txt"
              target="_blank"
              rel="noreferrer"
                title="The LLM starter kit: engine reference, all demo games, and authoring rules for vibe-coding a cartridge."
                className="rounded-md border border-emerald-800/70 px-3 py-2 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:bg-emerald-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              LLM reference
            </a>
            <SourceViewer
              title="Engine reference"
              triggerLabel="Engine reference"
              files={[
                {
                  key: "lib/coccoon",
                  label: "coccoon.ts",
                  note: "The coccoon engine (read-only): the 32x18 grid, sprites, text, audio, and per-frame input your cartridge drives.",
                },
                {
                  key: "lib/micromoth",
                  label: "micromoth.ts",
                  note: "MicroQiskit / MicroMoth (read-only): the tiny statevector simulator exposed to cartridges as the MicroMoth global.",
                },
              ]}
            />
          </div>
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
                disabled={!activeId}
                className="rounded-md border border-emerald-800/70 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-emerald-800/70"
              >
                Reset
              </button>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
          onClick={handleUploadClick}
          className="rounded-md border border-emerald-800/70 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-600"
                >
                  ↑ Upload
                </button>
                <button
                  type="button"
          onClick={handleDownload}
          className="rounded-md border border-emerald-800/70 px-4 py-2 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-600"
                >
                  ↓ Download
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ts,.js,.txt,text/typescript,text/javascript,application/javascript,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-950 bg-black/40 p-3">
              <button
                type="button"
          onClick={handleAddMediaClick}
          className="rounded-md border border-emerald-800/70 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-emerald-300 transition-colors hover:border-emerald-600"
              >
                + Media
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,audio/*,.png,.wav"
                multiple
                onChange={handleMediaChange}
                className="hidden"
              />
              {assets.length === 0 ? (
                <span className="font-mono text-[11px] leading-relaxed text-emerald-100/40">
                  Upload PNGs or WAVs, then reference them by filename:{" "}
                  <code className="rounded bg-emerald-950/70 px-1 py-0.5 text-emerald-300">asset(&quot;hero.png&quot;)</code>
                </span>
              ) : (
                assets.map((a) => (
                  <span
                    key={a.name}
                    className="flex items-center gap-1.5 rounded-md border border-emerald-900 bg-neutral-900/70 px-2 py-1 font-mono text-[11px] text-emerald-200"
                  >
                    <span className="select-none text-emerald-500">{a.kind === "audio" ? "♪" : "▦"}</span>
                    {a.name}
                    <button
                      type="button"
                      onClick={() => removeAsset(a.name)}
                      aria-label={`Remove ${a.name}`}
                      className="select-none text-emerald-700 transition-colors hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </span>
                ))
              )}
            </div>

            <CodeEditor
              value={code}
              onChange={setCode}
              onKeyDown={handleKeyDown}
              ariaLabel="Cartridge source code"
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
                assets={assets}
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
                canvas to give it focus, then use the arrow keys / WASD, IJKL, or a gamepad.
                </p>
              </div>
            )}

            <div ref={consoleRef} className="flex flex-col gap-2">
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
              <div
                ref={logScrollRef}
                className="h-32 overflow-auto rounded-lg border border-emerald-950 bg-black/80 p-3 font-mono text-xs leading-relaxed"
              >
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
