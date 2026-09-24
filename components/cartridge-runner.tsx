"use client"

import { useEffect, useRef } from "react"
import * as ts from "typescript"
import {
  Coccoon,
  ImageList,
  Sprite,
  Text,
  color,
  Colors,
  GRID_W,
  GRID_H,
  CELL,
  SoundList,
  Sound,
  LOOP,
  type Game,
} from "@/lib/coccoon"
import { MicroMoth } from "@/lib/micromoth"

// The modules a cartridge is allowed to import from. These are exactly the
// primitives the built-in demo games use, so a cartridge is written the same
// way a demo is: `import { ... } from "@/lib/coccoon"` plus an exported class.
const CARTRIDGE_MODULES: Record<string, Record<string, unknown>> = {
  "@/lib/coccoon": {
    Coccoon,
    ImageList,
    Sprite,
    Text,
    color,
    Colors,
    GRID_W,
    GRID_H,
    CELL,
    SoundList,
    Sound,
    LOOP,
  },
  "@/lib/micromoth": { MicroMoth },
}

export type LogLevel = "log" | "warn" | "error"

type CartridgeRunnerProps = {
  code: string
  // Increment this to (re)compile and run the current code.
  runToken: number
  onLog: (level: LogLevel, message: string) => void
  onError: (message: string) => void
  onStarted: () => void
  onExit?: () => void
}

// Build a Game from user source. The cartridge is authored exactly like a
// built-in demo game: it imports primitives from "@/lib/coccoon" (and
// optionally "@/lib/micromoth") and exports a class implementing Game.
//
// Because the browser has no module resolver, we transpile the TypeScript to
// CommonJS with the TypeScript compiler and run it with a `require` shim that
// hands back the injected engine modules. Throws on compile error, a
// disallowed import, or a missing/invalid exported class.
function compileCartridge(code: string, sandboxConsole: Console): Game {
  let js: string
  try {
    js = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      reportDiagnostics: false,
    }).outputText
  } catch (err) {
    throw new Error("Could not compile cartridge: " + errText(err))
  }

  const requireShim = (id: string): Record<string, unknown> => {
    const mod = CARTRIDGE_MODULES[id]
    if (!mod) {
      throw new Error(
        `Cannot import "${id}". Cartridges may only import from "@/lib/coccoon" and "@/lib/micromoth".`,
      )
    }
    return mod
  }

  const moduleObj = { exports: {} as Record<string, unknown> }
  const factory = new Function(
    "require",
    "module",
    "exports",
    "console",
    `"use strict";\n${js}`,
  )
  factory(requireShim, moduleObj, moduleObj.exports, sandboxConsole)

  // Accept `export default class ...` or a single named `export class ...`.
  const exported = moduleObj.exports
  const GameClass =
    typeof exported.default === "function"
      ? exported.default
      : Object.values(exported).find((v) => typeof v === "function")

  if (typeof GameClass !== "function") {
    throw new Error(
      'Your cartridge must export a game class, e.g. `export class MyGame implements Game { ready(engine) {} process(delta, engine) {} }`.',
    )
  }

  const instance = new (GameClass as new () => Game)()
  if (typeof instance.ready !== "function" || typeof instance.process !== "function") {
    throw new Error("Your cartridge class must define ready(engine) and process(delta, engine).")
  }
  return instance
}

export function CartridgeRunner({
  code,
  runToken,
  onLog,
  onError,
  onStarted,
  onExit,
}: CartridgeRunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cbRef = useRef({ onLog, onError, onStarted, onExit })
  cbRef.current = { onLog, onError, onStarted, onExit }
  // Latest code, read at run time so we always compile the current buffer.
  const codeRef = useRef(code)
  codeRef.current = code

  useEffect(() => {
    if (runToken === 0) return // 0 = idle, nothing running yet
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: Coccoon | null = null
    let cancelled = false

    const sandboxConsole = {
      ...console,
      log: (...args: unknown[]) => cbRef.current.onLog("log", args.map(fmt).join(" ")),
      warn: (...args: unknown[]) => cbRef.current.onLog("warn", args.map(fmt).join(" ")),
      error: (...args: unknown[]) => cbRef.current.onLog("error", args.map(fmt).join(" ")),
    } as Console

    const run = () => {
      if (cancelled || !canvasRef.current) return
      try {
        const game = compileCartridge(codeRef.current, sandboxConsole)

        // Wrap process so a runtime error stops the loop and surfaces cleanly
        // instead of throwing every frame.
        const safeGame: Game = {
          ready: (e) => game.ready(e),
          process: (delta, e) => {
            try {
              game.process(delta, e)
            } catch (err) {
              engine?.stop()
              cbRef.current.onError(errText(err))
            }
          },
        }

        engine = new Coccoon(canvasRef.current)
        engine.onEscape = () => cbRef.current.onExit?.()
        try {
          engine.start(safeGame)
        } catch (err) {
          engine.stop()
          cbRef.current.onError(errText(err))
          return
        }
        canvasRef.current.focus()
        cbRef.current.onStarted()
      } catch (err) {
        cbRef.current.onError(errText(err))
      }
    }

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.load('16px "Press Start 2P"').finally(run)
    } else {
      run()
    }

    return () => {
      cancelled = true
      engine?.stop()
    }
    // Re-run whenever the Run button is pressed. Code is read via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runToken])

  return (
    <canvas
      ref={canvasRef}
      width={GRID_W * CELL}
      height={GRID_H * CELL}
      tabIndex={0}
      aria-label="cartridge preview, a 32 by 18 cell grid"
      className="h-auto w-full rounded-lg border border-emerald-900/60 bg-black shadow-xl shadow-emerald-950/50 outline-none [image-rendering:pixelated] focus:ring-2 focus:ring-emerald-500/60"
      style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
    />
  )
}

function fmt(v: unknown): string {
  if (typeof v === "string") return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
