// LLM-friendly starter kit.
//
// A single plaintext document that bundles the full source of the coccoon
// engine, the MicroMoth quantum simulator, and every demo game, plus the
// cartridge contract and a reference to the Moth (Atlas) platform API. Point
// an LLM/agent at `/llms.txt` (or download it) and it has everything needed
// to vibe-code a new cartridge that runs in the Create editor.

import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Ordered so the engine + quantum simulator come first (the API surface), then
// the demos (worked examples from simplest to most involved).
const SECTIONS: { rel: string; heading: string; note: string }[] = [
  {
    rel: "lib/coccoon.ts",
    heading: "lib/coccoon.ts — the engine",
    note: "The whole engine: the 32x18 grid, ImageList/Sprite/Text, color/Colors, SoundList/Sound/LOOP audio, per-frame input (key_presses), and the Game interface. A cartridge imports from here.",
  },
  {
    rel: "lib/micromoth.ts",
    heading: "lib/micromoth.ts — the quantum simulator",
    note: "MicroQiskit/MicroMoth: a tiny statevector simulator. Import { MicroMoth } from \"@/lib/micromoth\" to build circuits and get probabilities in-browser (no network, no API key).",
  },
  {
    rel: "lib/games/qubit-park.ts",
    heading: "lib/games/qubit-park.ts — demo (start here)",
    note: "The gentlest demo. Shows the exact cartridge shape: import primitives, export a class implementing Game with ready() and process(). Uses MicroMoth locally.",
  },
  {
    rel: "lib/games/quantum-caverns.ts",
    heading: "lib/games/quantum-caverns.ts — demo (Atlas API + audio)",
    note: "Submits a real quantum job to the Atlas platform (see /api/moth-blur), turns the result into a maze, and plays looping music via the audio primitives.",
  },
  {
    rel: "lib/games/celeste.ts",
    heading: "lib/games/celeste.ts — demo (a full platformer)",
    note: "A complete Celeste Classic port on the same engine: tilemaps, physics, multiple rooms.",
  },
  {
    rel: "app/api/moth-blur/route.ts",
    heading: "app/api/moth-blur/route.ts — Atlas job proxy",
    note: "How a quantum job reaches the Atlas platform from the app: a server proxy that submits a job and polls it. The browser never sees the API key.",
  },
]

const HEADER = `# coccoon — LLM starter kit

coccoon is a retro quantum game engine. Games run on a fixed 32x18 tile grid
and are authored as a small TypeScript module. This document contains the FULL
source of the engine, the quantum simulator, and every demo game, so you can
write a new game with no other context.

## How to write a cartridge

A cartridge is authored EXACTLY like the demo games below:

  import { Sprite, Text, color, GRID_W, GRID_H, type Coccoon, type Game } from "@/lib/coccoon"

  export class MyGame implements Game {
    ready(engine: Coccoon) {
      // called once: register images, create sprites and text
    }
    process(delta: number, engine: Coccoon) {
      // called every frame (~30fps): read engine.update().key_presses, update sprites
    }
  }

Rules:
- Import only from "@/lib/coccoon" and "@/lib/micromoth". Everything you need
  is exported from those two modules (their full source is below).
- Export exactly one class implementing Game (ready + process).
- The grid is GRID_W (32) wide by GRID_H (18) tall. y is measured from the
  BOTTOM (y=0 is the bottom row, y=17 is the top row). You place sprites on
  cells; higher z draws on top.
- Input key codes: 0=Up 1=Right 2=Down 3=Left (arrows and WASD are synonyms),
  4=Start (Space/Enter), 5=I 6=J 7=K 8=L. A held key repeats every frame;
  diff against the previous frame for one-shot presses.
- Audio: new SoundList(engine, ["/audio/foo.wav"]) then new Sound(engine, id)
  (add LOOP for looping music). Audio starts after the first input.
- Paste your finished class into the Create editor and press Run.

## Sizing & layout guardrails (READ THIS or your text will be unreadable)

The canvas is a FIXED 1280x720 pixels: GRID_W(32) x GRID_H(18) cells, each
cell CELL = 40px square. Two different coordinate systems coexist, and mixing
them up is the most common mistake:

- Sprite x/y/size and Text x/y/width/height are in GRID CELLS (0..31, 0..17),
  NOT pixels. A Text with width=10, height=2 occupies 400x80 px.
- Text fontSize is in RAW CANVAS PIXELS, not cells and not CSS points. On a
  720px-tall canvas, 12-16px text is nearly invisible. Use these benchmarks:
    - Titles / headers:      36-56 px
    - Subtitles / status:    24-28 px
    - Small / micro labels:  16-20 px  (never below 14)
  The Text default fontSize is 16 — fine for a small HUD label, too small for
  a title. Always set fontSize explicitly for headings.
- Text boxes clip and word-wrap to their box; they do NOT auto-grow. Line
  height is fontSize * 1.35 plus ~6px padding. Budget box HEIGHT (in cells) so
  every line fits: at fontSize 24 one line needs ~1 cell of height, so a
  2-3 line box needs height 2-3. Undersized boxes cut off text.
- y is bottom-up: put a top header around y = 15..16, a bottom HUD around
  y = 0..1. Remember a box of height h is anchored at its bottom-left cell, so
  a header at the top is roughly y = GRID_H - height.

## Quantum: local (MicroMoth) vs. remote (Atlas) — pick by TIMING, not preference

These are NOT interchangeable. They exist for opposite purposes:

- MicroMoth (LOCAL, in-browser): import { MicroMoth } from "@/lib/micromoth".
  A synchronous statevector simulator with 0ms latency, no key, no network.
  USE IT FOR real-time mechanics: per-frame logic, button-press reactions,
  small 1-6 qubit circuits that must resolve this frame. See Qubit Park.
- Atlas (REMOTE, the Moth platform): an ASYNCHRONOUS job pipeline. You POST a
  job and POLL for the result, which can take seconds to minutes (real QPUs /
  heavy simulators). USE IT FOR loading screens, level generation / prefetch,
  procedural content (e.g. Quantum Blur heightmaps), or turn-based phases.
  See quantum-caverns.ts, which submits a job during generation, not in-loop.

HARD RULE: NEVER await an Atlas job in response to real-time input (movement,
firing, a button press). That stalls the game for seconds. If a mechanic needs
quantum results every frame, use MicroMoth. If it needs Atlas, move the call to
a loading / transition / background-prefetch phase and read the cached result
during gameplay. Treat Atlas as a background job pipeline, not a drop-in for
MicroMoth.simulate().

## Moth / Atlas platform API

- Platform & keys: https://platform.mothquantum.com  (one key runs every engine)
- API base: https://api.mothquantum.com
- Flow (see app/api/moth-blur/route.ts for a working proxy):
    1. POST /api/v1/engines/{engine-id}/process        -> 202 { job_id, status }
    2. GET  /api/v1/jobs/{job_id}                       -> { status }  (poll; jobs can take ~2 min)
    3. GET  /api/v1/jobs/{job_id}/result                -> { result: ... }
  Send the key as the "X-API-Key" header. List engines with GET /api/v1/engines.

---
`

function fence(rel: string, content: string): string {
  const lang = rel.endsWith(".ts") || rel.endsWith(".tsx") ? "ts" : ""
  // Guard against an accidental fence collision in source.
  const safe = content.replace(/```/g, "``\u200b`")
  return "```" + lang + "\n" + safe + "\n```"
}

export async function GET() {
  const parts: string[] = [HEADER]

  for (const { rel, heading, note } of SECTIONS) {
    let content: string
    try {
      content = await readFile(path.join(process.cwd(), rel), "utf8")
    } catch {
      content = `// (source unavailable: ${rel})`
    }
    parts.push(`## ${heading}\n\n${note}\n\n${fence(rel, content)}\n`)
  }

  const body = parts.join("\n")
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
