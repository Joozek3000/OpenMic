"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

interface PlaybackPreferences {
  autoplay: boolean
  startMuted: boolean
  loop: boolean
}

interface PlaybackSettingsContextValue {
  preferences: PlaybackPreferences
  setPreference: <K extends keyof PlaybackPreferences>(key: K, value: PlaybackPreferences[K]) => void
  reset: () => void
}

const DEFAULT_PREFERENCES: PlaybackPreferences = {
  autoplay: true,
  startMuted: true,
  loop: true,
}

const STORAGE_KEY = "openmic:playback-preferences"

const PlaybackSettingsContext = createContext<PlaybackSettingsContextValue | undefined>(undefined)

function readStoredPreferences(): PlaybackPreferences | null {
  if (typeof window === "undefined") return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<PlaybackPreferences>
    return { ...DEFAULT_PREFERENCES, ...parsed }
  } catch (error) {
    console.warn("Failed to read playback preferences", error)
    return null
  }
}

export function PlaybackSettingsProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<PlaybackPreferences>(DEFAULT_PREFERENCES)

  useEffect(() => {
    const stored = readStoredPreferences()
    if (stored) {
      setPreferences(stored)
    }
  }, [])

  const persist = useCallback((next: PlaybackPreferences) => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.warn("Failed to persist playback preferences", error)
    }
  }, [])

  const setPreference = useCallback<PlaybackSettingsContextValue["setPreference"]>((key, value) => {
    setPreferences((current) => {
      if (current[key] === value) return current
      const next = { ...current, [key]: value }
      persist(next)
      return next
    })
  }, [persist])

  const reset = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    persist(DEFAULT_PREFERENCES)
  }, [persist])

  const value = useMemo<PlaybackSettingsContextValue>(
    () => ({ preferences, setPreference, reset }),
    [preferences, setPreference, reset],
  )

  return <PlaybackSettingsContext.Provider value={value}>{children}</PlaybackSettingsContext.Provider>
}

export function usePlaybackSettings() {
  const context = useContext(PlaybackSettingsContext)
  if (!context) {
    throw new Error("usePlaybackSettings must be used within a PlaybackSettingsProvider")
  }
  return context
}
