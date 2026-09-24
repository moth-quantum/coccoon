// Shared Atlas API key store.
//
// coccoon holds a single engine-level API key (the Godot menu's key entry,
// read by games via coccoon.get_api_key()). This mirrors that: one key, set
// once (from the menu or a game screen) and read everywhere.
//
// The key is persisted in localStorage so it survives across browser sessions
// (tab closes, restarts) as well as client navigation and reloads. It is only
// ever sent to this app's own server proxy (/api/moth-blur), never to the
// browser's own network directly.

import { useSyncExternalStore } from "react"

const STORAGE_KEY = "coccoon.atlas_api_key"
const listeners = new Set<() => void>()

export function getApiKey(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setApiKey(value: string): void {
  if (typeof window === "undefined") return
  const trimmed = value.trim()
  try {
    if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage failures (private mode, quota) — the value just won't persist
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reactive hook: returns [key, setKey]. */
export function useApiKey(): [string, (value: string) => void] {
  const key = useSyncExternalStore(
    subscribe,
    getApiKey,
    () => "",
  )
  return [key, setApiKey]
}
