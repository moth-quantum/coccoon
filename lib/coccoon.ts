// coccoon — quantum game engine, HTML5 Canvas backend.
//
// Web port of coccoon.gd (https://github.com/moth-quantum/coccoon).
// The original renders a virtual 32x18 cell grid using Godot scene nodes;
// this version renders the same grid to a <canvas>. The public API
// (ImageList, Sprite, Text, update) mirrors the GDScript engine so game
// code ports across almost verbatim.

export const FPS = 30
export const CELL = 40
export const GRID_W = 32
export const GRID_H = 18

// Colors use 0..1 float channels to match Godot's Color type.
export type Color = { r: number; g: number; b: number; a: number }

export const Colors = {
  BLACK: { r: 0, g: 0, b: 0, a: 1 } as Color,
  WHITE: { r: 1, g: 1, b: 1, a: 1 } as Color,
}

export function color(r: number, g: number, b: number, a = 1): Color {
  return { r, g, b, a }
}

function toCss(c: Color): string {
  const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255)
  return `rgba(${to255(c.r)}, ${to255(c.g)}, ${to255(c.b)}, ${c.a})`
}

// Key codes match the original engine's _KEY_MAP.
const KEY_MAP: Record<string, number> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  Space: 4,
  KeyW: 5,
  KeyA: 6,
  KeyS: 7,
  KeyD: 8,
  Escape: -1,
}

type ImageEntry = string | Color
type LoadedImage = { kind: "image"; el: HTMLImageElement } | { kind: "color"; css: string }

export interface InputState {
  key_presses: number[]
  clicks: unknown[]
}

// A game implements ready() once and process(delta) every frame.
export interface Game {
  ready(engine: Coccoon): void
  process(delta: number, engine: Coccoon): void
}

export class Sprite {
  _engine: Coccoon
  _imageId: number
  _size: number
  _x: number
  _y: number
  z: number
  angle: number
  flip_h: boolean
  flip_v: boolean

  constructor(
    engine: Coccoon,
    imageId: number,
    x = 0,
    y = 0,
    z = 0,
    size = 1,
    angle = 0,
    flip_h = false,
    flip_v = false,
  ) {
    this._engine = engine
    this._imageId = imageId
    this._size = size
    this._x = x
    this._y = y
    this.z = z
    this.angle = angle
    this.flip_h = flip_h
    this.flip_v = flip_v
    engine._sprites.push(this)
  }

  get image_id(): number {
    return this._imageId
  }
  set image_id(v: number) {
    this._imageId = v
  }

  get x(): number {
    return this._x
  }
  set x(v: number) {
    this._x = v
  }

  get y(): number {
    return this._y
  }
  set y(v: number) {
    this._y = v
  }

  get size(): number {
    return this._size
  }
  set size(v: number) {
    this._size = v
  }

  _draw(ctx: CanvasRenderingContext2D): void {
    const img = this._engine._images[this._imageId]
    if (!img) return
    const s = this._size * CELL
    // y is measured from the bottom of the grid, like the original engine.
    const px = this._x * CELL
    const py = (GRID_H - this._y - this._size) * CELL

    ctx.save()
    ctx.translate(px + s / 2, py + s / 2)
    if (this.angle) ctx.rotate((this.angle * Math.PI) / 180)
    ctx.scale(this.flip_h ? -1 : 1, this.flip_v ? -1 : 1)
    if (img.kind === "color") {
      ctx.fillStyle = img.css
      ctx.fillRect(-s / 2, -s / 2, s, s)
    } else {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img.el, -s / 2, -s / 2, s, s)
    }
    ctx.restore()
  }
}

export class Text {
  _engine: Coccoon
  text: string
  _width: number
  _height: number
  _x: number
  _y: number
  fontSize: number
  fontColor: Color
  bgColor: Color

  constructor(
    engine: Coccoon,
    text: string,
    width: number,
    height: number,
    x = 0,
    y = 0,
    fontSize = 16,
    fontColor: Color = Colors.BLACK,
    backgroundColor: Color = Colors.WHITE,
  ) {
    this._engine = engine
    this.text = text
    this._width = width
    this._height = height
    this._x = x
    this._y = y
    this.fontSize = fontSize
    this.fontColor = fontColor
    this.bgColor = backgroundColor
    engine._texts.push(this)
  }

  set x(v: number) {
    this._x = v
  }
  set y(v: number) {
    this._y = v
  }

  set_font_color(c: Color): void {
    this.fontColor = c
  }
  set_background_color(c: Color): void {
    this.bgColor = c
  }
  set_border_color(_c: Color): void {
    // not implemented, matching the original engine
  }

  _draw(ctx: CanvasRenderingContext2D): void {
    const px = this._x * CELL
    const py = (GRID_H - this._y - this._height) * CELL
    const w = this._width * CELL
    const h = this._height * CELL

    ctx.fillStyle = toCss(this.bgColor)
    ctx.fillRect(px, py, w, h)

    if (this.fontColor.a <= 0 || !this.text) return
    ctx.fillStyle = toCss(this.fontColor)
    ctx.font = `${this.fontSize}px "Press Start 2P", ui-monospace, monospace`
    ctx.textBaseline = "top"

    const lineHeight = this.fontSize * 1.35
    const pad = 6
    let cursorY = py + pad
    const maxWidth = w - pad * 2

    for (const rawLine of this.text.split("\n")) {
      // word-wrap each logical line to the text box width
      const words = rawLine.split(" ")
      let line = ""
      for (const word of words) {
        const test = line ? line + " " + word : word
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(line, px + pad, cursorY)
          cursorY += lineHeight
          line = word
        } else {
          line = test
        }
      }
      ctx.fillText(line, px + pad, cursorY)
      cursorY += lineHeight
    }
  }
}

export class ImageList {
  _entries: ImageEntry[]
  constructor(engine: Coccoon, entries: ImageEntry[]) {
    // Creating a new ImageList clears any existing game sprites, like the
    // original engine's _clear_game_nodes().
    engine._clearGameNodes()
    this._entries = entries
    engine._loadImages(entries)
  }
}

export class Coccoon {
  _canvas: HTMLCanvasElement
  _ctx: CanvasRenderingContext2D
  _images: LoadedImage[] = []
  _sprites: Sprite[] = []
  _texts: Text[] = []
  _inputState: InputState = { key_presses: [], clicks: [] }
  // Keys that have been surfaced by at least one update() since being pressed.
  _readSincePress = new Set<number>()
  // Keys released before any update() observed them; removal is deferred so a
  // fast tap (keydown+keyup within one frame) is still visible for one frame.
  _pendingRelease = new Set<number>()
  _game: Game | null = null
  _raf = 0
  _lastTime = 0
  _accum = 0
  _running = false
  onEscape: (() => void) | null = null

  private _keyDown = (e: KeyboardEvent) => {
    const codeKey = e.code
    if (!(codeKey in KEY_MAP)) return
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault()
    const code = KEY_MAP[codeKey]
    if (code === -1) {
      if (this.onEscape) this.onEscape()
      return
    }
    this._pendingRelease.delete(code)
    if (!this._inputState.key_presses.includes(code)) {
      this._inputState.key_presses.push(code)
      this._readSincePress.delete(code)
    }
  }

  private _keyUp = (e: KeyboardEvent) => {
    const codeKey = e.code
    if (!(codeKey in KEY_MAP)) return
    const code = KEY_MAP[codeKey]
    if (this._readSincePress.has(code)) {
      this._removeKey(code)
    } else {
      // Not yet observed by a frame — keep it one more update() then drop it.
      this._pendingRelease.add(code)
    }
  }

  private _removeKey(code: number): void {
    const idx = this._inputState.key_presses.indexOf(code)
    if (idx !== -1) this._inputState.key_presses.splice(idx, 1)
    this._readSincePress.delete(code)
    this._pendingRelease.delete(code)
  }

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas
    canvas.width = GRID_W * CELL
    canvas.height = GRID_H * CELL
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("2D canvas context unavailable")
    this._ctx = ctx
  }

  // ImageList replacements clear existing sprites/texts.
  _clearGameNodes(): void {
    this._sprites = []
    this._texts = []
  }

  _loadImages(entries: ImageEntry[]): void {
    this._images = entries.map((entry) => {
      if (typeof entry === "string") {
        const el = new Image()
        el.crossOrigin = "anonymous"
        el.src = entry
        return { kind: "image", el } as LoadedImage
      }
      return { kind: "color", css: toCss(entry) } as LoadedImage
    })
  }

  // Mirrors coccoon.update(): the current input state, once per frame.
  update(): InputState {
    const snapshot: InputState = {
      key_presses: this._inputState.key_presses.slice(),
      clicks: this._inputState.clicks.slice(),
    }
    // Mark every currently-held key as observed by this frame.
    for (const code of snapshot.key_presses) this._readSincePress.add(code)
    // Drop keys that were released before being observed, now that this frame
    // has seen them once.
    for (const code of Array.from(this._pendingRelease)) this._removeKey(code)
    return snapshot
  }

  start(game: Game): void {
    this._game = game
    game.ready(this)
    this._running = true
    this._lastTime = performance.now()
    this._accum = 0
    window.addEventListener("keydown", this._keyDown)
    window.addEventListener("keyup", this._keyUp)
    const loop = (now: number) => {
      if (!this._running) return
      const delta = (now - this._lastTime) / 1000
      this._lastTime = now
      this._accum += delta
      const step = 1 / FPS
      // Fixed-timestep update to mirror Godot's capped max_fps.
      let ran = false
      while (this._accum >= step) {
        this._game?.process(step, this)
        this._accum -= step
        ran = true
      }
      if (ran) this._render()
      this._raf = requestAnimationFrame(loop)
    }
    this._render()
    this._raf = requestAnimationFrame(loop)
  }

  stop(): void {
    this._running = false
    cancelAnimationFrame(this._raf)
    window.removeEventListener("keydown", this._keyDown)
    window.removeEventListener("keyup", this._keyUp)
  }

  _render(): void {
    const ctx = this._ctx
    ctx.fillStyle = "#000000"
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height)
    // Sprites sorted by z (stable), then texts on top.
    const ordered = this._sprites
      .map((s, i) => ({ s, i }))
      .sort((a, b) => (a.s.z === b.s.z ? a.i - b.i : a.s.z - b.s.z))
    for (const { s } of ordered) s._draw(ctx)
    for (const t of this._texts) t._draw(ctx)
  }
}
