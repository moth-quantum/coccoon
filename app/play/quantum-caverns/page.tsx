"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GameStage } from "@/components/game-stage"
import { SourceViewer } from "@/components/source-viewer"
import { QuantumCaverns } from "@/lib/games/quantum-caverns"

type Via = "moth" | "local" | "pending"

export default function QuantumCavernsPage() {
  const router = useRouter()
  const keyRef = useRef("")
  const [keyInput, setKeyInput] = useState("")
  const [via, setVia] = useState<Via>("pending")

  const onStatus = useCallback((v: Via) => setVia(v), [])
  const createGame = useCallback(
    () => new QuantumCaverns(() => keyRef.current, onStatus),
    [onStatus],
  )
  const exit = useCallback(() => router.push("/"), [router])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-8 text-indigo-50">
      <header className="flex w-full max-w-[1100px] items-center justify-between">
        <Link
          href="/"
          className="rounded-md border border-indigo-800/70 px-3 py-2 text-xs uppercase tracking-widest text-indigo-300 transition-colors hover:bg-indigo-900/40"
        >
          {"< Menu"}
        </Link>
        <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-indigo-300 sm:text-base">Quantum Caverns</h1>
        <SourceViewer
          title="Quantum Caverns"
          accent="indigo"
          files={[
            {
              key: "games/quantum-caverns",
              label: "quantum-caverns.ts",
              note: "The game: quantum-blur maze generation with a Moth-platform-or-local dispatcher.",
            },
            {
              key: "lib/quantumblur",
              label: "quantumblur.ts",
              note: "The local QuantumBlur fallback — the same blur the Moth engine runs, in-browser.",
            },
            {
              key: "api/moth-blur",
              label: "moth-blur route",
              note: "The server proxy that calls the Moth platform's blur-core-v1 async job API.",
            },
            {
              key: "lib/coccoon",
              label: "coccoon.ts",
              note: "The coccoon engine: the 32x18 grid, sprites, text, and per-frame input.",
            },
          ]}
        />
      </header>

      <GameStage createGame={createGame} onExit={exit} />

      <section className="flex w-full max-w-[1100px] flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider ${
              via === "moth"
                ? "bg-indigo-500/20 text-indigo-200"
                : via === "local"
                  ? "bg-amber-500/15 text-amber-200"
                  : "bg-neutral-700/40 text-neutral-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                via === "moth" ? "bg-indigo-300" : via === "local" ? "bg-amber-300" : "bg-neutral-400"
              }`}
              aria-hidden
            />
            {via === "moth"
              ? "Blur computed on the Moth platform"
              : via === "local"
                ? "Blur computed locally (QuantumBlur fallback)"
                : "Generating first maze…"}
          </span>
        </div>

        <p className="text-pretty text-sm leading-relaxed text-indigo-100/80">
          The maze is a quantum blur: a height map is seeded with random peaks, encoded into a{" "}
          <span className="font-mono">{"2^10"}</span>-amplitude statevector, blurred by an{" "}
          <span className="font-mono">Rx(π/8)</span> rotation on every qubit, then decoded. Cells above{" "}
          <span className="font-mono">0.5</span> become walls, the rest paths. Start and exit are the two farthest
          points of the largest connected region.
        </p>

        <div className="rounded-lg border border-indigo-900/60 bg-indigo-950/30 p-4">
          <label htmlFor="moth-key" className="font-mono text-xs uppercase tracking-widest text-indigo-300">
            Atlas API key (optional)
          </label>
          <p className="mt-1 text-xs leading-relaxed text-indigo-200/60">
            This is the tutorial&apos;s whole point: coccoon games run their quantum work on{" "}
            <a
              href="https://platform.mothquantum.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-indigo-200"
            >
              Atlas, the Moth platform
            </a>
            . Paste a <span className="font-mono">blur-core-v1</span> key to run generation on real quantum hardware or
            a cloud simulator. Without one, the identical calculation runs locally. The key is sent only to this
            app&apos;s server proxy, never stored.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              id="moth-key"
              type="password"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value)
                keyRef.current = e.target.value.trim()
              }}
              placeholder="mq_..."
              autoComplete="off"
              spellCheck={false}
              className="min-w-[220px] flex-1 rounded-md border border-indigo-800/70 bg-neutral-900/70 px-3 py-2 font-mono text-sm text-indigo-100 outline-none placeholder:text-indigo-300/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
            <span className="font-mono text-[11px] text-indigo-300/50">
              applies to the next maze (Space)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-indigo-200/90">
          <span>
            <kbd className="rounded bg-indigo-900/60 px-1.5 py-0.5">Arrow keys</kbd> move
          </span>
          <span>
            <kbd className="rounded bg-indigo-900/60 px-1.5 py-0.5">Space</kbd> new maze
          </span>
          <span>
            <kbd className="rounded bg-indigo-900/60 px-1.5 py-0.5">Esc</kbd> back to menu
          </span>
        </div>
        <p className="text-xs text-indigo-200/50">
          Click the grid first so it receives keyboard focus. Run out of steps and the maze resets, keeping your last
          route as a dim trail. The next maze is prefetched while you play.
        </p>
      </section>
    </main>
  )
}
