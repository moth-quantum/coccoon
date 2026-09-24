// Serves the real source of the built-in games and engine so players can
// inspect (and learn from) the exact code that runs — tutorial comments and
// all. Only a fixed whitelist of files is readable; the `f` query param is
// matched against it, so no arbitrary path can be requested.

import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// key -> project-relative path
const FILES: Record<string, string> = {
  "games/qubit-park": "lib/games/qubit-park.ts",
  "games/quantum-caverns": "lib/games/quantum-caverns.ts",
  "games/celeste": "lib/games/celeste.ts",
  "games/celeste-data": "lib/games/celeste-data.ts",
  "lib/coccoon": "lib/coccoon.ts",
  "lib/micromoth": "lib/micromoth.ts",
  "lib/quantumblur": "lib/quantumblur.ts",
  "api/moth-blur": "app/api/moth-blur/route.ts",
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("f") ?? ""
  const rel = FILES[key]

  if (!rel) {
    return NextResponse.json({ error: "Unknown source file" }, { status: 404 })
  }

  try {
    const abs = path.join(process.cwd(), rel)
    const content = await readFile(abs, "utf8")
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Could not read source file" }, { status: 500 })
  }
}
