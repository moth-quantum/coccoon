// Starter cartridges for the in-browser "Create" mode.
//
// A cartridge is plain JavaScript that defines two functions:
//   ready(engine)            — called once, set up sprites/text/images
//   process(delta, engine)   — called every frame (~30fps)
//
// The following are injected as globals when the cartridge runs:
//   ImageList, Sprite, Text, color, Colors, GRID_W, GRID_H, MicroMoth, console
// These are the same primitives the built-in games use, so cartridges have
// full access to the coccoon engine and the MicroMoth quantum simulator.

export type Cartridge = {
  id: string
  name: string
  blurb: string
  code: string
}

const HELLO_GRID = `// ============================================================
//  HELLO, GRID — a tutorial cartridge for the coccoon engine
// ============================================================
//
//  coccoon draws to a fixed grid that is GRID_W (32) tiles wide
//  and GRID_H (18) tiles tall. You never touch pixels directly:
//  you place "sprites" on grid cells and the engine renders them.
//
//  Every cartridge defines exactly two functions:
//
//    ready(engine)           runs ONCE when the game starts.
//                            Use it to register images and create
//                            your initial sprites and text.
//
//    process(delta, engine)  runs EVERY FRAME (~30 times a second).
//                            Read input and update your sprites here.
//                            'delta' is the seconds since the last
//                            frame — multiply movement by it if you
//                            want frame-rate-independent speed.
//
//  This cartridge draws a background, puts a movable block on top,
//  and shows a live coordinate readout. Arrow keys / WASD to move,
//  Esc returns to the menu.

// ---- Cartridge state ----------------------------------------
// Declare your persistent state at module scope so it survives
// between process() calls.

let player      // the Sprite the user moves
let label       // a Text overlay showing coordinates
let px = 15     // player grid x, columns 0..GRID_W-1 (left to right)
let py = 8      // player grid y, rows   0..GRID_H-1 (BOTTOM to top)

// ---- ready(): one-time setup --------------------------------

function ready(engine) {
  // STEP 1 — Register an image list.
  // An ImageList maps numeric image ids (0, 1, 2, ...) to what
  // gets drawn. Here each id is a flat color made with
  // color(r, g, b) where each channel is 0..1. (You can also pass
  // an HTMLImageElement for real artwork.)
  new ImageList(engine, [
    color(0.2, 0.85, 0.45),   // id 0: the player (green)
    color(0.04, 0.1, 0.06),   // id 1: background tile (near-black)
  ])

  // STEP 2 — Fill the grid with background sprites.
  // new Sprite(engine, imageId, x, y, z) places image 'imageId' at
  // grid cell (x, y). 'z' is the draw order: higher z draws on top.
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      new Sprite(engine, 1, x, y, 0)   // z = 0, the bottom layer
    }
  }

  // STEP 3 — Create the player on a higher layer (z = 1) so it is
  // always drawn above the background. Keep the reference so we can
  // move it later.
  player = new Sprite(engine, 0, px, py, 1)

  // STEP 4 — Add a text overlay.
  // new Text(engine, text, maxChars, size, x, y, z, fg, bg)
  //   x/y are in grid units (fractions allowed), z is draw order.
  label = new Text(engine, "hello, grid", 12, 1.5, 0.5, 16.5, 16,
    color(0.7, 1, 0.8), color(0, 0, 0, 0.5))
}

// ---- Input handling helper ----------------------------------
// engine.update() returns the current frame's input, including
// key_presses: an array of the key codes held THIS frame.
//
// Key codes (the coccoon d-pad + four face buttons):
//   0=Up  1=Right  2=Down  3=Left   ← arrows AND WASD both map here
//   4=Start (Space)
//   5=I   6=J      7=K     8=L       ← the four face buttons
//
// Because arrow keys and WASD are synonyms, you only ever read the
// direction (0..3) — never which physical key produced it.
//
// Because process() runs every frame, a held key appears in
// key_presses on many consecutive frames. To move one cell per
// tap (not once per frame), we compare against the previous frame
// and act only on keys that are newly pressed.

let prev = []

function process(delta, engine) {
  const keys = engine.update().key_presses
  const just = keys.filter((k) => !prev.includes(k))
  prev = keys.slice()

  // Remember: y is measured from the BOTTOM, so "Up" increases y.
  if (just.includes(0)) py = Math.min(GRID_H - 1, py + 1)  // Up    (arrow / W)
  if (just.includes(2)) py = Math.max(0, py - 1)           // Down  (arrow / S)
  if (just.includes(1)) px = Math.min(GRID_W - 1, px + 1)  // Right (arrow / D)
  if (just.includes(3)) px = Math.max(0, px - 1)           // Left  (arrow / A)

  // Write the new position back onto the sprite. Assigning to
  // sprite.x / sprite.y moves it on the next render.
  player.x = px
  player.y = py

  // Text objects work the same way — set .text to update the label.
  label.text = "x " + px + "  y " + py
}
`

export const CARTRIDGES: Cartridge[] = [
  {
    id: "hello-grid",
    name: "Hello, grid",
    blurb: "A guided tour of the engine: images, sprites, the grid, text, and input.",
    code: HELLO_GRID,
  },
]
