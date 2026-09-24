// One-off asset build: downloads Celeste sprite sets from the coccoon repo and
// composites each set (original / pair / single) into a single spritesheet PNG.
// Layout: 16 columns x 8 rows of the source tile size, indexed 0..127 row-major.
import { PNG } from "pngjs"
import { writeFile, mkdir } from "node:fs/promises"

const RAW = "https://raw.githubusercontent.com/moth-quantum/coccoon/main/games/celeste"
const SETS = ["images_original", "images_pair", "images_single"]
const COLS = 16
const ROWS = 8
const N = 128

async function fetchPng(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return PNG.sync.read(buf)
}

async function buildSet(set) {
  // Fetch all 128 tiles (in batches to be polite).
  const tiles = new Array(N)
  const batch = 16
  for (let start = 0; start < N; start += batch) {
    const jobs = []
    for (let i = start; i < Math.min(start + batch, N); i++) {
      jobs.push(
        fetchPng(`${RAW}/${set}/spr${String(i).padStart(3, "0")}.png`).then((png) => {
          tiles[i] = png
        }),
      )
    }
    await Promise.all(jobs)
  }
  const tw = tiles[0].width
  const th = tiles[0].height
  const sheet = new PNG({ width: COLS * tw, height: ROWS * th })
  for (let i = 0; i < N; i++) {
    const t = tiles[i]
    const cx = (i % COLS) * tw
    const cy = Math.floor(i / COLS) * th
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const si = (y * t.width + x) * 4
        const di = ((cy + y) * sheet.width + (cx + x)) * 4
        sheet.data[di] = t.data[si]
        sheet.data[di + 1] = t.data[si + 1]
        sheet.data[di + 2] = t.data[si + 2]
        sheet.data[di + 3] = t.data[si + 3]
      }
    }
  }
  const out = PNG.sync.write(sheet)
  const name = set.replace("images_", "celeste-")
  await writeFile(`public/sprites/${name}.png`, out)
  console.log(`[v0] wrote public/sprites/${name}.png (${sheet.width}x${sheet.height}, tile ${tw}x${th})`)
  return { tw, th }
}

async function main() {
  await mkdir("public/sprites", { recursive: true })
  let dims
  for (const set of SETS) {
    dims = await buildSet(set)
  }
  // Title screen image.
  const title = await fetchPng(`${RAW}/images_original/title.png`)
  await writeFile("public/sprites/celeste-title.png", PNG.sync.write(title))
  console.log(`[v0] wrote public/sprites/celeste-title.png (${title.width}x${title.height})`)
  console.log(`[v0] tile size ${dims.tw}x${dims.th}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
