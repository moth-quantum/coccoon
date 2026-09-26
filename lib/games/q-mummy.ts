import {
  Sprite,
  Text,
  ImageList,
  color,
  Colors,
  GRID_W,
  GRID_H,
  type Coccoon,
  type Game,
} from "@/lib/coccoon"

// ---- World / camera constants ----------------------------------------------
// The pyramid is bigger than the screen: a 12x10 room lattice (120 rooms,
// matching a real 120-qubit hardware run) scrolls under a fixed 32x17
// viewport - row GRID_H-1 stays reserved for the HUD - with the camera
// following the player.

const BLOCK_COLS = 12
const BLOCK_ROWS = 10
const BLOCK_W = 5
const BLOCK_H = 3
const ROOM_COUNT = BLOCK_COLS * BLOCK_ROWS

const WORLD_W = BLOCK_COLS * BLOCK_W + (BLOCK_COLS + 1) // 73
const WORLD_H = BLOCK_ROWS * BLOCK_H + (BLOCK_ROWS + 1) // 41
const WORLD_X0 = 0
const WORLD_Y0 = 0

const VIEW_W = GRID_W
const VIEW_H = GRID_H - 1 // row GRID_H-1 is the HUD, never scrolled

const COL = {
  BLOCK: 0,
  TREASURE: 1,
  KEY: 2,
  DOT: 3,
  PLAYER: 4,
  MUMMY: 5,
  LIFE_ICON: 6,
  GATE_LOCKED: 7,
  TREASURE_ICON: 8,
  KEY_ICON: 9,
  PATH: 10,
}

const MOVE_INTERVAL = 6 // frames between player steps while a direction is held
const RESPAWN_INVULN_FRAMES = 45
const LEVEL_CLEAR_FRAMES = 90
const MAX_LIFE_ICONS = 5

// Four room-merge layouts, each from a different individual measurement shot
// of the same real 120-qubit lattice run on IBM's ibm_fez QPU (via the Moth
// Quantum Labyrinth engine, labyrinth-v1): for each raw bitstring sample, the
// room-pairs whose bits agree in THAT shot are ranked by their known
// ZZ-correlation strength and the top 40 are fused into connected chambers -
// so every layout reflects a genuinely different real measurement outcome,
// not just a different cutoff on the same averaged statistic. Room index =
// row * 12 + col. Levels cycle through these as you clear them.
interface LevelLayout {
  mergePairs: [number, number][]
}
const LEVELS: LevelLayout[] = [
  {
    mergePairs: [
      [0, 1], [0, 12], [1, 2], [1, 13], [2, 14], [4, 5], [5, 6], [5, 17],
      [6, 7], [7, 8], [9, 21], [10, 11], [11, 23], [34, 35], [35, 47],
      [36, 37], [37, 49], [39, 51], [57, 58], [65, 77], [69, 70], [70, 71],
      [70, 82], [71, 83], [83, 95], [84, 96], [87, 99], [91, 103], [95, 107],
      [97, 109], [98, 99], [99, 100], [99, 111], [100, 101], [107, 119],
      [110, 111], [111, 112], [114, 115], [117, 118], [118, 119],
    ],
  },
  {
    mergePairs: [
      [0, 1], [0, 12], [1, 2], [1, 13], [2, 14], [4, 5], [4, 16], [6, 7],
      [8, 9], [8, 20], [9, 21], [11, 23], [18, 19], [19, 20], [22, 23],
      [24, 36], [35, 47], [36, 37], [36, 48], [46, 47], [47, 59], [53, 65],
      [58, 59], [60, 72], [70, 71], [70, 82], [72, 73], [84, 96], [91, 103],
      [92, 93], [93, 94], [94, 95], [99, 111], [103, 115], [110, 111],
      [111, 112], [115, 116], [116, 117], [117, 118], [118, 119],
    ],
  },
  {
    mergePairs: [
      [0, 12], [2, 14], [5, 6], [6, 7], [6, 18], [7, 8], [8, 9], [8, 20],
      [9, 21], [10, 22], [22, 23], [22, 34], [23, 35], [24, 36], [34, 35],
      [36, 37], [36, 48], [57, 58], [65, 66], [65, 77], [69, 70], [69, 81],
      [71, 83], [72, 73], [72, 84], [83, 95], [84, 85], [87, 99], [93, 94],
      [93, 105], [94, 95], [96, 108], [99, 111], [103, 115], [104, 105],
      [105, 117], [107, 119], [108, 109], [111, 112], [118, 119],
    ],
  },
  {
    mergePairs: [
      [4, 5], [4, 16], [6, 7], [6, 18], [8, 20], [10, 11], [10, 22], [17, 18],
      [19, 20], [19, 31], [22, 34], [24, 36], [34, 35], [36, 37], [37, 49],
      [39, 51], [45, 57], [47, 59], [53, 65], [57, 69], [60, 72], [64, 65],
      [65, 66], [65, 77], [70, 71], [70, 82], [72, 84], [83, 95], [84, 85],
      [87, 99], [91, 103], [92, 93], [93, 94], [94, 95], [100, 101],
      [103, 115], [104, 105], [108, 109], [109, 110], [112, 113],
    ],
  },
]

type GameState = "START" | "PLAYING" | "LEVELCLEAR" | "GAMEOVER"

interface WorldSprite {
  sprite: Sprite
  wx: number
  wy: number
}

interface BlockInfo {
  cells: { x: number; y: number }[]
  center: { x: number; y: number }
  spawnPoint: { x: number; y: number }
  ring: Set<string>
  visited: Set<string>
  claimed: boolean
  baseSprites: WorldSprite[]
  treasureSprites: WorldSprite[]
  keySprites: WorldSprite[]
  treasureIcon: WorldSprite
  keyIcon: WorldSprite
}

interface CellSpriteSet {
  base: WorldSprite
  treasure: WorldSprite
  key: WorldSprite
}

interface ConnectorGeom {
  a: number
  b: number
  cells: { x: number; y: number }[]
}

interface Mummy {
  x: number
  y: number
  homeX: number
  homeY: number
  sprite: WorldSprite
  moveTimer: number
}

function key(x: number, y: number): string {
  return x + "," + y
}

function parseKey(k: string): { x: number; y: number } {
  const [x, y] = k.split(",").map(Number)
  return { x, y }
}

function edgeKey(a: number, b: number): string {
  return Math.min(a, b) + "_" + Math.max(a, b)
}

function roomBase(index: number): { baseX: number; baseY: number } {
  const r = Math.floor(index / BLOCK_COLS)
  const c = index % BLOCK_COLS
  return { baseX: 1 + c * (BLOCK_W + 1), baseY: 1 + r * (BLOCK_H + 1) }
}

function computeRingGeneric(cellSet: Set<string>): Set<string> {
  const ring = new Set<string>()
  for (const k of cellSet) {
    const { x, y } = parseKey(k)
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const nk = key(nx, ny)
      if (!cellSet.has(nk)) ring.add(nk)
    }
  }
  return ring
}

export class QMummy implements Game {
  private _engine!: Coccoon

  private worldSprites: WorldSprite[] = []
  private camX = 0
  private camY = 0

  private cellBlockId!: number[][]
  private blocks: BlockInfo[] = []
  private keyBlockIndex = 0
  private hasKey = false

  private roomGeoms: { x: number; y: number }[][] = []
  private roomIcons: { treasure: WorldSprite; key: WorldSprite }[] = []
  private connectorGeoms: ConnectorGeom[] = []
  private connectorByPair = new Map<string, ConnectorGeom>()
  private cellSprites = new Map<string, CellSpriteSet>()
  private pathSprites = new Map<string, WorldSprite>()

  private trailDots = new Map<string, WorldSprite>()

  private hudText!: Text
  private overlayText!: Text
  private lifeIcons: Sprite[] = []

  private exitTile = { x: 0, y: 0 }
  private exitLockedSprite!: WorldSprite
  private exitUnlockedSprite!: WorldSprite

  private mummies: Mummy[] = []
  private mummyPool: WorldSprite[] = []

  private playerSprite!: WorldSprite
  private player = { x: 0, y: 0, moveTimer: 0, invuln: 0 }
  private startPos = { x: 0, y: 0 }

  private state: GameState = "START"
  private prevStart = false
  private levelClearTimer = 0

  private score = 0
  private lives = 3
  private level = 1
  private mummyInterval = 16
  private mummyChance = 0.12

  ready(engine: Coccoon): void {
    this._engine = engine

    new ImageList(engine, [
      color(0.85, 0.65, 0.25, 1), // BLOCK (unclaimed, sandstone gold)
      color(1.0, 0.95, 0.65, 1), // TREASURE (bright gold)
      color(0.3, 0.9, 0.95, 1), // KEY (cyan)
      color(0.55, 0.35, 0.15, 1), // DOT (footprint trail)
      "/sprites/q-mummy/player.png", // PLAYER
      "/sprites/q-mummy/mummy.png", // MUMMY
      "/sprites/q-mummy/player.png", // LIFE_ICON
      "/sprites/q-mummy/door-locked.png", // GATE_LOCKED
      "/sprites/q-mummy/treasure.png", // TREASURE_ICON
      "/sprites/q-mummy/key.png", // KEY_ICON
      color(0.22, 0.15, 0.08, 1), // PATH (walkable corridor floor)
    ])

    this.buildBlocks()

    this.exitTile = {
      x: WORLD_X0 + Math.floor(WORLD_W / 2),
      y: WORLD_Y0 + WORLD_H,
    }
    this.startPos = { x: this.exitTile.x, y: this.exitTile.y }

    this.exitLockedSprite = this.wrap(
      new Sprite(engine, COL.GATE_LOCKED, -10, -10, 2, 1),
      this.exitTile.x,
      this.exitTile.y,
    )
    this.exitUnlockedSprite = this.wrap(new Sprite(engine, COL.PATH, -10, -10, 2, 1))

    this.playerSprite = this.wrap(new Sprite(engine, COL.PLAYER, -10, -10, 6, 0.9))

    this.hudText = new Text(
      engine,
      "",
      GRID_W - MAX_LIFE_ICONS - 1,
      1,
      0,
      GRID_H - 1,
      18,
      Colors.WHITE,
      Colors.BLACK,
    )
    for (let i = 0; i < MAX_LIFE_ICONS; i++) {
      this.lifeIcons.push(
        new Sprite(engine, COL.LIFE_ICON, GRID_W - MAX_LIFE_ICONS - 1 + i, GRID_H - 1, 3, 0.7),
      )
    }
    this.overlayText = new Text(
      engine,
      "",
      22,
      9,
      -40,
      -40,
      24,
      Colors.WHITE,
      color(0, 0, 0, 0.85),
    )

    this.state = "START"
    this.showOverlay(
      "Q MUMMY\n\nMove: Arrows/WASD\nEncircle a block to open it\nFind the KEY, avoid mummies,\nthen reach the exit above!\n120 rooms, grown on IBM Quantum hardware\n\nPress START (Space)",
    )
  }

  process(_delta: number, engine: Coccoon): void {
    const inp = engine.update()
    const startPressed = inp.key_presses.includes(4) && !this.prevStart
    this.prevStart = inp.key_presses.includes(4)

    if (this.state === "PLAYING") {
      if (startPressed) {
        // debug skip: jump straight to the next level, no score awarded
        this.level++
        this.startLevel()
      } else {
        this.updatePlaying(inp)
      }
    } else if (this.state === "LEVELCLEAR") {
      this.levelClearTimer--
      if (startPressed || this.levelClearTimer <= 0) {
        this.level++
        this.startLevel()
      }
    } else if (startPressed) {
      this.newGame()
    }
  }

  // ---- world sprite / camera plumbing ---------------------------------------

  private wrap(sprite: Sprite, wx = -10, wy = -10): WorldSprite {
    const ws: WorldSprite = { sprite, wx, wy }
    this.worldSprites.push(ws)
    return ws
  }

  private syncCamera(): void {
    let camX = this.player.x - Math.floor(VIEW_W / 2)
    let camY = this.player.y - Math.floor(VIEW_H / 2)
    camX = Math.max(0, Math.min(camX, WORLD_W - VIEW_W))
    // +1: the exit gate sits one row above the room grid's own extent (WORLD_H)
    camY = Math.max(0, Math.min(camY, WORLD_H + 1 - VIEW_H))
    this.camX = camX
    this.camY = camY

    for (const ws of this.worldSprites) {
      const sx = ws.wx - camX
      const sy = ws.wy - camY
      if (sx >= 0 && sx < VIEW_W && sy >= 0 && sy < VIEW_H) {
        ws.sprite.x = sx
        ws.sprite.y = sy
      } else {
        ws.sprite.x = -10
        ws.sprite.y = -10
      }
    }
  }

  // Fixed screen-space overview of the room grid, since the world scrolls
  // out of view of anywhere the camera isn't currently centered.
  // ---- map construction (fixed layout, built once) -----------------------

  private buildBlocks(): void {
    // Rooms: the 120 atomic tile-rectangles. Always solid, in every replay -
    // merging never turns a room interior into corridor, only the strip
    // between two rooms.
    for (let i = 0; i < ROOM_COUNT; i++) {
      const { baseX, baseY } = roomBase(i)
      const cells: { x: number; y: number }[] = []
      for (let iy = 0; iy < BLOCK_H; iy++) {
        for (let ix = 0; ix < BLOCK_W; ix++) {
          const x = baseX + ix
          const y = baseY + iy
          cells.push({ x, y })
          this.cellSprites.set(key(x, y), {
            base: this.wrap(new Sprite(this._engine, COL.BLOCK, -10, -10, 0, 1), x, y),
            treasure: this.wrap(new Sprite(this._engine, COL.TREASURE, -10, -10, 0, 1)),
            key: this.wrap(new Sprite(this._engine, COL.KEY, -10, -10, 0, 1)),
          })
        }
      }
      this.roomGeoms.push(cells)
      this.roomIcons.push({
        treasure: this.wrap(new Sprite(this._engine, COL.TREASURE_ICON, -10, -10, 2, 1.7)),
        key: this.wrap(new Sprite(this._engine, COL.KEY_ICON, -10, -10, 2, 1.7)),
      })
    }

    // Connectors: the 1-tile corridor strip between every grid-adjacent pair
    // of rooms. Each gets both a block-appearance sprite set (shown when that
    // pair is merged) and a path sprite (shown otherwise).
    for (let r = 0; r < BLOCK_ROWS; r++) {
      for (let c = 0; c < BLOCK_COLS; c++) {
        const a = r * BLOCK_COLS + c
        const { baseX, baseY } = roomBase(a)
        if (c + 1 < BLOCK_COLS) {
          const cells: { x: number; y: number }[] = []
          for (let iy = 0; iy < BLOCK_H; iy++) cells.push({ x: baseX + BLOCK_W, y: baseY + iy })
          this.registerConnector(a, a + 1, cells)
        }
        if (r + 1 < BLOCK_ROWS) {
          const cells: { x: number; y: number }[] = []
          for (let ix = 0; ix < BLOCK_W; ix++) cells.push({ x: baseX + ix, y: baseY + BLOCK_H })
          this.registerConnector(a, a + BLOCK_COLS, cells)
        }
      }
    }

    // Everything else (mainly the outer border corridor) is always floor.
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        if (!this.cellSprites.has(key(x, y))) {
          this.wrap(new Sprite(this._engine, COL.PATH, -10, -10, -1, 1), x, y)
        }
      }
    }
  }

  private registerConnector(a: number, b: number, cells: { x: number; y: number }[]): void {
    for (const c of cells) {
      this.cellSprites.set(key(c.x, c.y), {
        base: this.wrap(new Sprite(this._engine, COL.BLOCK, -10, -10, 0, 1)),
        treasure: this.wrap(new Sprite(this._engine, COL.TREASURE, -10, -10, 0, 1)),
        key: this.wrap(new Sprite(this._engine, COL.KEY, -10, -10, 0, 1)),
      })
      this.pathSprites.set(
        key(c.x, c.y),
        this.wrap(new Sprite(this._engine, COL.PATH, -10, -10, -1, 1), c.x, c.y),
      )
    }
    const geom: ConnectorGeom = { a, b, cells }
    this.connectorGeoms.push(geom)
    this.connectorByPair.set(edgeKey(a, b), geom)
  }

  // Rebuilds this.blocks from the fixed room merges, syncing cellBlockId and
  // the connector visuals to match.
  private computeLevelBlocks(mergePairs: [number, number][]): BlockInfo[] {
    const parent = Array.from({ length: ROOM_COUNT }, (_, i) => i)
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    for (const [a, b] of mergePairs) {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent[ra] = rb
    }

    const groups = new Map<number, number[]>()
    for (let i = 0; i < ROOM_COUNT; i++) {
      const root = find(i)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(i)
    }

    const mergedConnectors = new Set<string>()
    for (const [a, b] of mergePairs) mergedConnectors.add(edgeKey(a, b))

    const blocks: BlockInfo[] = []
    for (const roomIndices of groups.values()) {
      const cellSet = new Set<string>()
      for (const ri of roomIndices) for (const c of this.roomGeoms[ri]) cellSet.add(key(c.x, c.y))
      for (const [a, b] of mergePairs) {
        if (roomIndices.includes(a) && roomIndices.includes(b)) {
          for (const c of this.connectorByPair.get(edgeKey(a, b))!.cells) cellSet.add(key(c.x, c.y))
        }
      }

      const cells = [...cellSet].map(parseKey)
      const ring = computeRingGeneric(cellSet)

      let sumX = 0
      let sumY = 0
      for (const c of cells) {
        sumX += c.x
        sumY += c.y
      }
      const cx = sumX / cells.length
      const cy = sumY / cells.length

      let spawnLocal = cells[0]
      let bestDist = Infinity
      for (const rk of ring) {
        const p = parseKey(rk)
        const d = (p.x - cx) ** 2 + (p.y - cy) ** 2
        if (d < bestDist) {
          bestDist = d
          spawnLocal = p
        }
      }

      const iconRoom = Math.min(...roomIndices)
      blocks.push({
        cells,
        center: { x: WORLD_X0 + cx, y: WORLD_Y0 + cy },
        spawnPoint: { x: WORLD_X0 + spawnLocal.x, y: WORLD_Y0 + spawnLocal.y },
        ring,
        visited: new Set(),
        claimed: false,
        baseSprites: cells.map((c) => this.cellSprites.get(key(c.x, c.y))!.base),
        treasureSprites: cells.map((c) => this.cellSprites.get(key(c.x, c.y))!.treasure),
        keySprites: cells.map((c) => this.cellSprites.get(key(c.x, c.y))!.key),
        treasureIcon: this.roomIcons[iconRoom].treasure,
        keyIcon: this.roomIcons[iconRoom].key,
      })
    }

    this.cellBlockId = []
    for (let y = 0; y < WORLD_H; y++) this.cellBlockId.push(new Array(WORLD_W).fill(-1))
    blocks.forEach((block, idx) => {
      for (const c of block.cells) this.cellBlockId[c.y][c.x] = idx
    })

    for (const conn of this.connectorGeoms) {
      const active = mergedConnectors.has(edgeKey(conn.a, conn.b))
      for (const c of conn.cells) {
        const cs = this.cellSprites.get(key(c.x, c.y))!
        const ps = this.pathSprites.get(key(c.x, c.y))!
        cs.base.wx = active ? c.x : -10
        cs.base.wy = active ? c.y : -10
        ps.wx = active ? -10 : c.x
        ps.wy = active ? -10 : c.y
      }
    }

    return blocks
  }

  // ---- state transitions --------------------------------------------------

  private newGame(): void {
    this.score = 0
    this.lives = 3
    this.level = 1
    this.startLevel()
  }

  private startLevel(): void {
    // reset every room cell to its default solid appearance, and clear any
    // treasure/key reveal left over from a previous pass through this layout
    for (let i = 0; i < this.roomGeoms.length; i++) {
      for (const c of this.roomGeoms[i]) {
        const cs = this.cellSprites.get(key(c.x, c.y))!
        cs.base.wx = c.x
        cs.base.wy = c.y
        cs.treasure.wx = -10
        cs.treasure.wy = -10
        cs.key.wx = -10
        cs.key.wy = -10
      }
      this.roomIcons[i].treasure.wx = -10
      this.roomIcons[i].treasure.wy = -10
      this.roomIcons[i].key.wx = -10
      this.roomIcons[i].key.wy = -10
    }
    for (const conn of this.connectorGeoms) {
      for (const c of conn.cells) {
        const cs = this.cellSprites.get(key(c.x, c.y))!
        cs.treasure.wx = -10
        cs.treasure.wy = -10
        cs.key.wx = -10
        cs.key.wy = -10
      }
    }

    const layout = LEVELS[(this.level - 1) % LEVELS.length]
    this.blocks = this.computeLevelBlocks(layout.mergePairs)

    this.hasKey = false
    this.keyBlockIndex = Math.floor(Math.random() * this.blocks.length)
    this.exitLockedSprite.wx = this.exitTile.x
    this.exitLockedSprite.wy = this.exitTile.y
    this.exitUnlockedSprite.wx = -10
    this.exitUnlockedSprite.wy = -10

    for (const ws of this.trailDots.values()) {
      ws.wx = -10
      ws.wy = -10
    }
    this.trailDots.clear()

    this.clearMummies()
    this.mummyInterval = Math.max(9, 16 - (this.level - 1))
    this.mummyChance = Math.min(0.35, 0.12 + 0.02 * (this.level - 1))

    this.player = { x: this.startPos.x, y: this.startPos.y, moveTimer: 0, invuln: 0 }
    this.playerSprite.wx = this.startPos.x
    this.playerSprite.wy = this.startPos.y
    this.markVisited(this.startPos.x, this.startPos.y)

    this.state = "PLAYING"
    this.hideOverlay()
    this.syncCamera()
  }

  private triggerLevelClear(): void {
    this.state = "LEVELCLEAR"
    this.levelClearTimer = LEVEL_CLEAR_FRAMES
    this.showOverlay(`LEVEL ${this.level} CLEAR!\n\nScore: ${this.score}\n\nPress START (Space)\nfor next level`)
  }

  private onPlayerHit(): void {
    this.lives--
    if (this.lives <= 0) {
      this.state = "GAMEOVER"
      this.showOverlay(`GAME OVER\n\nScore: ${this.score}\n\nPress START (Space)`)
      return
    }

    this.player.x = this.startPos.x
    this.player.y = this.startPos.y
    this.player.invuln = RESPAWN_INVULN_FRAMES
    this.playerSprite.wx = this.startPos.x
    this.playerSprite.wy = this.startPos.y

    for (const m of this.mummies) {
      m.x = m.homeX
      m.y = m.homeY
      m.sprite.wx = m.x
      m.sprite.wy = m.y
    }
  }

  // ---- per-frame gameplay ---------------------------------------------------

  private updatePlaying(inp: { key_presses: number[] }): void {
    const p = this.player
    if (p.invuln > 0) p.invuln--

    p.moveTimer--
    if (p.moveTimer <= 0) {
      let dx = 0
      let dy = 0
      if (inp.key_presses.includes(0)) dy = 1
      else if (inp.key_presses.includes(2)) dy = -1
      else if (inp.key_presses.includes(1)) dx = 1
      else if (inp.key_presses.includes(3)) dx = -1

      if (dx !== 0 || dy !== 0) {
        if (dx < 0) this.playerSprite.sprite.flip_h = true
        else if (dx > 0) this.playerSprite.sprite.flip_h = false

        const nx = p.x + dx
        const ny = p.y + dy
        if (this.isCorridor(nx, ny)) {
          p.x = nx
          p.y = ny
          this.playerSprite.wx = nx
          this.playerSprite.wy = ny
          this.markVisited(nx, ny)

          if (nx === this.exitTile.x && ny === this.exitTile.y) {
            this.triggerLevelClear()
          }
        }
        p.moveTimer = MOVE_INTERVAL
      }
    }

    for (const m of this.mummies) {
      m.moveTimer--
      if (m.moveTimer <= 0) {
        this.stepMummy(m)
        m.moveTimer = this.mummyInterval
      }
      m.sprite.wx = m.x
      m.sprite.wy = m.y
    }

    if (p.invuln <= 0) {
      for (const m of this.mummies) {
        if (m.x === p.x && m.y === p.y) {
          this.onPlayerHit()
          break
        }
      }
    }

    for (let i = 0; i < MAX_LIFE_ICONS; i++) {
      const icon = this.lifeIcons[i]
      icon.x = i < this.lives ? GRID_W - MAX_LIFE_ICONS - 1 + i : -10
    }
    this.hudText.text = `SCORE ${this.score}  LEVEL ${this.level}${this.hasKey ? "  KEY! EXIT NOW" : ""}`

    this.syncCamera()
  }

  private markVisited(ex: number, ey: number): void {
    const gx = ex - WORLD_X0
    const gy = ey - WORLD_Y0
    const k = key(gx, gy)

    if (!this.trailDots.has(k)) {
      const dot = this.wrap(new Sprite(this._engine, COL.DOT, -10, -10, 1, 0.35), ex, ey)
      this.trailDots.set(k, dot)
    }

    this.blocks.forEach((block, idx) => {
      if (block.claimed || !block.ring.has(k)) return
      if (block.visited.has(k)) return
      block.visited.add(k)
      if (block.visited.size === block.ring.size) this.resolveBlock(block, idx)
    })
  }

  private resolveBlock(block: BlockInfo, idx: number): void {
    block.claimed = true

    if (idx === this.keyBlockIndex) {
      this.revealKey(block)
      return
    }

    if (Math.random() < this.mummyChance) {
      // the block empties out - its cells become open floor and a mummy emerges
      for (const s of block.baseSprites) {
        s.wx = -10
        s.wy = -10
      }
      for (const cell of block.cells) {
        this.cellBlockId[cell.y][cell.x] = -1
        this.wrap(new Sprite(this._engine, COL.PATH, -10, -10, -1, 1), cell.x, cell.y)
      }
      this.spawnMummy(block.spawnPoint.x, block.spawnPoint.y)
    } else {
      this.score += 150
      for (let i = 0; i < block.baseSprites.length; i++) {
        const base = block.baseSprites[i]
        const treasure = block.treasureSprites[i]
        treasure.wx = base.wx
        treasure.wy = base.wy
        base.wx = -10
        base.wy = -10
      }
      block.treasureIcon.wx = block.center.x
      block.treasureIcon.wy = block.center.y
    }
  }

  private revealKey(block: BlockInfo): void {
    this.hasKey = true
    for (let i = 0; i < block.baseSprites.length; i++) {
      const base = block.baseSprites[i]
      const keySprite = block.keySprites[i]
      keySprite.wx = base.wx
      keySprite.wy = base.wy
      base.wx = -10
      base.wy = -10
    }
    block.keyIcon.wx = block.center.x
    block.keyIcon.wy = block.center.y
    this.exitLockedSprite.wx = -10
    this.exitLockedSprite.wy = -10
    this.exitUnlockedSprite.wx = this.exitTile.x
    this.exitUnlockedSprite.wy = this.exitTile.y
  }

  private spawnMummy(ex: number, ey: number): void {
    let sprite = this.mummyPool.pop()
    if (!sprite) sprite = this.wrap(new Sprite(this._engine, COL.MUMMY, -10, -10, 5, 0.9), ex, ey)
    else {
      sprite.wx = ex
      sprite.wy = ey
    }
    this.mummies.push({ x: ex, y: ey, homeX: ex, homeY: ey, sprite, moveTimer: this.mummyInterval })
  }

  private clearMummies(): void {
    for (const m of this.mummies) {
      m.sprite.wx = -10
      m.sprite.wy = -10
      this.mummyPool.push(m.sprite)
    }
    this.mummies = []
  }

  private stepMummy(m: Mummy): void {
    const dx = this.player.x - m.x
    const dy = this.player.y - m.y
    const options: [number, number][] = []
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) options.push([Math.sign(dx), 0])
      if (dy !== 0) options.push([0, Math.sign(dy)])
    } else {
      if (dy !== 0) options.push([0, Math.sign(dy)])
      if (dx !== 0) options.push([Math.sign(dx), 0])
    }

    for (const [ddx, ddy] of options) {
      const nx = m.x + ddx
      const ny = m.y + ddy
      if (this.isCorridor(nx, ny)) {
        m.x = nx
        m.y = ny
        return
      }
    }

    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[dirs[i], dirs[j]] = [dirs[j], dirs[i]]
    }
    for (const [ddx, ddy] of dirs) {
      const nx = m.x + ddx
      const ny = m.y + ddy
      if (this.isCorridor(nx, ny)) {
        m.x = nx
        m.y = ny
        return
      }
    }
  }

  // ---- helpers --------------------------------------------------------------

  private isCorridor(ex: number, ey: number): boolean {
    if (ex === this.exitTile.x && ey === this.exitTile.y) return this.hasKey

    const x = ex - WORLD_X0
    const y = ey - WORLD_Y0
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false
    return this.cellBlockId[y][x] === -1
  }

  private showOverlay(msg: string): void {
    this.overlayText.text = msg
    this.overlayText.x = 5
    this.overlayText.y = 5
  }

  private hideOverlay(): void {
    this.overlayText.x = -40
    this.overlayText.y = -40
  }
}
