// Qubit Park — quantum terrain generation, and a tutorial introduction to coccoon.
//
// Web port of games/qubit_park/qubit_park.gd. The quantum logic is unchanged:
// every terrain tile is chosen by a single-qubit circuit whose rotation angles
// depend on world position. Only the engine calls are adapted to the TS API.

import { Coccoon, GRID_W, GRID_H, ImageList, Sprite, Text, color, Colors, type Game } from "@/lib/coccoon"
import { MicroMoth } from "@/lib/micromoth"

const TERRAIN_TYPES = 6

const IMAGE_PATHS = [
  "/images/terrain-water.png", // 0
  "/images/terrain-red-flower.png", // 1
  "/images/terrain-grass.png", // 2
  "/images/terrain-path.png", // 3
  "/images/terrain-grass.png", // 4 (listed twice for convenience)
  "/images/terrain-purple-flower.png", // 5
  "/images/terrain-tree.png", // 6
]

export class QubitPark implements Game {
  private _engine!: Coccoon
  private _sprites: Record<string, Sprite> = {}
  private _posX = 0
  private _posY = 0
  private _s: number[] = []

  private _title = true
  private _titleText!: Text
  private _infoText!: Text
  private _prevKeys: number[] = []

  // title-background generation, one row per frame (replaces the GDScript coroutine)
  private _titleGenRow = 0
  private _titleGenDone = false

  ready(engine: Coccoon): void {
    this._engine = engine

    // ImageList maps integer indices to image files (or Color values).
    new ImageList(engine, IMAGE_PATHS)

    // Six seed values — one for each rotation parameter in _getImageId.
    this._s = []
    for (let i = 0; i < 6; i++) this._s.push(0.5 * Math.random())

    // One sprite per screen cell; scrolling swaps image ids rather than moving nodes.
    for (let dx = 0; dx < GRID_W; dx++) {
      for (let dy = 0; dy < GRID_H; dy++) {
        this._sprites[`${dx},${dy}`] = new Sprite(engine, 2, dx, dy, 0)
      }
    }

    this._titleText = new Text(engine, "QUBIT PARK", 26.0, 3.5, 3.0, 12.5, 40, Colors.WHITE, color(0.03, 0.08, 0.03, 0.88))
    this._infoText = new Text(
      engine,
      "Quantum terrain generator\n\n" +
        "Every tile is computed from a single-qubit circuit\n" +
        "whose rotation angles depend on its world position.\n\n" +
        "Arrow keys or Space to start\n" +
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

  // Map a world position to one of six terrain images via a single-qubit circuit.
  private _getImageId(x: number, y: number): number {
    const qc = new MicroMoth.QuantumCircuit(1)

    const tx = ((this._s[0] * x + this._s[1] * y) * Math.PI) / 7.0
    const ty = ((this._s[2] * x - this._s[3] * y) * Math.PI) / 7.0
    const tz = ((this._s[4] * (x + y) + this._s[5] * (x - y)) * Math.PI) / 7.0

    qc.rx(tx, 0)
    qc.rz(tz, 0)
    qc.ry(ty, 0)

    const probs = MicroMoth.simulate(qc, 1024, "probabilities_dict") as Record<string, number>
    return Math.round((probs["0"] ?? 0.0) * (TERRAIN_TYPES - 1))
  }

  private _refreshTerrain(): void {
    for (let dx = 0; dx < GRID_W; dx++) {
      for (let dy = 0; dy < GRID_H; dy++) {
        this._sprites[`${dx},${dy}`].image_id = this._getImageId(this._posX + dx, this._posY + dy)
      }
    }
  }

  process(_delta: number, engine: Coccoon): void {
    // Paint the title-screen terrain one row per frame so the title stays responsive.
    if (!this._titleGenDone && this._titleGenRow < GRID_H) {
      const dy = this._titleGenRow
      for (let dx = 0; dx < GRID_W; dx++) {
        this._sprites[`${dx},${dy}`].image_id = this._getImageId(dx, dy)
      }
      this._titleGenRow++
      if (this._titleGenRow >= GRID_H) this._titleGenDone = true
    }

    const inp = engine.update()
    const keys = inp.key_presses
    const justPressed: number[] = []
    for (const k of keys) if (!this._prevKeys.includes(k)) justPressed.push(k)
    this._prevKeys = keys.slice()

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
