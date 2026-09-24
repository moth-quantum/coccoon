"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GameStage } from "@/components/game-stage"
import { SourceViewer } from "@/components/source-viewer"
import { Celeste } from "@/lib/games/celeste"

export default function CelestePage() {
  const router = useRouter()
  const createGame = useCallback(() => new Celeste(), [])
  const exit = useCallback(() => router.push("/"), [router])

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-neutral-950 px-4 py-8 text-sky-50">
      <header className="flex w-full max-w-[1100px] items-center justify-between">
        <Link
          href="/"
          className="rounded-md border border-sky-800/70 px-3 py-2 text-xs uppercase tracking-widest text-sky-300 transition-colors hover:bg-sky-900/40"
        >
          {"< Menu"}
        </Link>
        <h1 className="font-mono text-sm uppercase tracking-[0.2em] text-sky-400 sm:text-base">Celeste — Quantum Remix</h1>
        <SourceViewer
          title="Celeste"
          accent="sky"
          files={[
            {
              key: "games/celeste",
              label: "celeste.ts",
              note: "The full game: player physics, dashing, hair, rooms, entities, and the quantum tile flicker.",
            },
            {
              key: "games/celeste-data",
              label: "celeste-data.ts",
              note: "The level map (64x128 tiles) and per-sprite collision flags, extracted from the original.",
            },
            {
              key: "lib/coccoon",
              label: "coccoon.ts",
              note: "The coccoon engine: the 32x18 grid, sprites (incl. spritesheet tiles), text, and input.",
            },
          ]}
        />
      </header>

      <GameStage createGame={createGame} onExit={exit} />

      <section className="w-full max-w-[1100px]">
        <p className="text-pretty text-sm leading-relaxed text-sky-200/80">
          A faithful port of{" "}
          <a
            href="https://github.com/NoelFB/Celeste"
            target="_blank"
            rel="noreferrer"
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-4 transition-colors hover:text-sky-300"
          >
            Celeste Classic
          </a>{" "}
          (Maddy Thorson &amp; Noel Berry) on the coccoon engine. The physics, dashing, and level layout are unchanged
          from the original. The quantum remix is visual: each solid tile has three sprite variants generated with
          Moth&apos;s TESSA tool and flickers between them, like a qubit collapsing between measured states.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-sky-300/90">
          <span>
            <kbd className="rounded bg-sky-900/60 px-1.5 py-0.5">Arrows / WASD</kbd> move
          </span>
          <span>
            <kbd className="rounded bg-sky-900/60 px-1.5 py-0.5">K</kbd> jump
          </span>
          <span>
            <kbd className="rounded bg-sky-900/60 px-1.5 py-0.5">J</kbd> dash
          </span>
          <span>
              <kbd className="rounded bg-sky-900/60 px-1.5 py-0.5">Esc</kbd> back to menu
            </span>
            <span>
              <kbd className="rounded bg-sky-900/60 px-1.5 py-0.5">Gamepad</kbd> d-pad / stick + A jump, X dash
            </span>
          </div>
        <p className="mt-3 text-xs text-sky-200/50">
          Click the grid first so it receives keyboard focus. Reach the top of each room to climb the mountain.
        </p>
      </section>
    </main>
  )
}
