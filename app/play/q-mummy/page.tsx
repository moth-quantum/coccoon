"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GameStage } from "@/components/game-stage"
import { SourceViewer } from "@/components/source-viewer"
import { QMummy } from "@/lib/games/q-mummy"

export default function QMummyPage() {
  const router = useRouter()
  const createGame = useCallback(() => new QMummy(), [])
  const exit = useCallback(() => router.push("/"), [router])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-8 text-amber-50">
      <header className="flex w-full max-w-[1100px] items-center justify-between">
        <Link
          href="/"
          className="rounded-md border border-amber-800/70 px-3 py-2 text-xs uppercase tracking-widest text-amber-300 transition-colors hover:bg-amber-900/40"
        >
          {"< Menu"}
        </Link>
        <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-amber-400 sm:text-base">Q Mummy</h1>
        <SourceViewer
          title="Q Mummy"
          accent="emerald"
          files={[
            {
              key: "games/q-mummy",
              label: "q-mummy.ts",
              note: "The game: a 120-room pyramid whose chambers are fused from a real quantum measurement.",
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

      <section className="w-full max-w-[1100px]">
        <p className="text-pretty text-sm leading-relaxed text-amber-100/90">
          Inspired by <em>Oh Mummy</em> (1984), built on coccoon for the Quantum Game Jam 2026 and Moth Hack. Explore
          a pyramid of 120 rooms: walk the full perimeter of a chamber to open it, revealing treasure, a mummy, or the
          key. Grab the key while dodging the mummies, then reach the exit to descend to the next level.
        </p>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-amber-100/80">
          The chamber layouts are not random. Each of the four levels is a different single-shot measurement of the same
          real 120-qubit lattice run on IBM&apos;s <span className="font-mono">ibm_phoenix</span> QPU, via Atlas&apos;s{" "}
          <span className="font-mono">labyrinth-v1</span> engine. For each raw bitstring sample, room-pairs whose bits
          agreed in that shot are ranked by ZZ-correlation strength and the strongest are fused into connected chambers
          — so every layout reflects a genuine quantum outcome, baked in at development time.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-amber-300/90">
          <span>
            <kbd className="rounded bg-amber-900/60 px-1.5 py-0.5">Arrows / WASD</kbd> move
          </span>
          <span>
            <kbd className="rounded bg-amber-900/60 px-1.5 py-0.5">Space / Enter</kbd> start
          </span>
          <span>
            <kbd className="rounded bg-amber-900/60 px-1.5 py-0.5">Esc</kbd> back to menu
          </span>
          <span>
            <kbd className="rounded bg-amber-900/60 px-1.5 py-0.5">Gamepad</kbd> d-pad / stick + A
          </span>
        </div>
        <p className="mt-3 text-xs text-amber-200/50">
          Click the grid first so it receives keyboard focus. Encircle a chamber to claim it; find the key, then head
          for the exit above.
        </p>
      </section>
    </main>
  )
}
