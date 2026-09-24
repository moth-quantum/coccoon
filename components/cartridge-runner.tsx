"use client"

import { useEffect, useRef } from "react"
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

// Build a Game from user source. Throws on compile error or if the required
// entry points are missing.
function compileCartridge(code: string, sandboxConsole: Console): Game {
  const factory = new Function(
    "ImageList",
    "Sprite",
    "Text",
    "color",
    "Colors",
    "GRID_W",
    "GRID_H",
    "SoundList",
    "Sound",
    "LOOP",
    "MicroMoth",
    "console",
    `"use strict";
${code}
if (typeof ready !== "function" || typeof process !== "function") {
  throw new Error("Your cartridge must define ready(engine) and process(delta, engine).");
}
return { ready: ready, process: process };`,
  )

  return factory(
    ImageList,
    Sprite,
    Text,
    color,
    Colors,
    GRID_W,
    GRID_H,
    SoundList,
    Sound,
    LOOP,
    MicroMoth,
    sandboxConsole,
  ) as Game
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
