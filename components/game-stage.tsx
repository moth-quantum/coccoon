"use client"

import { useEffect, useRef } from "react"
import { Coccoon, GRID_W, GRID_H, CELL, type Game } from "@/lib/coccoon"

type GameStageProps = {
  createGame: () => Game
  onExit?: () => void
}

export function GameStage({ createGame, onExit }: GameStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: Coccoon | null = null
    let cancelled = false

    // Ensure the retro font is ready so canvas text renders with it, then start.
    const startEngine = () => {
      if (cancelled || !canvasRef.current) return
      engine = new Coccoon(canvasRef.current)
      engine.onEscape = () => onExitRef.current?.()
      engine.start(createGame())
      canvasRef.current.focus()
    }

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.load('16px "Press Start 2P"').finally(startEngine)
    } else {
      startEngine()
    }

    return () => {
      cancelled = true
      engine?.stop()
    }
  }, [createGame])

  return (
    <div className="flex w-full justify-center">
      <canvas
        ref={canvasRef}
        width={GRID_W * CELL}
        height={GRID_H * CELL}
        tabIndex={0}
        aria-label="coccoon game viewport, a 32 by 18 cell grid"
        className="h-auto w-full max-w-[1100px] rounded-lg border border-emerald-900/60 bg-black shadow-2xl shadow-emerald-950/50 outline-none [image-rendering:pixelated] focus:ring-2 focus:ring-emerald-500/60"
        style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
      />
    </div>
  )
}
