// ============================================================================
// QUBIT PARK — a tutorial introduction to the coccoon game engine.
// ============================================================================
//
// This is a web port of games/qubit_park/qubit_park.gd. The quantum logic is
// unchanged from the original: every terrain tile is chosen by a single-qubit
// circuit whose rotation angles depend on the tile's world position. Only the
// engine calls are adapted to coccoon's TypeScript API.
//
// Read this file top to bottom — the comments walk you through everything you
// need to build your own coccoon game.
//
// ----------------------------------------------------------------------------
// STEP 1: Import the tools you need from coccoon.
// ----------------------------------------------------------------------------
// Everything the engine gives you lives in "@/lib/coccoon". You pull in only
// the pieces you use:
//   - Coccoon   the engine instance (the "console"). Handed to you in ready().
//   - GRID_W    the screen width  in tiles (32). The playfield is a fixed grid.
//   - GRID_H    the screen height in tiles (18).
//   - ImageList registers the images your game can draw, in order (see STEP 3).
//   - Sprite    a single drawable cell on the grid that shows one image.
//   - Text      an on-screen text box (used here for the title card).
//   - color()   builds an RGBA color; Colors is a set of named presets.
//   - Game      the interface your game class implements (ready + process).
import { Coccoon, GRID_W, GRID_H, ImageList, Sprite, Text, color, Colors, type Game } from "@/lib/coccoon"

// ----------------------------------------------------------------------------
// STEP 2: For fast simulation of simple quantum things, import MicroMoth.
// ----------------------------------------------------------------------------
// MicroMoth is a tiny statevector simulator that runs entirely in the browser.
// It's perfect for small circuits (a few qubits) that you want to evaluate
// instantly, every frame, with no network call. Build a QuantumCircuit, apply
// gates, then simulate() to read out probabilities. (For heavier quantum work
// you would instead call the Moth platform — see Quantum Caverns for that.)
import { MicroMoth } from "@/lib/micromoth"

const TERRAIN_TYPES = 6

// ----------------------------------------------------------------------------
// STEP 3: Import your images. You refer to them later by their INDEX.
// ----------------------------------------------------------------------------
// The order of this list defines each image's id: the first is 0, the next is
// 1, then 2, and so on. A Sprite doesn't hold a file path — it holds an image
// id (an integer) that points into this list. So a sprite showing "grass" is
// really just a sprite whose image_id is 2, because grass is the 3rd entry.
//
// Keep the indices in mind — _getImageId() below returns one of these numbers,
// and that number is assigned straight to a sprite's image_id.
const IMAGE_PATHS = [
  "/images/terrain-water.png", // 0  water
  "/images/terrain-red-flower.png", // 1  red flower
  "/images/terrain-grass.png", // 2  grass
  "/images/terrain-path.png", // 3  path
  "/images/terrain-grass.png", // 4  grass again (listed twice for convenience)
  "/images/terrain-purple-flower.png", // 5  purple flower
  "/images/terrain-tree.png", // 6  tree
]

// ----------------------------------------------------------------------------
// STEP 4: Write your game as a class that implements Game.
// ----------------------------------------------------------------------------
// The Game interface requires two methods:
//   ready(engine)          called once, at startup. Do all your setup here.
//   process(delta, engine) called once per frame. Do input + logic + drawing.
// Anything your game needs to remember between frames lives as a field.
export class QubitPark implements Game {
  private _engine!: Coccoon

  // We keep one Sprite per screen cell, keyed by "dx,dy" grid coordinates.
  // Scrolling the world never moves these sprites — it just swaps their
  // image_id (see _refreshTerrain). This is the core coccoon trick: a fixed
  // grid of sprites whose images change.
  private _sprites: Record<string, Sprite> = {}

  // The world offset. As the player scrolls, (posX, posY) is the world
  // coordinate that currently sits in the top-left cell of the screen.
  private _posX = 0
  private _posY = 0

  // Six random "seed" values that shape the quantum rotations, so every run
  // produces a different landscape.
  private _s: number[] = []

  private _title = true
  private _titleText!: Text
  private _infoText!: Text

  // Input in coccoon is polled per frame (see STEP 6). To detect a key that
  // was *just* pressed this frame, we remember which keys were down last frame.
  private _prevKeys: number[] = []

  // The title background is painted one row per frame so the title card stays
  // responsive instead of freezing while all 32x18 tiles are simulated.
  private _titleGenRow = 0
  private _titleGenDone = false

  // --------------------------------------------------------------------------
  // ready(): one-time setup. The engine passes you the Coccoon instance.
  // --------------------------------------------------------------------------
  ready(engine: Coccoon): void {
    this._engine = engine

    // Register the images. ImageList maps the integer indices from STEP 3 to
    // the actual image files. After this, image_id 0 means water, 2 means
    // grass, and so on. You only need to do this once.
    new ImageList(engine, IMAGE_PATHS)

    // Six seed values — one per rotation parameter used in _getImageId().
    this._s = []
    for (let i = 0; i < 6; i++) this._s.push(0.5 * Math.random())

    // Create the grid of sprites. new Sprite(engine, imageId, gridX, gridY, z):
    //   imageId  which image to show initially (2 = grass here)
    //   gridX    column, 0 .. GRID_W-1
    //   gridY    row,    0 .. GRID_H-1
    //   z        draw order (higher draws on top)
    // We make one sprite for every cell on screen and store it by coordinate.
    for (let dx = 0; dx < GRID_W; dx++) {
      for (let dy = 0; dy < GRID_H; dy++) {
        this._sprites[`${dx},${dy}`] = new Sprite(engine, 2, dx, dy, 0)
      }
    }

    // A Text box for the title. new Text(engine, string, fontSize, gridX,
    // gridY, width, height, fontColor, backgroundColor). Coordinates and sizes
    // are in grid units, matching the sprite grid.
    this._titleText = new Text(engine, "QUBIT PARK", 26.0, 3.5, 3.0, 12.5, 40, Colors.WHITE, color(0.03, 0.08, 0.03, 0.88))
    this._infoText = new Text(
      engine,
      "Quantum terrain generator\n\n" +
        "Every tile is computed from a single-qubit circuit\n" +
        "whose rotation angles depend on its world position.\n\n" +
        "Arrow keys / WASD or Space to start\n" +
        "Esc to menu",
      26.0,
      6.5,
      3.0,
      5.0,
      15,
      color(0.75, 1.0, 0.75),
      color(0.03, 0.08, 0.03, 0.88),
    )
  }

  // --------------------------------------------------------------------------
  // STEP 5: The quantum part. Map a world position to one of six terrain
  // images using a single-qubit circuit simulated by MicroMoth.
  // --------------------------------------------------------------------------
  private _getImageId(x: number, y: number): number {
    // Build a circuit with a single qubit.
    const qc = new MicroMoth.QuantumCircuit(1)

    // Turn the world position (and our random seeds) into three rotation
    // angles. Because the angles are a smooth function of x and y, neighbouring
    // tiles get similar-but-not-identical results — that's what makes the
    // landscape look continuous rather than pure noise.
    const tx = ((this._s[0] * x + this._s[1] * y) * Math.PI) / 7.0
    const ty = ((this._s[2] * x - this._s[3] * y) * Math.PI) / 7.0
    const tz = ((this._s[4] * (x + y) + this._s[5] * (x - y)) * Math.PI) / 7.0

    // Apply rotation gates around the X, Z and Y axes of the Bloch sphere.
    qc.rx(tx, 0)
    qc.rz(tz, 0)
    qc.ry(ty, 0)

    // Simulate and read the probability of measuring |0>. simulate() with
    // "probabilities_dict" returns a map like { "0": 0.7, "1": 0.3 }.
    const probs = MicroMoth.simulate(qc, 1024, "probabilities_dict") as Record<string, number>

    // Scale P(|0>) in [0,1] to an image index in [0, TERRAIN_TYPES-1]. This is
    // the number we hand straight to a sprite's image_id (see STEP 3).
    return Math.round((probs["0"] ?? 0.0) * (TERRAIN_TYPES - 1))
  }

  // Recompute every on-screen tile for the current world offset. Note we don't
  // move sprites — we only reassign image_id on the sprites that already exist.
  private _refreshTerrain(): void {
    for (let dx = 0; dx < GRID_W; dx++) {
      for (let dy = 0; dy < GRID_H; dy++) {
        this._sprites[`${dx},${dy}`].image_id = this._getImageId(this._posX + dx, this._posY + dy)
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 6: process(): runs every frame. Read input, update state, draw.
  // --------------------------------------------------------------------------
  process(_delta: number, engine: Coccoon): void {
    // Paint the title-screen terrain one row per frame so the title stays
    // responsive instead of blocking on all 18 rows of simulation at once.
    if (!this._titleGenDone && this._titleGenRow < GRID_H) {
      const dy = this._titleGenRow
      for (let dx = 0; dx < GRID_W; dx++) {
        this._sprites[`${dx},${dy}`].image_id = this._getImageId(dx, dy)
      }
      this._titleGenRow++
      if (this._titleGenRow >= GRID_H) this._titleGenDone = true
    }

    // engine.update() advances the engine and returns this frame's input.
    // inp.key_presses is an array of the direction/action keys held THIS frame.
    // Direction codes come from either the arrow keys or WASD (synonymous):
    //   0 = up, 1 = right, 2 = down, 3 = left, 4 = start/space.
    const inp = engine.update()
    const keys = inp.key_presses

    // Derive "just pressed this frame" by diffing against last frame's keys.
    const justPressed: number[] = []
    for (const k of keys) if (!this._prevKeys.includes(k)) justPressed.push(k)
    this._prevKeys = keys.slice()

    // While the title card is up, any key press starts the game: hide the text
    // (by making it transparent) and make sure the terrain is generated.
    if (this._title) {
      if ([0, 1, 2, 3, 4].some((k) => justPressed.includes(k))) {
        this._title = false
        for (const t of [this._titleText, this._infoText]) {
          t.set_font_color(color(0, 0, 0, 0))
          t.set_background_color(color(0, 0, 0, 0))
        }
        if (!this._titleGenDone) this._refreshTerrain()
      }
      return
    }

    // Gameplay: held direction keys scroll the world. We only re-simulate the
    // terrain when the offset actually changed, to avoid needless work.
    let moved = false
    if (keys.includes(0)) {
      this._posY += 1
      moved = true
    }
    if (keys.includes(1)) {
      this._posX += 1
      moved = true
    }
    if (keys.includes(2)) {
      this._posY -= 1
      moved = true
    }
    if (keys.includes(3)) {
      this._posX -= 1
      moved = true
    }
    if (moved) this._refreshTerrain()
  }
}
