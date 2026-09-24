// quantum-snake.js — a coccoon game
//
// Classic snake where food is placed by quantum circuit measurement.
// Upload three PNGs in the editor before running:
//   head.png   — snake head, drawn facing RIGHT by default (rotated per direction)
//   body.png   — snake body segment
//   apple.png  — the food
//
// Key codes: 0=Up  1=Right  2=Down  3=Left  4=Space

import { GRID_W, GRID_H, ImageList, Sprite, Text, color, Colors, asset } from "@/lib/coccoon"
import { MicroMoth } from "@/lib/micromoth"

const IMG_BG   = 0
const IMG_BODY = 1
const IMG_HEAD = 2
const IMG_FOOD = 3

// Rotation (degrees) for a head sprite that faces RIGHT in the source PNG.
// Canvas rotation is clockwise; coccoon y=0 is bottom so "up" = screen top.
const HEAD_ANGLE = [270, 0, 90, 180]   // [Up, Right, Down, Left]

const SPEED_START = 8    // frames between moves at score 0
const SPEED_MIN   = 3    // fastest (score 25+)

export class QuantumSnake {
  _tiles = []
  _hud = null
  _titleBox = null
  _infoBox = null

  _snake = []
  _dir = 1
  _nextDir = 1
  _food = { x: 0, y: 0 }
  _score = 0
  _tick = 0
  _prevKeys = []
  _dead = false
  _started = false

  ready(engine) {
    new ImageList(engine, [
      color(0.04, 0.07, 0.04),  // 0 bg (solid colour — no upload needed)
      asset("body.png"),         // 1 body segment
      asset("head.png"),         // 2 head (faces right in source PNG)
      asset("apple.png"),        // 3 food
    ])

    for (let x = 0; x < GRID_W; x++) {
      this._tiles[x] = []
      for (let y = 0; y < GRID_H; y++) {
        this._tiles[x][y] = new Sprite(engine, IMG_BG, x, y, 0)
      }
    }

    // Text(engine, text, width, height, x, y, fontSize, fontColor, bgColor)
    // y is bottom-up: y=17 is the top row.

    this._hud = new Text(engine, "",
      32, 1, 0, 17,
      24, Colors.WHITE, color(0, 0, 0, 0.65))

    this._titleBox = new Text(engine, "QUANTUM SNAKE",
      24, 3, 4, 12,
      44, color(0.45, 1.0, 0.45), color(0.04, 0.07, 0.04, 0.93))

    this._infoBox = new Text(engine,
      "Food falls where a quantum circuit decides.\n\n" +
      "Arrow keys or WASD — steer\n" +
      "Space — start",
      24, 6, 4, 5,
      20, Colors.WHITE, color(0.04, 0.07, 0.04, 0.93))
  }

  _placeFood() {
    const occupied = new Set(this._snake.map(s => `${s.x},${s.y}`))
    const phi = (this._score + 1) * Math.PI / 11

    const qcX = new MicroMoth.QuantumCircuit(5)
    const qcY = new MicroMoth.QuantumCircuit(5)
    for (let i = 0; i < 5; i++) { qcX.h(i); qcY.h(i) }
    qcX.cx(0, 1); qcX.cx(2, 4); qcX.rz(phi, 0); qcX.rz(phi * 1.4, 3)
    qcY.cx(1, 3); qcY.cx(0, 4); qcY.rz(phi * 0.8, 2); qcY.rz(phi * 1.2, 1)
    for (let i = 0; i < 5; i++) { qcX.h(i); qcY.h(i) }

    const xs = MicroMoth.simulate(qcX, 32, "memory")
    const ys = MicroMoth.simulate(qcY, 32, "memory")

    for (let i = 0; i < 32; i++) {
      const x = parseInt(xs[i % xs.length], 2)
      const y = Math.floor(parseInt(ys[i % ys.length], 2) * GRID_H / 32)
      if (isNaN(x) || isNaN(y)) continue
      if (!occupied.has(`${x},${y}`)) { this._food = { x, y }; return }
    }
    for (let x = 0; x < GRID_W; x++)
      for (let y = 0; y < GRID_H; y++)
        if (!occupied.has(`${x},${y}`)) { this._food = { x, y }; return }
  }

  _startGame() {
    const cx = Math.floor(GRID_W / 2)
    const cy = Math.floor(GRID_H / 2)
    this._snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }]
    this._dir = 1
    this._nextDir = 1
    this._score = 0
    this._tick = 0
    this._dead = false
    for (const t of [this._titleBox, this._infoBox]) {
      t.set_font_color(color(0, 0, 0, 0))
      t.set_background_color(color(0, 0, 0, 0))
    }
    this._placeFood()
    this._hud.text = "Score: 0"
    this._render()
  }

  _justPressed(engine) {
    const keys = engine.update().key_presses
    const just = keys.filter(k => !this._prevKeys.includes(k))
    this._prevKeys = keys.slice()
    return { keys, just }
  }

  _render() {
    // Clear all tiles
    for (let x = 0; x < GRID_W; x++)
      for (let y = 0; y < GRID_H; y++) {
        this._tiles[x][y].image_id = IMG_BG
        this._tiles[x][y].angle = 0
      }

    // Food
    this._tiles[this._food.x][this._food.y].image_id = IMG_FOOD

    // Snake — tail to head so head sprite wins on the head cell
    for (let i = this._snake.length - 1; i >= 0; i--) {
      const spr = this._tiles[this._snake[i].x][this._snake[i].y]
      if (i === 0) {
        spr.image_id = IMG_HEAD
        spr.angle = HEAD_ANGLE[this._dir]
      } else {
        spr.image_id = IMG_BODY
        spr.angle = 0
      }
    }
  }

  _step() {
    const opp = [2, 3, 0, 1]
    if (this._nextDir !== opp[this._dir]) this._dir = this._nextDir

    // y=0 is bottom row: Up(0)→dy=+1, Down(2)→dy=-1
    const dx = [0, 1, 0, -1][this._dir]
    const dy = [1, 0, -1, 0][this._dir]

    const { x: hx, y: hy } = this._snake[0]
    const nx = hx + dx
    const ny = hy + dy

    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) { this._die(); return }
    for (let i = 0; i < this._snake.length - 1; i++)
      if (this._snake[i].x === nx && this._snake[i].y === ny) { this._die(); return }

    this._snake.unshift({ x: nx, y: ny })

    if (nx === this._food.x && ny === this._food.y) {
      this._score++
      this._hud.text = `Score: ${this._score}`
      this._placeFood()
    } else {
      this._snake.pop()
    }
  }

  _die() {
    this._dead = true
    this._hud.text = ""
    this._titleBox.text = "GAME OVER"
    this._titleBox.set_font_color(color(1.0, 0.3, 0.3))
    this._titleBox.set_background_color(color(0.12, 0.02, 0.02, 0.93))
    this._infoBox.text = `Score: ${this._score}\n\nSpace to play again`
    this._infoBox.set_font_color(Colors.WHITE)
    this._infoBox.set_background_color(color(0.12, 0.02, 0.02, 0.93))
  }

  process(_delta, engine) {
    const { just } = this._justPressed(engine)

    if (!this._started) {
      if (just.includes(4)) { this._started = true; this._startGame() }
      return
    }
    if (this._dead) {
      if (just.includes(4)) this._startGame()
      return
    }

    if      (just.includes(0)) this._nextDir = 0
    else if (just.includes(1)) this._nextDir = 1
    else if (just.includes(2)) this._nextDir = 2
    else if (just.includes(3)) this._nextDir = 3

    this._tick++
    const speed = Math.max(SPEED_MIN, SPEED_START - Math.floor(this._score / 5))
    if (this._tick % speed === 0) {
      this._step()
      if (!this._dead) this._render()
    }
  }
}
