// ============================================================================
// CELESTE (Quantum Remix) — a coccoon port of Celeste Classic.
// ============================================================================
//
// Web port of games/celeste/celeste.gd from the coccoon repo, itself a port of
// the Pico-8 original by Maddy Thorson & Noel Berry. The game logic (player
// physics, dashing, hair, rooms, entities) is translated verbatim from the
// GDScript; only the engine calls are adapted to coccoon's TypeScript API.
//
// The "quantum remix" is visual: every solid tile has three sprite variants
// (original / pair / single) generated with Moth's TESSA tool, and tiles
// flicker between them — a nod to a qubit collapsing between measured states.
//
// The playfield is 16x16 Pico-8 tiles (8px each = 128x128 px) drawn into the
// 32x18 coccoon grid at offset (OX, OY), one cell per tile.

import { Coccoon, GRID_W, GRID_H, ImageList, Sprite, Text, color, Colors, type Game, type SheetTile } from "@/lib/coccoon"
import { CELESTE_MAP_FLAT, CELESTE_GFF } from "@/lib/games/celeste-data"

// ── Layout constants (from celeste.gd) ──────────────────────────────────────
const L = 16 // playfield size in tiles
const OX = 8 // grid x offset of the playfield
const OY = 1 // grid y offset of the playfield

// Input key codes as surfaced by coccoon.update(). The original mapped space/S
// to jump and A to dash; we keep S=jump and A=dash, and also accept the arrow /
// space defaults so the game is playable without memorising the letters.
const K_UP = 0
const K_RIGHT = 1
const K_DOWN = 2
const K_LEFT = 3
const K_SPACE = 4
const K_A = 6 // dash
const K_S = 7 // jump

// Image ids. 0..127 are the original sprite tiles; the block after that holds
// solid-colour helpers and the two flicker variant banks.
const IMG_CLEAR = 128
const IMG_BG = 129
const IMG_HAIR_DASH = 130 // red — dash available
const IMG_HAIR_NODASH = 131 // blue — dash spent
const IMG_TITLE = 132 // unused visually (title screen is a room + text)
const IMG_SNOW_W = 133
const IMG_SNOW_G = 134
const IMG_BLACK = 135
const PAIR_OFFSET = 136 // 136..263 — "pair" flicker variant of tile 0..127
const SINGLE_OFFSET = 264 // 264..391 — "single" flicker variant of tile 0..127

const MAX_DJUMP = 1
const SNOW_N = 25
const TAU = Math.PI * 2

// ── Small helpers matching GDScript built-ins ───────────────────────────────
const floori = (v: number) => Math.floor(v)
const fmod = (a: number, b: number) => a % b
function appr(val: number, target: number, amount: number): number {
  return val < target ? Math.min(val + amount, target) : Math.max(val - amount, target)
}
function sgn(v: number): number {
  if (v > 0) return 1
  if (v < 0) return -1
  return 0
}

type Vec = { x: number; y: number }
type Hitbox = { x: number; y: number; w: number; h: number }

// A game object is a loosely-typed record, mirroring the GDScript Dictionary
// objects. Only the player uses the full field set; entities use a subset.
type GObj = Record<string, unknown>

export class Celeste implements Game {
  private _engine!: Coccoon

  private _tiles: Sprite[][] = [] // [cx][cy] background/tile sprites
  private _entitySprs: Sprite[] = []
  private _hairSprs: Sprite[] = []
  private _playerSpr!: Sprite
  private _titleText!: Text
  private _statusText!: Text

  private _snowSprs: Sprite[] = []
  private _snowX: number[] = []
  private _snowY: number[] = []
  private _snowSpd: number[] = []
  private _snowOff: number[] = []

  // Vector2i(cx,cy) -> canonical tile id (0..127) for tiles that can flicker.
  private _tileCanvas = new Map<string, number>()
  private _roomX = 0
  private _roomY = 0
  private _objects: GObj[] = []
  private _deaths = 0
  private _shake = 0
  private _freeze = 0
  private _hasDashed = false
  private _prevKeys: number[] = []
  private _willRestart = false
  private _delayRestart = 0
  private _title = true

  // ── Setup ─────────────────────────────────────────────────────────────────
  ready(engine: Coccoon): void {
    this._engine = engine

    const sheet = (src: string, i: number): SheetTile => ({
      src,
      sx: (i % 16) * 8,
      sy: Math.floor(i / 16) * 8,
      sw: 8,
      sh: 8,
    })

    const entries: (string | SheetTile | ReturnType<typeof color>)[] = []
    for (let i = 0; i < 128; i++) entries.push(sheet("/sprites/celeste-original.png", i)) // 0..127
    entries.push(color(0, 0, 0, 0)) // 128 IMG_CLEAR
    entries.push(color(0.05, 0.05, 0.15)) // 129 IMG_BG
    entries.push(color(1.0, 0.0, 0.302)) // 130 IMG_HAIR_DASH
    entries.push(color(0.161, 0.678, 1.0)) // 131 IMG_HAIR_NODASH
    entries.push(color(0, 0, 0, 0)) // 132 IMG_TITLE (unused)
    entries.push(Colors.WHITE) // 133 IMG_SNOW_W
    entries.push(color(0.53, 0.53, 0.53)) // 134 IMG_SNOW_G
    entries.push(Colors.BLACK) // 135 IMG_BLACK
    for (let i = 0; i < 128; i++) entries.push(sheet("/sprites/celeste-pair.png", i)) // 136..263
    for (let i = 0; i < 128; i++) entries.push(sheet("/sprites/celeste-single.png", i)) // 264..391
    new ImageList(engine, entries)

    // Background tile grid (one sprite per screen cell).
    for (let cx = 0; cx < GRID_W; cx++) {
      this._tiles[cx] = []
      for (let cy = 0; cy < GRID_H; cy++) {
        this._tiles[cx][cy] = new Sprite(engine, IMG_BG, cx, cy, 0)
      }
    }

    // Entity sprite pool, hair sprites, player sprite (drawn above tiles).
    for (let i = 0; i < 40; i++) this._entitySprs.push(new Sprite(engine, IMG_CLEAR, 0, 0, 1))
    for (let i = 0; i < 5; i++) this._hairSprs.push(new Sprite(engine, IMG_CLEAR, 0, 0, 2, 0.125))
    this._playerSpr = new Sprite(engine, IMG_CLEAR, 0, 0, 3)

    this._statusText = new Text(engine, "", GRID_W, 1, 0, 0, 16, Colors.WHITE, color(0.05, 0.05, 0.15))
    this._titleText = new Text(engine, "", 28, 7, 2, 0, 20, color(0, 0, 0, 0), color(0, 0, 0, 0))

    this._initSnow()
    this._showTitle()
  }

  // ── Title screen ────────────────────────────────────────────────────────────
  private _showTitle(): void {
    this._loadRoom(7, 3)
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        if (this._tiles[cx][cy].image_id === IMG_BG) this._tiles[cx][cy].image_id = IMG_BLACK
      }
    }
    this._titleText.text =
      "CELESTE — quantum remix\n\n" +
      "arrows: move   S: jump   A: dash\n\n" +
      "Original by Maddy Thorson & Noel Berry\n\n" +
      "press S or A to begin"
    this._titleText.set_font_color(color(0.7, 0.72, 0.82))
  }

  private _hideTitle(): void {
    this._titleText.set_font_color(color(0, 0, 0, 0))
    for (const s of this._snowSprs) s.image_id = IMG_CLEAR
    this._title = false
    this._loadRoom(0, 0)
  }

  // ── Snow particles (title screen ambience) ──────────────────────────────────
  private _initSnow(): void {
    for (let i = 0; i < SNOW_N; i++) {
      const spd = 0.25 + Math.random() * 5.0
      const off = Math.random()
      const s = floori((Math.random() * 5.0) / 4.0)
      const col = Math.random() > 0.5 ? IMG_SNOW_W : IMG_SNOW_G
      const sz = s === 0 ? 0.25 : 0.5
      this._snowX.push(Math.random() * 32.0)
      this._snowY.push(Math.random() * 18.0)
      this._snowSpd.push(spd)
      this._snowOff.push(off)
      this._snowSprs.push(new Sprite(this._engine, col, this._snowX[i], this._snowY[i], 101, sz))
    }
  }

  private _updateSnow(): void {
    for (let i = 0; i < SNOW_N; i++) {
      this._snowX[i] += this._snowSpd[i] * 0.25
      this._snowY[i] += -Math.sin(this._snowOff[i] * TAU) * 0.25
      this._snowOff[i] += Math.min(0.05, this._snowSpd[i] / 32.0)
      if (this._snowX[i] > 32.0 + 0.1) {
        this._snowX[i] = -0.1
        this._snowY[i] = Math.random() * 18.0
      }
      this._snowSprs[i].x = this._snowX[i]
      this._snowSprs[i].y = this._snowY[i]
    }
  }

  // ── Map helpers ─────────────────────────────────────────────────────────────
  private _tileAt(tx: number, ty: number): number {
    const mapX = this._roomX * 16 + tx
    const mapY = this._roomY * 16 + ty
    if (mapX < 0 || mapX >= 128 || mapY < 0 || mapY >= 64) return 0
    return CELESTE_MAP_FLAT[mapY * 128 + mapX]
  }

  private _fget(tile: number, flag: number): boolean {
    if (tile < 0 || tile >= 128) return false
    return (CELESTE_GFF[tile] & flag) !== 0
  }

  private _solidAt(x: number, y: number, w: number, h: number): boolean {
    const x0 = floori(x / 8)
    const y0 = floori(y / 8)
    const x1 = floori((x + w - 1) / 8)
    const y1 = floori((y + h - 1) / 8)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this._fget(this._tileAt(tx, ty), 1)) return true
      }
    }
    for (const obj of this._objects) {
      const ot = (obj["_type"] as string) ?? ""
      const eox = (obj["x"] as number) ?? 0
      const eoy = (obj["y"] as number) ?? 0
      if (ot === "fall_floor" && obj["_solid"] && !obj["_broken"]) {
        if (x + w > eox && x < eox + 8 && y + h > eoy && y < eoy + 8) return true
      }
      if (ot === "platform") {
        if (x + w > eox && x < eox + 16 && y + h > eoy && y < eoy + 4) return true
      }
    }
    return false
  }

  private _iceAt(x: number, y: number, w: number, h: number): boolean {
    const x0 = floori(x / 8)
    const y0 = floori(y / 8)
    const x1 = floori((x + w - 1) / 8)
    const y1 = floori((y + h - 1) / 8)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this._fget(this._tileAt(tx, ty), 16)) return true
      }
    }
    return false
  }

  private _spikesAt(x: number, y: number, w: number, h: number, xspd: number, yspd: number): boolean {
    const x0 = floori(x / 8)
    const y0 = floori(y / 8)
    const x1 = floori((x + w - 1) / 8)
    const y1 = floori((y + h - 1) / 8)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const tile = this._tileAt(tx, ty)
        if (tile === 17) {
          if (yspd >= 0 && fmod(y + h - 1, 8) >= 6) return true
        } else if (tile === 27) {
          if (yspd <= 0 && fmod(y, 8) <= 2) return true
        } else if (tile === 43) {
          if (xspd <= 0 && fmod(x, 8) <= 2) return true
        } else if (tile === 59) {
          if (xspd >= 0 && fmod(x + w - 1, 8) >= 6) return true
        }
      }
    }
    return false
  }

  // ── Player collision helpers ────────────────────────────────────────────────
  private _playerIsSolid(p: GObj, ox: number, oy: number): boolean {
    const hb = p["hitbox"] as Hitbox
    const hx = (p["x"] as number) + hb.x + ox
    const hy = (p["y"] as number) + hb.y + oy
    if (hx < 0 || hx + hb.w > 128) return true
    return this._solidAt(hx, hy, hb.w, hb.h)
  }

  private _playerIsIce(p: GObj, ox: number, oy: number): boolean {
    const hb = p["hitbox"] as Hitbox
    return this._iceAt((p["x"] as number) + hb.x + ox, (p["y"] as number) + hb.y + oy, hb.w, hb.h)
  }

  // ── Spawning ──────────────────────────────────────────────────────────────
  private _spawnPlayer(x: number, y: number): void {
    this._objects.push({
      _type: "player",
      x,
      y,
      spd: { x: 0, y: 0 } as Vec,
      rem: { x: 0, y: 0 } as Vec,
      hitbox: { x: 1, y: 3, w: 6, h: 5 } as Hitbox,
      flip_x: false,
      grace: 0,
      jbuffer: 0,
      djump: MAX_DJUMP,
      dash_time: 0,
      dash_effect_time: 0,
      dash_target: { x: 0, y: 0 } as Vec,
      dash_accel: { x: 0, y: 0 } as Vec,
      p_jump: false,
      p_dash: false,
      spr_off: 0,
      spr: 1,
      hair: [
        [x + 4, y + 3],
        [x + 4, y + 3],
        [x + 4, y + 3],
        [x + 4, y + 3],
        [x + 4, y + 3],
      ],
    })
  }

  private _spawnSpring(x: number, y: number): void {
    this._objects.push({ _type: "spring", x, y, timer: 0 })
  }
  private _spawnFallFloor(x: number, y: number): void {
    this._objects.push({ _type: "fall_floor", x, y, _solid: true, _broken: false, _state: 0, _timer: 0 })
  }
  private _spawnFruit(x: number, y: number): void {
    this._objects.push({ _type: "fruit", x, y, _collected: false, _off: Math.random() * TAU })
  }
  private _spawnPlatform(x: number, y: number, dir: number): void {
    this._objects.push({ _type: "platform", x, y, _dir: dir, _off: 0 })
  }

  // ── Room management ─────────────────────────────────────────────────────────
  private _loadRoom(rx: number, ry: number): void {
    this._roomX = rx
    this._roomY = ry
    this._hasDashed = false
    this._objects = []
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 16; ty++) {
        const tile = this._tileAt(tx, ty)
        switch (tile) {
          case 1:
            this._spawnPlayer(tx * 8, ty * 8)
            break
          case 18:
            this._spawnSpring(tx * 8, ty * 8)
            break
          case 23:
            this._spawnFallFloor(tx * 8, ty * 8)
            break
          case 26:
            this._spawnFruit(tx * 8, ty * 8)
            break
          case 11:
            this._spawnPlatform(tx * 8, ty * 8, -1)
            break
          case 12:
            this._spawnPlatform(tx * 8, ty * 8, 1)
            break
        }
      }
    }
    this._render()
  }

  private _nextRoom(): void {
    if (this._roomX === 7) this._loadRoom(0, this._roomY + 1)
    else this._loadRoom(this._roomX + 1, this._roomY)
  }

  // ── Death ───────────────────────────────────────────────────────────────────
  private _killPlayer(): void {
    this._deaths += 1
    this._shake = 10
    this._willRestart = true
    this._delayRestart = 15
    this._playerSpr.image_id = IMG_CLEAR
  }

  // ── Player movement ─────────────────────────────────────────────────────────
  private _playerMoveX(p: GObj, amount: number): void {
    const step = sgn(amount)
    for (let i = 0; i < Math.abs(amount) + 1; i++) {
      if (!this._playerIsSolid(p, step, 0)) {
        p["x"] = (p["x"] as number) + step
      } else {
        ;(p["spd"] as Vec).x = 0
        ;(p["rem"] as Vec).x = 0
        break
      }
    }
  }

  private _playerMoveY(p: GObj, amount: number): void {
    const step = sgn(amount)
    for (let i = 0; i < Math.abs(amount) + 1; i++) {
      if (!this._playerIsSolid(p, 0, step)) {
        p["y"] = (p["y"] as number) + step
      } else {
        ;(p["spd"] as Vec).y = 0
        ;(p["rem"] as Vec).y = 0
        break
      }
    }
  }

  private _playerMove(p: GObj, ox: number, oy: number): void {
    const rem = p["rem"] as Vec
    rem.x += ox
    const ax = floori(rem.x + 0.5)
    rem.x -= ax
    this._playerMoveX(p, ax)

    rem.y += oy
    const ay = floori(rem.y + 0.5)
    rem.y -= ay
    this._playerMoveY(p, ay)
  }

  // ── Player update ─────────────────────────────────────────────────────────
  private _updatePlayer(p: GObj, keys: number[]): void {
    const has = (k: number) => keys.includes(k)
    const spd = p["spd"] as Vec
    const hb = p["hitbox"] as Hitbox

    let input = 0
    if (has(K_RIGHT)) input = 1
    else if (has(K_LEFT)) input = -1

    if (this._spikesAt((p["x"] as number) + hb.x, (p["y"] as number) + hb.y, hb.w, hb.h, spd.x, spd.y)) {
      this._killPlayer()
      return
    }
    if ((p["y"] as number) + hb.y + hb.h >= 128) {
      this._killPlayer()
      return
    }

    const onGround = this._playerIsSolid(p, 0, 1)
    const onIce = this._playerIsIce(p, 0, 1)

    const jumpBtn = has(K_S) || has(K_SPACE)
    const jump = jumpBtn && !p["p_jump"]
    p["p_jump"] = jumpBtn
    if (jump) p["jbuffer"] = 4
    else if ((p["jbuffer"] as number) > 0) p["jbuffer"] = (p["jbuffer"] as number) - 1

    const dashBtn = has(K_A)
    const dash = dashBtn && !p["p_dash"]
    p["p_dash"] = dashBtn

    if (onGround) {
      p["grace"] = 6
      if ((p["djump"] as number) < MAX_DJUMP) p["djump"] = MAX_DJUMP
    } else if ((p["grace"] as number) > 0) {
      p["grace"] = (p["grace"] as number) - 1
    }

    p["dash_effect_time"] = (p["dash_effect_time"] as number) - 1

    if ((p["dash_time"] as number) > 0) {
      p["dash_time"] = (p["dash_time"] as number) - 1
      const dt = p["dash_target"] as Vec
      const da = p["dash_accel"] as Vec
      spd.x = appr(spd.x, dt.x, da.x)
      spd.y = appr(spd.y, dt.y, da.y)
    } else {
      const maxrun = 1.0
      let accel = 0.6
      const deccel = 0.15

      if (!onGround) accel = 0.4
      else if (onIce) accel = 0.05

      if (Math.abs(spd.x) > maxrun) spd.x = appr(spd.x, sgn(spd.x) * maxrun, deccel)
      else spd.x = appr(spd.x, input * maxrun, accel)

      if (spd.x !== 0) p["flip_x"] = spd.x < 0

      let maxfall = 2.0
      let gravity = 0.21
      if (Math.abs(spd.y) <= 0.15) gravity *= 0.5
      if (input !== 0 && this._playerIsSolid(p, input, 0) && !this._playerIsIce(p, input, 0)) maxfall = 0.4
      if (!onGround) spd.y = appr(spd.y, maxfall, gravity)

      if ((p["jbuffer"] as number) > 0) {
        if ((p["grace"] as number) > 0) {
          p["jbuffer"] = 0
          p["grace"] = 0
          spd.y = -2.0
        } else {
          let wallDir = 0
          if (this._playerIsSolid(p, -3, 0)) wallDir = -1
          else if (this._playerIsSolid(p, 3, 0)) wallDir = 1
          if (wallDir !== 0) {
            p["jbuffer"] = 0
            spd.y = -2.0
            spd.x = -wallDir * (maxrun + 1.0)
          }
        }
      }

      const dFull = 5.0
      const dHalf = dFull * 0.70710678118

      if ((p["djump"] as number) > 0 && dash) {
        p["djump"] = (p["djump"] as number) - 1
        p["dash_time"] = 4
        p["dash_effect_time"] = 10
        this._hasDashed = true

        let vInput = 0
        if (has(K_UP)) vInput = -1
        else if (has(K_DOWN)) vInput = 1

        if (input !== 0) {
          if (vInput !== 0) {
            spd.x = input * dHalf
            spd.y = vInput * dHalf
          } else {
            spd.x = input * dFull
            spd.y = 0
          }
        } else if (vInput !== 0) {
          spd.x = 0
          spd.y = vInput * dFull
        } else {
          spd.x = p["flip_x"] ? -1 : 1
          spd.y = 0
        }

        this._freeze = 2
        this._shake = 6
        const dt = p["dash_target"] as Vec
        const da = p["dash_accel"] as Vec
        dt.x = 2.0 * sgn(spd.x)
        dt.y = 2.0 * sgn(spd.y)
        da.x = 1.5
        da.y = 1.5
        if (spd.y < 0) dt.y *= 0.75
        if (spd.y !== 0) da.x *= 0.70710678118
        if (spd.x !== 0) da.y *= 0.70710678118
      }
    }

    // animation
    p["spr_off"] = (p["spr_off"] as number) + 0.25
    if (!onGround) {
      p["spr"] = this._playerIsSolid(p, input, 0) ? 5 : 3
    } else if (has(K_DOWN)) {
      p["spr"] = 6
    } else if (has(K_UP)) {
      p["spr"] = 7
    } else if (spd.x === 0) {
      p["spr"] = 1
    } else {
      p["spr"] = 1 + (Math.floor(p["spr_off"] as number) % 4)
    }

    this._playerMove(p, spd.x, spd.y)
    this._updateHair(p)

    if ((p["y"] as number) < -4 && this._roomY * 16 + this._roomX < 30) this._nextRoom()
  }

  private _updateHair(p: GObj): void {
    const facing = p["flip_x"] ? -1 : 1
    const hx = (p["x"] as number) + 4 - facing * 2
    const hy = (p["y"] as number) + 3
    const hair = p["hair"] as number[][]
    for (let i = 0; i < 5; i++) {
      const tx = i === 0 ? hx : hair[i - 1][0]
      const ty = i === 0 ? hy : hair[i - 1][1] - 2
      hair[i][0] += (tx - hair[i][0]) / 1.5
      hair[i][1] += (ty - hair[i][1]) / 1.5
    }
  }

  // ── Entity updates ──────────────────────────────────────────────────────────
  private _players(): GObj[] {
    return this._objects.filter((o) => o["_type"] === "player")
  }

  private _updateSpring(obj: GObj): void {
    if ((obj["timer"] as number) > 0) {
      obj["timer"] = (obj["timer"] as number) - 1
      return
    }
    for (const p of this._players()) {
      const hb = p["hitbox"] as Hitbox
      const px = (p["x"] as number) + hb.x
      const py = (p["y"] as number) + hb.y
      if (
        px + hb.w > (obj["x"] as number) &&
        px < (obj["x"] as number) + 8 &&
        py + hb.h > (obj["y"] as number) &&
        py < (obj["y"] as number) + 8
      ) {
        const spd = p["spd"] as Vec
        if (spd.y >= 0) {
          spd.y = -3.0
          p["djump"] = MAX_DJUMP
          obj["timer"] = 10
        }
      }
    }
  }

  private _updateFallFloor(obj: GObj): void {
    if (obj["_state"] === 0) {
      for (const p of this._players()) {
        const hb = p["hitbox"] as Hitbox
        const px = (p["x"] as number) + hb.x
        const py = (p["y"] as number) + hb.y
        if (
          px + hb.w > (obj["x"] as number) &&
          px < (obj["x"] as number) + 8 &&
          py + hb.h >= (obj["y"] as number) &&
          py < (obj["y"] as number) + 4
        ) {
          obj["_state"] = 1
          obj["_timer"] = 15
        }
      }
    } else if (obj["_state"] === 1) {
      obj["_timer"] = (obj["_timer"] as number) - 1
      if ((obj["_timer"] as number) <= 0) {
        obj["_state"] = 2
        obj["_solid"] = false
        obj["_broken"] = true
        obj["_timer"] = 60
      }
    } else if (obj["_state"] === 2) {
      obj["_timer"] = (obj["_timer"] as number) - 1
      if ((obj["_timer"] as number) <= 0) {
        obj["_state"] = 0
        obj["_solid"] = true
        obj["_broken"] = false
      }
    }
  }

  private _updateFruit(obj: GObj): void {
    if (obj["_collected"]) return
    obj["_off"] = (obj["_off"] as number) + 0.05
    for (const p of this._players()) {
      const hb = p["hitbox"] as Hitbox
      const px = (p["x"] as number) + hb.x
      const py = (p["y"] as number) + hb.y
      if (
        px + hb.w > (obj["x"] as number) &&
        px < (obj["x"] as number) + 8 &&
        py + hb.h > (obj["y"] as number) &&
        py < (obj["y"] as number) + 8
      ) {
        obj["_collected"] = true
        p["djump"] = MAX_DJUMP
      }
    }
  }

  private _updatePlatform(obj: GObj): void {
    obj["_off"] = (obj["_off"] as number) + 0.65
    obj["x"] = (obj["x"] as number) + (obj["_dir"] as number) * 0.65
    if ((obj["x"] as number) < -16) obj["x"] = 128
    else if ((obj["x"] as number) > 128) obj["x"] = -16
    for (const p of this._players()) {
      const hb = p["hitbox"] as Hitbox
      const px = (p["x"] as number) + hb.x
      const py = (p["y"] as number) + hb.y
      if (
        px + hb.w > (obj["x"] as number) &&
        px < (obj["x"] as number) + 16 &&
        py + hb.h >= (obj["y"] as number) &&
        py < (obj["y"] as number) + 4
      ) {
        p["x"] = Math.max(-1, Math.min(121, (p["x"] as number) + (obj["_dir"] as number) * 0.65))
      }
    }
  }

  // ── Sprite placement + render ───────────────────────────────────────────────
  private _placeSpr(spr: Sprite, px8x: number, px8y: number, img: number, flipH = false): void {
    spr.image_id = img
    spr.x = OX + px8x / 8
    spr.y = OY + (L - 1) - px8y / 8
    spr.flip_h = flipH
  }

  private _renderTiles(): void {
    for (let cx = 0; cx < GRID_W; cx++) {
      for (let cy = 0; cy < GRID_H; cy++) this._tiles[cx][cy].image_id = IMG_BG
    }
    this._tileCanvas.clear()
    for (let tx = 0; tx < 16; tx++) {
      for (let ty = 0; ty < 16; ty++) {
        const tile = this._tileAt(tx, ty)
        const cx = OX + tx
        const cy = OY + L - 1 - ty
        let imgId: number
        if (tile === 0) {
          imgId = IMG_BG
        } else if (tile >= 128 || [1, 11, 12, 18, 23, 26].includes(tile)) {
          imgId = IMG_CLEAR
        } else {
          imgId = tile
          this._tileCanvas.set(`${cx},${cy}`, tile)
        }
        this._tiles[cx][cy].image_id = imgId
      }
    }
  }

  private _renderEntities(): void {
    for (const spr of this._entitySprs) spr.image_id = IMG_CLEAR
    for (const spr of this._hairSprs) spr.image_id = IMG_CLEAR

    let sprIdx = 0
    for (const obj of this._objects) {
      if (sprIdx >= this._entitySprs.length) break
      switch (obj["_type"]) {
        case "spring":
          this._placeSpr(this._entitySprs[sprIdx], obj["x"] as number, obj["y"] as number, 18)
          sprIdx++
          break
        case "fall_floor":
          if (!obj["_broken"]) {
            this._placeSpr(this._entitySprs[sprIdx], obj["x"] as number, obj["y"] as number, 23)
            sprIdx++
          }
          break
        case "fruit":
          if (!obj["_collected"]) {
            const bobY = (obj["y"] as number) + Math.sin(obj["_off"] as number) * 2.0
            this._placeSpr(this._entitySprs[sprIdx], obj["x"] as number, bobY, 26)
            sprIdx++
          }
          break
        case "platform":
          this._placeSpr(this._entitySprs[sprIdx], obj["x"] as number, obj["y"] as number, 11)
          sprIdx++
          break
      }
    }

    let playerDrawn = false
    for (const obj of this._objects) {
      if (obj["_type"] !== "player") continue
      const hairImg = (obj["djump"] as number) > 0 ? IMG_HAIR_DASH : IMG_HAIR_NODASH
      const hair = obj["hair"] as number[][]
      for (let i = 0; i < 5; i++) {
        const hi = 4 - i // draw tip (big) first, head (small) last
        const sz = (hi + 1) / 8
        const seg = hair[hi]
        this._hairSprs[i].size = sz
        this._hairSprs[i].image_id = hairImg
        this._hairSprs[i].x = OX + seg[0] / 8 - sz / 2
        this._hairSprs[i].y = OY + (L - 1) - seg[1] / 8 - sz / 2
      }
      this._placeSpr(this._playerSpr, obj["x"] as number, obj["y"] as number, obj["spr"] as number, obj["flip_x"] as boolean)
      playerDrawn = true
      break
    }
    if (!playerDrawn) this._playerSpr.image_id = IMG_CLEAR

    this._statusText.text = "deaths: " + this._deaths
  }

  private _render(): void {
    this._renderTiles()
    this._renderEntities()
  }

  // Quantum flicker: each canvas tile occasionally jumps to one of its variant
  // banks (pair / single), evoking a measured qubit flickering between states.
  private _flickerTiles(): void {
    for (const [key, base] of this._tileCanvas) {
      if (Math.random() < 1 / 30) {
        const [cx, cy] = key.split(",").map(Number)
        const bank = [0, PAIR_OFFSET, SINGLE_OFFSET][Math.floor(Math.random() * 3)]
        this._tiles[cx][cy].image_id = base + bank
      }
    }
  }

  // ── Per-frame ──────────────────────────────────────────────────────────────
  process(_delta: number, engine: Coccoon): void {
    const inp = engine.update()
    const keys = inp.key_presses
    const justPressed = keys.filter((k) => !this._prevKeys.includes(k))
    this._prevKeys = keys.slice()

    if (this._title) {
      this._updateSnow()
      this._flickerTiles()
      if (justPressed.includes(K_A) || justPressed.includes(K_S) || justPressed.includes(K_SPACE)) this._hideTitle()
      return
    }

    if (this._willRestart) {
      this._delayRestart -= 1
      if (this._delayRestart <= 0) {
        this._willRestart = false
        this._loadRoom(this._roomX, this._roomY)
      }
      return
    }

    if (this._freeze > 0) {
      this._freeze -= 1
      return
    }
    if (this._shake > 0) this._shake -= 1

    let dead = false
    for (const obj of this._objects) {
      if (obj["_type"] === "player") {
        this._updatePlayer(obj, keys)
        if (this._willRestart) {
          dead = true
          break
        }
      }
    }
    if (dead) {
      this._renderEntities()
      this._flickerTiles()
      return
    }

    for (const obj of this._objects) {
      switch (obj["_type"]) {
        case "spring":
          this._updateSpring(obj)
          break
        case "fall_floor":
          this._updateFallFloor(obj)
          break
        case "fruit":
          this._updateFruit(obj)
          break
        case "platform":
          this._updatePlatform(obj)
          break
      }
    }

    this._renderEntities()
    this._flickerTiles()
  }
}
