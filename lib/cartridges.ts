// Starter cartridges for the in-browser "Create" mode.
//
// A cartridge is written EXACTLY like a built-in demo game: it imports the
// engine primitives from "@/lib/coccoon" (and optionally the quantum
// simulator from "@/lib/micromoth") and exports a class implementing Game:
//
//   import { Coccoon, Sprite, ... , type Game } from "@/lib/coccoon"
//   export class MyGame implements Game {
//     ready(engine)          — called once; register images, create sprites
//     process(delta, engine) — called every frame (~30fps); read input, update
//   }
//
// The cartridge is transpiled in the browser (TypeScript -> JS) and its
// imports are resolved to the same modules the demos use, so anything you
// learn from the demo source works verbatim here.
//
// Allowed imports:
//   "@/lib/coccoon"   — Coccoon, ImageList, Sprite, Text, color, Colors,
//                       GRID_W, GRID_H, CELL, SoundList, Sound, LOOP, Game
//   "@/lib/micromoth" — MicroMoth (tiny statevector simulator)
//
// Audio: register sounds with `new SoundList(engine, ["/audio/foo.wav"])`,
// then play a channel with `new Sound(engine, id)` (add LOOP for looping
// music, e.g. `new Sound(engine, 0, LOOP)`). Audio starts on first input.

export type Cartridge = {
  id: string
  name: string
  blurb: string
  code: string
}

const CARTRIDGE = `// ============================================================
//  CARTRIDGE — a tutorial for the coccoon engine
// ============================================================
//
//  A cartridge is authored exactly like the built-in demo games:
//  import the primitives you need, then export a class that
//  implements Game. Read any demo's source (Qubit Park is the
//  gentlest) and you can paste the same patterns straight in here.
//
//  coccoon draws to a fixed grid that is GRID_W (32) tiles wide
//  and GRID_H (18) tiles tall. You never touch pixels directly:
//  you place "sprites" on grid cells and the engine renders them.
//
//  A Game has two methods:
//
//    ready(engine)           runs ONCE when the game starts.
//                            Register images, create your initial
//                            sprites and text.
//
//    process(delta, engine)  runs EVERY FRAME (~30 times a second).
//                            Read input and update your sprites.
//                            'delta' is the seconds since the last
//                            frame — multiply movement by it for
//                            frame-rate-independent speed.
//
//  This cartridge draws a background, puts a movable block on top,
//  and shows a live coordinate readout. Arrow keys / WASD to move,
//  Esc returns to the menu.

import {
  ImageList,
  Sprite,
  Text,
  color,
  GRID_W,
  GRID_H,
  type Coccoon,
  type Game,
} from "@/lib/coccoon"

export class Cartridge implements Game {
  // ---- State -------------------------------------------------
  // Instance fields hold state that persists across frames.
  player!: Sprite   // the Sprite the user moves
  label!: Text      // a Text overlay showing coordinates
  px = 15           // player grid x, columns 0..GRID_W-1 (left to right)
  py = 8            // player grid y, rows   0..GRID_H-1 (BOTTOM to top)
  prev: number[] = [] // key codes held on the previous frame

  // ---- ready(): one-time setup -------------------------------
  ready(engine: Coccoon) {
    // STEP 1 — Register an image list. An ImageList maps numeric
    // image ids (0, 1, 2, ...) to what gets drawn. Here each id is
    // a flat color made with color(r, g, b), channels 0..1. (You
    // can also pass an HTMLImageElement for real artwork.)
    new ImageList(engine, [
      color(0.2, 0.85, 0.45),   // id 0: the player (green)
      color(0.04, 0.1, 0.06),   // id 1: background tile (near-black)
    ])

    // STEP 2 — Fill the grid with background sprites. new Sprite(
    // engine, imageId, x, y, z) places image 'imageId' at grid cell
    // (x, y). 'z' is the draw order: higher z draws on top.
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        new Sprite(engine, 1, x, y, 0)   // z = 0, the bottom layer
      }
    }

    // STEP 3 — Create the player on a higher layer (z = 1) so it is
    // always drawn above the background.
    this.player = new Sprite(engine, 0, this.px, this.py, 1)

    // STEP 4 — Add a text overlay.
    // new Text(engine, text, maxChars, size, x, y, z, fg, bg)
    this.label = new Text(engine, "hello, grid", 12, 1.5, 0.5, 16.5, 16,
      color(0.7, 1, 0.8), color(0, 0, 0, 0.5))
  }

  // ---- process(): once per frame -----------------------------
  // engine.update() returns this frame's input, including
  // key_presses: an array of the key codes held THIS frame.
  //
  // Key codes (the coccoon d-pad + four face buttons):
  //   0=Up  1=Right  2=Down  3=Left   ← arrows AND WASD both map here
  //   4=Start (Space / Enter)
  //   5=I   6=J      7=K     8=L       ← the four face buttons
  //
  // A held key appears every frame, so we compare against the
  // previous frame and act only on keys that are newly pressed —
  // one cell per tap, not one per frame.
  process(delta: number, engine: Coccoon) {
    const keys = engine.update().key_presses
    const just = keys.filter((k) => !this.prev.includes(k))
    this.prev = keys.slice()

    // Remember: y is measured from the BOTTOM, so "Up" increases y.
    if (just.includes(0)) this.py = Math.min(GRID_H - 1, this.py + 1) // Up    (arrow / W)
    if (just.includes(2)) this.py = Math.max(0, this.py - 1)          // Down  (arrow / S)
    if (just.includes(1)) this.px = Math.min(GRID_W - 1, this.px + 1) // Right (arrow / D)
    if (just.includes(3)) this.px = Math.max(0, this.px - 1)          // Left  (arrow / A)

    // Assigning to sprite.x / sprite.y moves it on the next render.
    this.player.x = this.px
    this.player.y = this.py

    // Text objects work the same way — set .text to update the label.
    this.label.text = "x " + this.px + "  y " + this.py
  }
}
`

export const CARTRIDGES: Cartridge[] = [
  {
    id: "cartridge",
    name: "Cartridge",
    blurb: "A guided tour of the engine: imports, a Game class, images, sprites, the grid, text, and input.",
    code: CARTRIDGE,
  },
]
