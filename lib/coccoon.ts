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

// Key codes surfaced by update(). WASD mirrors the arrow keys as a synonymous
// d-pad (up/right/down/left = 0/1/2/3), IJKL are the four face buttons
// (5/6/7/8), and Space/Enter (4) is start. Both arrow and WASD keys produce the same
// direction codes, so games only ever read the direction, never which key.
const KEY_MAP: Record<string, number> = {
  ArrowUp: 0,
  ArrowRight: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  KeyW: 0,
  KeyD: 1,
  KeyS: 2,
  KeyA: 3,
  Space: 4,
  Enter: 4,
  KeyI: 5,
  KeyJ: 6,
  KeyK: 7,
  KeyL: 8,
  Escape: -1,
}

// A tile carved out of a larger spritesheet: one shared image element, drawn
// from a source rectangle. Lets a game register hundreds of 8x8 sprites that
// all live in a single PNG instead of hundreds of separate files.
export type SheetTile = { src: string; sx: number; sy: number; sw: number; sh: number }
type ImageEntry = string | Color | SheetTile
type LoadedImage =
  | { kind: "image"; el: HTMLImageElement }
  | { kind: "color"; css: string }
  | { kind: "tile"; el: HTMLImageElement; sx: number; sy: number; sw: number; sh: number }

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
    } else if (img.kind === "tile") {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img.el, img.sx, img.sy, img.sw, img.sh, -s / 2, -s / 2, s, s)
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

// ---- Uploaded assets -----------------------------------------------------
// A cartridge is a single text file, so it can't embed binary PNGs or WAVs.
// Instead, files uploaded in the create editor are registered here by filename
// and resolved to a runtime URL (a blob URL in the browser). `asset("hero.png")`
// returns that URL, ready to hand to ImageList or SoundList. The create page
// repopulates this registry before each run.
const _assetRegistry = new Map<string, string>()

export function registerAsset(name: string, url: string): void {
  _assetRegistry.set(name, url)
}

export function clearAssets(): void {
  _assetRegistry.clear()
}

export function asset(name: string): string {
  const url = _assetRegistry.get(name)
  if (!url) {
    const known = [..._assetRegistry.keys()]
    throw new Error(
      `No uploaded asset named "${name}".` +
        (known.length
          ? ` Available: ${known.join(", ")}.`
          : " Upload a PNG or WAV in the editor first, then reference it by filename."),
    )
  }
  return url
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

// ---- Audio ---------------------------------------------------------------
// Mirrors the SoundList + Sound model of qisge (the engine coccoon was ported
// from). SoundList registers audio clips by URL, exactly like ImageList
// registers images. A Sound is a playback channel: set its playmode to start
// or stop it, and volume/pitch/note update live while it plays. Web Audio
// backs it here where Godot used AudioStreamPlayer nodes.

// playmode values, matching qisge's Sound.playmode.
export const STOP = 0
export const PLAY = 1
export const LOOP = 2

type LoadedSound = {
  url: string
  buffer: AudioBuffer | null
  // Channels that asked to play before this clip finished decoding.
  pending: Set<Sound>
}

export class SoundList {
  _entries: string[]
  constructor(engine: Coccoon, entries: string[]) {
    // A fresh SoundList silences whatever was playing, like ImageList clears
    // the old sprites.
    engine._stopAllChannels()
    this._entries = entries
    engine._loadSounds(entries)
  }
}

export class Sound {
  _engine: Coccoon
  _soundId: number
  _playmode: number
  _volume: number
  _pitch: number
  _note: number
  _source: AudioBufferSourceNode | null = null
  _gain: GainNode | null = null

  constructor(engine: Coccoon, soundId: number, playmode = PLAY, volume = 1, pitch = 1, note = 0) {
    this._engine = engine
    this._soundId = soundId
    this._playmode = playmode
    this._volume = volume
    this._pitch = pitch
    this._note = note
    engine._channels.push(this)
    if (playmode !== STOP) this._begin()
  }

  get playmode(): number {
    return this._playmode
  }
  set playmode(v: number) {
    if (v === this._playmode) return
    this._playmode = v
    if (v === STOP) this._stopSource()
    else this._begin()
  }

  get volume(): number {
    return this._volume
  }
  set volume(v: number) {
    this._volume = v
    const ctx = this._engine._audioCtx
    if (this._gain && ctx) this._gain.gain.setValueAtTime(v, ctx.currentTime)
  }

  get pitch(): number {
    return this._pitch
  }
  set pitch(v: number) {
    this._pitch = v
    this._applyRate()
  }

  get note(): number {
    return this._note
  }
  set note(v: number) {
    this._note = v
    this._applyRate()
  }

  // note shifts pitch in equal-tempered semitones, on top of the pitch factor.
  private _rate(): number {
    return this._pitch * Math.pow(2, this._note / 12)
  }

  private _applyRate(): void {
    const ctx = this._engine._audioCtx
    if (this._source && ctx) this._source.playbackRate.setValueAtTime(this._rate(), ctx.currentTime)
  }

  private _begin(): void {
    const eng = this._engine
    const snd = eng._sounds[this._soundId]
    if (!snd) return
    eng._ensureAudio()
    if (!snd.buffer) {
      // Not decoded yet — start as soon as it is.
      snd.pending.add(this)
      return
    }
    this._playBuffer(snd.buffer)
  }

  // Called by the engine once a pending clip finishes decoding.
  _playBuffer(buffer: AudioBuffer): void {
    const eng = this._engine
    const ctx = eng._audioCtx
    if (!ctx || !eng._masterGain) return
    this._stopSource()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = this._playmode === LOOP
    src.playbackRate.value = this._rate()
    const gain = ctx.createGain()
    gain.gain.value = this._volume
    src.connect(gain)
    gain.connect(eng._masterGain)
    src.start()
    this._source = src
    this._gain = gain
    if (this._playmode === PLAY) {
      src.onended = () => {
        if (this._source === src) {
          this._source = null
          this._gain = null
          this._playmode = STOP
        }
      }
    }
  }

  _stopSource(): void {
    if (this._source) {
      try {
        this._source.onended = null
        this._source.stop()
      } catch {
        // already stopped
      }
      this._source.disconnect()
      this._source = null
    }
    if (this._gain) {
      this._gain.disconnect()
      this._gain = null
    }
    const snd = this._engine._sounds[this._soundId]
    if (snd) snd.pending.delete(this)
  }
}

export class Coccoon {
  _canvas: HTMLCanvasElement
  _ctx: CanvasRenderingContext2D
  _images: LoadedImage[] = []
  _sprites: Sprite[] = []
  _texts: Text[] = []
  _sounds: LoadedSound[] = []
  _channels: Sound[] = []
  _audioCtx: AudioContext | null = null
  _masterGain: GainNode | null = null
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
    // A keypress is a user gesture — unblock audio the browser held suspended.
    if (this._audioCtx && this._audioCtx.state === "suspended") void this._audioCtx.resume()
    if (e.code === "Space" || e.code === "Enter" || e.code.startsWith("Arrow")) e.preventDefault()
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

  // Codes currently held via gamepad, so releases can be synthesized when a
  // button/stick returns to neutral without disturbing keyboard-held codes.
  _padHeld = new Set<number>()

  // Poll connected gamepads once per frame and translate them into the same
  // codes the keyboard produces: d-pad + left stick -> 0..3, face buttons ->
  // 4 (A/bottom = start-equivalent, matches Space) and 5..8 (the four buttons),
  // Start/Back -> Escape. Standard-mapping layout (Xbox/PlayStation/etc).
  private _pollGamepad(): void {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return
    const pads = navigator.getGamepads()
    let pad: Gamepad | null = null
    for (const p of pads) {
      if (p && p.connected) {
        pad = p
        break
      }
    }
    const want = new Set<number>()
    if (pad) {
      const pressed = (i: number) => !!pad!.buttons[i]?.pressed
      const axis = (i: number) => pad!.axes[i] ?? 0
      const DEAD = 0.5
      // D-pad (standard buttons 12-15) + left stick.
      if (pressed(12) || axis(1) < -DEAD) want.add(0) // up
      if (pressed(15) || axis(0) > DEAD) want.add(1) // right
      if (pressed(13) || axis(1) > DEAD) want.add(2) // down
      if (pressed(14) || axis(0) < -DEAD) want.add(3) // left
      // Face buttons: A(0) bottom, B(1) right, X(2) left, Y(3) top.
      if (pressed(0)) {
        want.add(4) // A -> Space / start-equivalent
        want.add(6) // A also mirrors the "J" primary action button
      }
      if (pressed(2)) want.add(5) // X -> I
      if (pressed(1)) want.add(7) // B -> K
      if (pressed(3)) want.add(8) // Y -> L
      // Start(9) / Back(8) -> Escape.
      if (pressed(9) || pressed(8)) {
        if (this.onEscape && !this._padEscapeLatch) {
          this._padEscapeLatch = true
          this.onEscape()
        }
      } else {
        this._padEscapeLatch = false
      }
      // Any pad activity is a user gesture — unblock suspended audio.
      if (want.size > 0 && this._audioCtx && this._audioCtx.state === "suspended") void this._audioCtx.resume()
    }
    // Press newly-active codes.
    for (const code of want) {
      if (!this._padHeld.has(code)) {
        this._padHeld.add(code)
        this._pendingRelease.delete(code)
        if (!this._inputState.key_presses.includes(code)) {
          this._inputState.key_presses.push(code)
          this._readSincePress.delete(code)
        }
      }
    }
    // Release codes the pad no longer holds (unless the keyboard holds them too
    // — but keyboard/pad share codes, so mirror the keyup deferral logic).
    for (const code of Array.from(this._padHeld)) {
      if (!want.has(code)) {
        this._padHeld.delete(code)
        if (this._readSincePress.has(code)) this._removeKey(code)
        else this._pendingRelease.add(code)
      }
    }
  }

  _padEscapeLatch = false

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

  // Lazily create the AudioContext and (re)resume it. Browsers start it
  // suspended until a user gesture, so this is also called from _keyDown.
  _ensureAudio(): void {
    if (!this._audioCtx) {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this._audioCtx = new AC()
      this._masterGain = this._audioCtx.createGain()
      this._masterGain.gain.value = 1
      this._masterGain.connect(this._audioCtx.destination)
    }
    if (this._audioCtx.state === "suspended") void this._audioCtx.resume()
  }

  _loadSounds(entries: string[]): void {
    this._sounds = entries.map((url) => ({ url, buffer: null, pending: new Set<Sound>() }))
    this._sounds.forEach((snd) => {
      fetch(snd.url)
        .then((r) => r.arrayBuffer())
        .then((buf) => {
          this._ensureAudio()
          return this._audioCtx!.decodeAudioData(buf)
        })
        .then((decoded) => {
          snd.buffer = decoded
          // Fire any channels that were waiting on this clip to decode.
          for (const ch of Array.from(snd.pending)) {
            snd.pending.delete(ch)
            if (ch.playmode !== STOP) ch._playBuffer(decoded)
          }
        })
        .catch((err) => {
          console.log("[v0] coccoon sound load failed:", snd.url, err)
        })
    })
  }

  _stopAllChannels(): void {
    for (const ch of this._channels) ch._stopSource()
    this._channels = []
  }

  _loadImages(entries: ImageEntry[]): void {
    // Cache one HTMLImageElement per unique src so a spritesheet shared by many
    // tile entries is fetched and decoded only once.
    const cache = new Map<string, HTMLImageElement>()
    const load = (src: string): HTMLImageElement => {
      let el = cache.get(src)
      if (!el) {
        el = new Image()
        el.crossOrigin = "anonymous"
        el.src = src
        cache.set(src, el)
      }
      return el
    }
    this._images = entries.map((entry) => {
      if (typeof entry === "string") {
        return { kind: "image", el: load(entry) } as LoadedImage
      }
      if ("src" in entry) {
        return {
          kind: "tile",
          el: load(entry.src),
          sx: entry.sx,
          sy: entry.sy,
          sw: entry.sw,
          sh: entry.sh,
        } as LoadedImage
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
      // Poll gamepads once per frame before stepping the game.
      this._pollGamepad()
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
    this._stopAllChannels()
    if (this._audioCtx) {
      void this._audioCtx.close()
      this._audioCtx = null
      this._masterGain = null
    }
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
