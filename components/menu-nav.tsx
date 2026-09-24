"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Lets the menu be driven with the same inputs the games use: the d-pad
// (arrows / WASD), a gamepad d-pad or left stick, and a "start"/confirm action
// (Space / Enter, or the gamepad A / Start buttons). Text fields such as the
// API-key input keep normal keyboard behaviour — navigation keys are ignored
// while an input or textarea is focused so typing an "s" doesn't move the menu.

function items(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-menu-item]"))
}

function typingInField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable
}

export function MenuNav() {
  const router = useRouter()

  useEffect(() => {
    const list = () => items()

    const move = (dir: 1 | -1) => {
      const els = list()
      if (els.length === 0) return
      const idx = els.indexOf(document.activeElement as HTMLElement)
      // If nothing is focused yet, entering from the top goes to the first
      // item and from the bottom to the last.
      const next = idx === -1 ? (dir === 1 ? 0 : els.length - 1) : (idx + dir + els.length) % els.length
      els[next]?.focus()
    }

    const activate = () => {
      const els = list()
      const idx = els.indexOf(document.activeElement as HTMLElement)
      if (idx === -1) {
        els[0]?.focus()
        return
      }
      els[idx]?.click()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (typingInField()) return
      switch (e.code) {
        case "ArrowUp":
        case "ArrowLeft":
        case "KeyW":
        case "KeyA":
          e.preventDefault()
          move(-1)
          break
        case "ArrowDown":
        case "ArrowRight":
        case "KeyS":
        case "KeyD":
          e.preventDefault()
          move(1)
          break
        case "Enter":
        case "Space":
          e.preventDefault()
          activate()
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)

    // Gamepad: poll each frame and act on button/axis *edges* so a held
    // direction advances one item per press rather than racing through all.
    let raf = 0
    let prevDir = 0 // -1 up, 1 down, 0 neutral
    let prevActivate = false

    const poll = () => {
      const pads = navigator.getGamepads?.() ?? []
      let dir = 0
      let act = false
      for (const pad of pads) {
        if (!pad) continue
        const b = pad.buttons
        const up = b[12]?.pressed || (pad.axes[1] ?? 0) < -0.5
        const down = b[13]?.pressed || (pad.axes[1] ?? 0) > 0.5
        const left = b[14]?.pressed || (pad.axes[0] ?? 0) < -0.5
        const right = b[15]?.pressed || (pad.axes[0] ?? 0) > 0.5
        if (up || left) dir = -1
        else if (down || right) dir = 1
        // A (0) or Start (9) confirm the highlighted item.
        if (b[0]?.pressed || b[9]?.pressed) act = true
      }

      if (dir !== 0 && dir !== prevDir) move(dir as 1 | -1)
      prevDir = dir

      if (act && !prevActivate) activate()
      prevActivate = act

      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
      cancelAnimationFrame(raf)
    }
  }, [router])

  return null
}
