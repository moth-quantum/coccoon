// Starter cartridges for the in-browser "Create" mode.
//
// A cartridge is plain JavaScript that defines two functions:
//   ready(engine)            — called once, set up sprites/text/images
//   process(delta, engine)   — called every frame (30fps)
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

const HELLO_GRID = `// Hello, grid — a movable block on the 32x18 coccoon grid.
// Arrow keys / WASD to move. Esc returns to the menu.

let player      // a Sprite
let label       // a Text
let px = 15      // grid x (0..31)
let py = 8       // grid y, measured from the BOTTOM (0..17)

function ready(engine) {
  // Image id 0 = green, 1 = dark background tile.
  new ImageList(engine, [
    color(0.2, 0.85, 0.45),   // 0: player
    color(0.04, 0.1, 0.06),   // 1: background
  ])

  // Fill the screen with background tiles (id 1).
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      new Sprite(engine, 1, x, y, 0)
    }
  }

  // The player sits on top (z = 1).
  player = new Sprite(engine, 0, px, py, 1)

  label = new Text(engine, "hello, grid", 12, 1.5, 0.5, 16.5, 16,
    color(0.7, 1, 0.8), color(0, 0, 0, 0.5))
}

let prev = []

function process(delta, engine) {
  const keys = engine.update().key_presses
  const just = keys.filter((k) => !prev.includes(k))
  prev = keys.slice()

  // Key codes: 0=Up 1=Right 2=Down 3=Left 5=W 6=A 7=S 8=D
  if (just.includes(0) || just.includes(5)) py = Math.min(GRID_H - 1, py + 1)
  if (just.includes(2) || just.includes(7)) py = Math.max(0, py - 1)
  if (just.includes(1) || just.includes(8)) px = Math.min(GRID_W - 1, px + 1)
  if (just.includes(3) || just.includes(6)) px = Math.max(0, px - 1)

  player.x = px
  player.y = py
  label.text = "x " + px + "  y " + py
}
`

const QUANTUM_SKETCH = `// Quantum sketch — color every tile with a one-qubit circuit.
// Press Space to re-roll the rotation seeds and regenerate the field.

const PALETTE = [
  color(0.05, 0.1, 0.2),   // 0
  color(0.1, 0.3, 0.5),    // 1
  color(0.2, 0.55, 0.6),   // 2
  color(0.3, 0.75, 0.55),  // 3
  color(0.6, 0.9, 0.5),    // 4
  color(0.95, 0.95, 0.7),  // 5
]

let tiles = {}   // "x,y" -> Sprite
let seeds = []

function reseed() {
  seeds = []
  for (let i = 0; i < 4; i++) seeds.push(Math.random())
}

// Probability of measuring |0> for a single qubit at grid position (x, y).
function tileFor(x, y) {
  const qc = new MicroMoth.QuantumCircuit(1)
  qc.rx((seeds[0] * x + seeds[1] * y) * Math.PI / 9, 0)
  qc.ry((seeds[2] * x - seeds[3] * y) * Math.PI / 9, 0)
  const probs = MicroMoth.simulate(qc, 1, "probabilities_dict")
  const p0 = probs["0"] || 0
  return Math.round(p0 * (PALETTE.length - 1))
}

function paint() {
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      tiles[x + "," + y].image_id = tileFor(x, y)
    }
  }
}

function ready(engine) {
  new ImageList(engine, PALETTE)
  reseed()
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_H; y++) {
      tiles[x + "," + y] = new Sprite(engine, 0, x, y, 0)
    }
  }
  paint()
  new Text(engine, "Space: re-roll quantum seeds", 20, 1.5, 0.5, 0.5, 14,
    color(0.9, 1, 0.9), color(0, 0, 0, 0.55))
}

let prev = []

function process(delta, engine) {
  const keys = engine.update().key_presses
  const just = keys.filter((k) => !prev.includes(k))
  prev = keys.slice()
  if (just.includes(4)) {   // Space
    reseed()
    paint()
  }
}
`

export const CARTRIDGES: Cartridge[] = [
  {
    id: "hello-grid",
    name: "Hello, grid",
    blurb: "A movable block. Learn sprites, text, and per-frame input.",
    code: HELLO_GRID,
  },
  {
    id: "quantum-sketch",
    name: "Quantum sketch",
    blurb: "Color every tile from a one-qubit circuit. Re-roll with Space.",
    code: QUANTUM_SKETCH,
  },
]
