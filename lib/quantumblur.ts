// QuantumBlur — quantum height-map / image blur utilities.
//
// Faithful TypeScript port of quantumblur.gd from the coccoon engine, itself a
// GDScript port of https://github.com/moth-quantum/QuantumBlur.
//
// A height map is encoded into a quantum statevector (one amplitude per cell),
// single-qubit rotations "blur" it across the Bloch sphere, and the resulting
// probability distribution is decoded back into a height map. This is the same
// calculation the Moth platform's blur-core-v1 engine performs on real quantum
// hardware or a cloud simulator. It is kept here as a readable reference
// implementation of that algorithm — Quantum Caverns always runs the blur on
// the platform, and only imports posKey/HeightMap from this file.
//
// Heights are plain objects keyed by "x,y" (mirroring the original's
// Dictionary keyed by Vector2i).

import { MicroMoth, type Statevector } from "@/lib/micromoth"

export type HeightMap = Record<string, number>

export function posKey(x: number, y: number): string {
  return `${x},${y}`
}

export function makeLine(length: number): string[] {
  const n = Math.ceil(Math.log(length) / Math.log(2))
  let line: string[] = ["0", "1"]
  for (let j = 0; j < n - 1; j++) {
    const rev = line.slice().reverse()
    line = line.concat(rev)
    const half = Math.floor(line.length / 2)
    for (let i = 0; i < half; i++) line[i] = line[i] + "0"
    for (let i = half; i < line.length; i++) line[i] = line[i] + "1"
  }
  return line
}

export function makeGrid(Lx: number, Ly = -1): Record<string, [number, number]> {
  if (Ly < 0) Ly = Lx
  const lineX = makeLine(Lx)
  const lineY = makeLine(Ly)
  const grid: Record<string, [number, number]> = {}
  for (let x = 0; x < Lx; x++) {
    for (let y = 0; y < Ly; y++) {
      grid[lineX[x] + lineY[y]] = [x, y]
    }
  }
  return grid
}

function binToInt(s: string): number {
  let r = 0
  for (const c of s) r = r * 2 + (c === "1" ? 1 : 0)
  return r
}

function normalize(state: number[]): number[] {
  let n = 0
  for (const v of state) n += v * v
  const sq = n > 1e-12 ? Math.sqrt(n) : 1.0
  return state.map((v) => v / sq)
}

export function height2circuit(height: HeightMap, Lx: number, Ly = -1, useLog = false) {
  if (Ly < 0) Ly = Lx
  const grid = makeGrid(Lx, Ly)
  const nBitsX = Math.ceil(Math.log(Lx) / Math.log(2))
  const nBitsY = Math.ceil(Math.log(Ly) / Math.log(2))
  const nQubits = nBitsX + nBitsY
  const state: number[] = new Array(1 << nQubits).fill(0.0)

  if (useLog) {
    let maxH = 0.0
    for (const pos in height) maxH = Math.max(maxH, height[pos])
    if (maxH < 1e-12) maxH = 1.0
    const eps = 0.01
    let minH = 1.0
    for (const pos in height) {
      const h = height[pos] / maxH
      if (h > eps && h < minH) minH = h
    }
    const base = 1.0 / minH
    for (const bs in grid) {
      const [x, y] = grid[bs]
      const key = posKey(x, y)
      if (key in height) {
        const h = height[key] / maxH
        if (h > 0.0) state[binToInt(bs)] = Math.sqrt(Math.pow(base, h / minH))
      }
    }
  } else {
    for (const bs in grid) {
      const [x, y] = grid[bs]
      const key = posKey(x, y)
      if (key in height) {
        const h = height[key]
        if (h > 0.0) state[binToInt(bs)] = Math.sqrt(h)
      }
    }
  }

  const normalized: Statevector | number[] = normalize(state)
  const qc = new MicroMoth.QuantumCircuit(nQubits)
  qc.initialize(normalized)
  return qc
}

// Log-normalize a height map in place of the values, matching the useLog branch
// of probs2height. The Moth platform returns a raw probability field (one peak,
// a long near-zero tail); this spreads it across [0,1] so a 0.5 threshold
// produces a balanced maze — the same transform the local blur applies when
// decoding with circuit2height(..., useLog=true).
export function logNormalizeHeight(height: HeightMap): HeightMap {
  let maxH = 1e-10
  for (const pos in height) if (height[pos] > maxH) maxH = height[pos]
  const out: HeightMap = {}
  for (const pos in height) out[pos] = height[pos] / maxH

  let minH = 1.0
  for (const pos in out) {
    const v = out[pos]
    if (v > 1e-100 && v < minH) minH = v
  }
  const logBase = Math.log(1.0 / minH)
  for (const pos in out) {
    const v = out[pos]
    if (v > 1e-100 && logBase > 1e-10) {
      out[pos] = Math.max(Math.log(v / minH) / logBase, 0.0)
    } else {
      out[pos] = 0.0
    }
  }
  return out
}

export function probs2height(probs: Record<string, number>, Lx: number, Ly = -1, useLog = false): HeightMap {
  if (Ly < 0) Ly = Lx
  const grid = makeGrid(Lx, Ly)
  let maxH = 1e-10
  for (const bs in probs) if (probs[bs] > maxH) maxH = probs[bs]
  const height: HeightMap = {}
  for (let x = 0; x < Lx; x++) {
    for (let y = 0; y < Ly; y++) height[posKey(x, y)] = 0.0
  }
  for (const bs in probs) {
    if (bs in grid) {
      const [x, y] = grid[bs]
      height[posKey(x, y)] = probs[bs] / maxH
    }
  }

  if (useLog) {
    let minH = 1.0
    for (const pos in height) {
      const v = height[pos]
      if (v > 1e-100 && v < minH) minH = v
    }
    const logBase = Math.log(1.0 / minH)
    for (const pos in height) {
      const v = height[pos]
      if (v > 1e-100 && logBase > 1e-10) {
        height[pos] = Math.max(Math.log(v / minH) / logBase, 0.0)
      } else {
        height[pos] = 0.0
      }
    }
  }

  return height
}

export function circuit2height(
  qc: InstanceType<typeof MicroMoth.QuantumCircuit>,
  Lx: number,
  Ly = -1,
  useLog = false,
): HeightMap {
  if (Ly < 0) Ly = Lx
  const probs = MicroMoth.simulate(qc, 1024, "probabilities_dict") as Record<string, number>
  return probs2height(probs, Lx, Ly, useLog)
}

export const QuantumBlur = { makeLine, makeGrid, height2circuit, probs2height, circuit2height }
export default QuantumBlur
