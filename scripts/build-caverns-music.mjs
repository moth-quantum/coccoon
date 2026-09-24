// Renders a loopable "Quantum Caverns" theme from the retrocausal-echo-v1 quantum tap map.
//
// The composition is driven entirely by the engine's quantum output (scripts/echo-taps.json):
//   - lattice `site` (0..9)  -> pitch on an A minor-pentatonic scale (two octaves)
//   - `time_ms`              -> note onset within the phrase (125ms grid)
//   - `level`                -> note velocity / gain
//   - `pan`                  -> stereo placement
//   - `depth`                -> octave shift + decay length (deeper = longer tail)
//
// We synthesize bell/pluck voices per tap plus a sustained cavern drone, then fold the
// reverb/decay tail back over the loop start so the WAV loops seamlessly.

import { readFileSync, mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const SR = 44100
const tapData = JSON.parse(readFileSync(join(__dirname, "echo-taps.json"), "utf8"))
const tapMap = tapData.extras.tap_map
const taps = tapMap.taps

// --- musical mapping -------------------------------------------------------
// A minor pentatonic (A C D E G), two octaves -> 10 notes for 10 lattice sites.
const A2 = 110.0
const PENTA = [0, 3, 5, 7, 10] // semitone offsets from root within an octave
function siteToFreq(site) {
  const octave = Math.floor(site / 5)
  const deg = site % 5
  const semis = PENTA[deg] + 12 * octave
  return A2 * Math.pow(2, semis / 12)
}

// Stretch the 125ms quantum grid to a calmer cavern tempo.
const TIME_SCALE = 2.4 // 125ms -> 300ms per step
const PHRASE_S = (tapMap.master_ms / 1000) * TIME_SCALE // one phrase length in seconds
const PHRASES = 4
const LOOP_S = PHRASE_S * PHRASES
const TAIL_S = 3.0 // decay/reverb tail folded back into the loop
const totalLen = Math.ceil((LOOP_S + TAIL_S) * SR)

const L = new Float32Array(totalLen)
const R = new Float32Array(totalLen)

function panGains(pan) {
  // pan in ~[-1,1] -> equal power
  const p = Math.max(-1, Math.min(1, pan))
  const angle = ((p + 1) / 2) * (Math.PI / 2)
  return [Math.cos(angle), Math.sin(angle)]
}

// A bell/pluck voice: a few inharmonic-ish partials with exponential decay.
function addVoice(startSec, freq, gain, pan, decaySec) {
  const start = Math.floor(startSec * SR)
  const dur = Math.floor(decaySec * SR)
  const [gl, gr] = panGains(pan)
  const partials = [
    { m: 1.0, a: 1.0 },
    { m: 2.0, a: 0.45 },
    { m: 3.01, a: 0.22 },
    { m: 4.02, a: 0.1 },
  ]
  const attack = Math.floor(0.006 * SR)
  for (let i = 0; i < dur; i++) {
    const idx = start + i
    if (idx >= totalLen) break
    const t = i / SR
    // exponential decay envelope with short attack
    let env = Math.exp(-t / (decaySec * 0.32))
    if (i < attack) env *= i / attack
    let s = 0
    for (const p of partials) s += p.a * Math.sin(2 * Math.PI * freq * p.m * t)
    s *= env * gain
    L[idx] += s * gl
    R[idx] += s * gr
  }
}

// Sustained low drone (root + fifth) for cavern atmosphere, with a slow swell.
function addDrone() {
  const root = A2 / 2 // A1 = 55Hz
  const fifth = root * Math.pow(2, 7 / 12)
  for (let i = 0; i < totalLen; i++) {
    const t = i / SR
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / 9)) // 9s LFO
    const s =
      0.5 * Math.sin(2 * Math.PI * root * t) +
      0.28 * Math.sin(2 * Math.PI * fifth * t) +
      0.18 * Math.sin(2 * Math.PI * root * 2 * t)
    const g = 0.08 * (0.6 + 0.4 * swell)
    L[i] += s * g
    R[i] += s * g
  }
}

// --- render ----------------------------------------------------------------
addDrone()

for (let phrase = 0; phrase < PHRASES; phrase++) {
  const phraseStart = phrase * PHRASE_S
  // gentle per-phrase octave shimmer so repeats aren't identical but stay tonal
  const octShift = phrase % 2 === 0 ? 0 : phrase % 4 === 1 ? 1 : -1
  for (const tap of taps) {
    const onset = phraseStart + (tap.time_ms / 1000) * TIME_SCALE
    let freq = siteToFreq(tap.site) * Math.pow(2, octShift * (tap.depth >= 5 ? 1 : 0) / 1)
    // deeper taps -> lower octave & longer tail; shallow -> brighter & shorter
    if (tap.depth <= 2) freq *= 2
    const decay = 0.6 + (tap.depth / 8) * 1.8
    const gain = 0.22 * tap.level
    addVoice(onset, freq, gain, tap.pan ?? 0, decay)
  }
}

// Fold the tail (everything past LOOP_S) back over the loop start for a seamless loop.
const loopLen = Math.floor(LOOP_S * SR)
for (let i = loopLen; i < totalLen; i++) {
  const w = i - loopLen
  if (w >= loopLen) break
  L[w] += L[i]
  R[w] += R[i]
}

// Normalize to peak ~0.85.
let peak = 0
for (let i = 0; i < loopLen; i++) {
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const norm = peak > 0 ? 0.85 / peak : 1

// --- write WAV (PCM16 stereo) ---------------------------------------------
const frames = loopLen
const dataBytes = frames * 2 * 2
const buf = Buffer.alloc(44 + dataBytes)
buf.write("RIFF", 0)
buf.writeUInt32LE(36 + dataBytes, 4)
buf.write("WAVE", 8)
buf.write("fmt ", 12)
buf.writeUInt32LE(16, 16)
buf.writeUInt16LE(1, 20) // PCM
buf.writeUInt16LE(2, 22) // channels
buf.writeUInt32LE(SR, 24)
buf.writeUInt32LE(SR * 2 * 2, 28) // byte rate
buf.writeUInt16LE(4, 32) // block align
buf.writeUInt16LE(16, 34) // bits
buf.write("data", 36)
buf.writeUInt32LE(dataBytes, 40)
let off = 44
for (let i = 0; i < frames; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * norm))
  const r = Math.max(-1, Math.min(1, R[i] * norm))
  buf.writeInt16LE((l * 32767) | 0, off)
  buf.writeInt16LE((r * 32767) | 0, off + 2)
  off += 4
}

const outDir = join(ROOT, "public", "audio")
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, "caverns-theme.wav")
writeFileSync(outPath, buf)
console.log(`[v0] wrote ${outPath}`)
console.log(`[v0] loop length ${(frames / SR).toFixed(2)}s, ${taps.length} quantum taps x ${PHRASES} phrases`)
