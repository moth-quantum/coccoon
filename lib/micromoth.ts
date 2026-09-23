// MicroMoth — a lightweight statevector quantum circuit simulator.
//
// Faithful TypeScript port of micromoth.gd from the coccoon engine
// (https://github.com/moth-quantum/coccoon).
//
// (C) Copyright Moth Quantum 2024. (C) Copyright IBM 2023.
// Licensed under the Apache License, Version 2.0.

// Complex amplitudes are represented as [real, imag] pairs, exactly as in
// the original GDScript implementation.
export type Complex = [number, number]
export type Statevector = Complex[]

const R2 = 0.70710678118 // 1/sqrt(2)

type Gate =
  | ["init", (number | Complex)[]]
  | ["x", number]
  | ["h", number]
  | ["rx", number, number]
  | ["rz", number, number]
  | ["cx", number, number]
  | ["crx", number, number, number]
  | ["swap", number, number]
  | ["m", number, number]

export type SimulateMode = "counts" | "statevector" | "probabilities_dict" | "memory"

export class QuantumCircuit {
  numQubits: number
  numClbits: number
  name = ""
  data: Gate[] = []

  constructor(n: number, m = 0) {
    this.numQubits = n
    this.numClbits = m
  }

  initialize(k: (number | Complex)[]): void {
    this.data = []
    this.data.push(["init", k.slice()])
  }

  x(q: number): void {
    this.data.push(["x", q])
  }

  rx(theta: number, q: number): void {
    this.data.push(["rx", theta, q])
  }

  rz(theta: number, q: number): void {
    this.data.push(["rz", theta, q])
  }

  h(q: number): void {
    this.data.push(["h", q])
  }

  cx(s: number, t: number): void {
    this.data.push(["cx", s, t])
  }

  crx(theta: number, s: number, t: number): void {
    this.data.push(["crx", theta, s, t])
  }

  swap(s: number, t: number): void {
    this.data.push(["swap", s, t])
  }

  measure(q: number, b: number): void {
    if (b >= this.numClbits) throw new Error("Index for output bit out of range.")
    if (q >= this.numQubits) throw new Error("Index for qubit out of range.")
    this.data.push(["m", q, b])
  }

  measureAll(): void {
    if (this.numClbits === 0) this.numClbits = this.numQubits
    for (let q = 0; q < this.numQubits; q++) this.measure(q, q)
  }

  ry(theta: number, q: number): void {
    this.rx(Math.PI / 2.0, q)
    this.rz(theta, q)
    this.rx(-Math.PI / 2.0, q)
  }

  z(q: number): void {
    this.rz(Math.PI, q)
  }

  t(q: number): void {
    this.rz(Math.PI / 4.0, q)
  }

  y(q: number): void {
    this.rz(Math.PI, q)
    this.x(q)
  }
}

function superpose(x: Complex, y: Complex): [Complex, Complex] {
  return [
    [R2 * (x[0] + y[0]), R2 * (x[1] + y[1])],
    [R2 * (x[0] - y[0]), R2 * (x[1] - y[1])],
  ]
}

function turn(x: Complex, y: Complex, theta: number): [Complex, Complex] {
  const c = Math.cos(theta / 2.0)
  const s = Math.sin(theta / 2.0)
  return [
    [x[0] * c + y[1] * s, x[1] * c - y[0] * s],
    [y[0] * c + x[1] * s, y[1] * c - x[0] * s],
  ]
}

function phaseturn(x: Complex, y: Complex, theta: number): [Complex, Complex] {
  const c = Math.cos(theta / 2.0)
  const s = Math.sin(theta / 2.0)
  return [
    [x[0] * c + x[1] * s, x[1] * c - x[0] * s],
    [y[0] * c - y[1] * s, y[1] * c + y[0] * s],
  ]
}

function intToBitstring(j: number, nBits: number): string {
  let result = ""
  for (let i = nBits - 1; i >= 0; i--) {
    result += (j >> i) & 1 ? "1" : "0"
  }
  return result
}

export type CountsResult = Record<string, number>
export type ProbabilitiesResult = Record<string, number>
export type SimulateResult = Statevector | ProbabilitiesResult | CountsResult | string[]

export function simulate(
  qc: QuantumCircuit,
  shots = 1024,
  get: SimulateMode = "counts",
  noiseModel: number[] = [],
): SimulateResult {
  // Initialize statevector: complex numbers as [real, imag]
  let k: Statevector = []
  for (let i = 0; i < 1 << qc.numQubits; i++) k.push([0.0, 0.0])
  k[0] = [1.0, 0.0]

  // Expand scalar noise model to per-qubit list
  let nm: number[] = noiseModel.slice()
  if (nm.length === 1) {
    nm = []
    for (let i = 0; i < qc.numQubits; i++) nm.push(noiseModel[0])
  }

  const outputMap: Record<number, number> = {}

  for (const gate of qc.data) {
    if (gate[0] === "init") {
      const initState = gate[1]
      if (initState.length > 0 && Array.isArray(initState[0])) {
        k = (initState as Complex[]).map((e) => [e[0], e[1]])
      } else {
        k = (initState as number[]).map((e) => [Number(e), 0.0])
      }
    } else if (gate[0] === "m") {
      outputMap[gate[2]] = gate[1]
    } else if (gate[0] === "x" || gate[0] === "h" || gate[0] === "rx" || gate[0] === "rz") {
      const j = gate[gate.length - 1] as number
      for (let i0 = 0; i0 < 1 << j; i0++) {
        for (let i1 = 0; i1 < 1 << (qc.numQubits - j - 1); i1++) {
          const b0 = i0 + (1 << (j + 1)) * i1
          const b1 = b0 + (1 << j)
          if (gate[0] === "x") {
            const tmp = k[b0]
            k[b0] = k[b1]
            k[b1] = tmp
          } else if (gate[0] === "h") {
            const result = superpose(k[b0], k[b1])
            k[b0] = result[0]
            k[b1] = result[1]
          } else if (gate[0] === "rx") {
            const result = turn(k[b0], k[b1], Number(gate[1]))
            k[b0] = result[0]
            k[b1] = result[1]
          } else if (gate[0] === "rz") {
            const result = phaseturn(k[b0], k[b1], Number(gate[1]))
            k[b0] = result[0]
            k[b1] = result[1]
          }
        }
      }
    } else if (gate[0] === "cx" || gate[0] === "crx" || gate[0] === "swap") {
      let s: number
      let t: number
      let theta = 0.0
      if (gate[0] === "crx") {
        theta = Number(gate[1])
        s = gate[2]
        t = gate[3]
      } else {
        s = gate[1]
        t = gate[2]
      }

      const l = Math.min(s, t)
      const h = Math.max(s, t)

      for (let i0 = 0; i0 < 1 << l; i0++) {
        for (let i1 = 0; i1 < 1 << (h - l - 1); i1++) {
          for (let i2 = 0; i2 < 1 << (qc.numQubits - h - 1); i2++) {
            const b00 = i0 + (1 << (l + 1)) * i1 + (1 << (h + 1)) * i2
            const b01 = b00 + (1 << t)
            const b10 = b00 + (1 << s)
            const b11 = b10 + (1 << t)
            if (gate[0] === "cx") {
              const tmp = k[b10]
              k[b10] = k[b11]
              k[b11] = tmp
            } else if (gate[0] === "crx") {
              const result = turn(k[b10], k[b11], theta)
              k[b10] = result[0]
              k[b11] = result[1]
            } else if (gate[0] === "swap") {
              const tmp = k[b01]
              k[b01] = k[b10]
              k[b10] = tmp
            }
          }
        }
      }
    }
  }

  if (get === "statevector") return k

  // Compute probabilities from statevector
  const probs: number[] = k.map((e) => e[0] * e[0] + e[1] * e[1])

  // Apply noise model if present
  if (nm.length > 0) {
    for (let j = 0; j < qc.numQubits; j++) {
      const pMeas = Number(nm[j])
      for (let i0 = 0; i0 < 1 << j; i0++) {
        for (let i1 = 0; i1 < 1 << (qc.numQubits - j - 1); i1++) {
          const b0 = i0 + (1 << (j + 1)) * i1
          const b1 = b0 + (1 << j)
          const p0 = probs[b0]
          const p1 = probs[b1]
          probs[b0] = (1.0 - pMeas) * p0 + pMeas * p1
          probs[b1] = (1.0 - pMeas) * p1 + pMeas * p0
        }
      }
    }
  }

  if (get === "probabilities_dict") {
    const result: ProbabilitiesResult = {}
    for (let j = 0; j < probs.length; j++) {
      result[intToBitstring(j, qc.numQubits)] = probs[j]
    }
    return result
  }

  // Sampling for counts/memory
  const m: string[] = []
  for (let shot = 0; shot < shots; shot++) {
    let cumu = 0.0
    const r = Math.random()
    for (let j = 0; j < probs.length; j++) {
      cumu += probs[j]
      if (r < cumu) {
        const rawOut = intToBitstring(j, qc.numQubits)
        const outList: string[] = []
        for (let i = 0; i < qc.numClbits; i++) outList.push("0")
        for (const bit in outputMap) {
          const b = Number(bit)
          outList[qc.numClbits - 1 - b] = rawOut[qc.numQubits - 1 - outputMap[b]]
        }
        m.push(outList.join(""))
        break
      }
    }
  }

  if (get === "memory") return m

  const counts: CountsResult = {}
  for (const out of m) {
    counts[out] = (counts[out] ?? 0) + 1
  }
  return counts
}

export const MicroMoth = { QuantumCircuit, simulate, R2 }
export default MicroMoth
