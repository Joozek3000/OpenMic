"use client"

import { useCallback, useMemo } from "react"

type VibrationPattern = number | number[]

const SUPPORTS_VIBRATION = typeof navigator !== "undefined" && "vibrate" in navigator

function vibrate(pattern: VibrationPattern) {
  if (!SUPPORTS_VIBRATION) return
  try {
    navigator.vibrate(pattern)
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Vibration failed", error)
    }
  }
}

export function useHapticFeedback() {
  const light = useCallback(() => {
    vibrate(10)
  }, [])

  const medium = useCallback(() => {
    vibrate(20)
  }, [])

  const heavy = useCallback(() => {
    vibrate(30)
  }, [])

  const success = useCallback(() => {
    vibrate([10, 50, 10])
  }, [])

  const error = useCallback(() => {
    vibrate([20, 100, 20])
  }, [])

  return useMemo(
    () => ({
      isSupported: SUPPORTS_VIBRATION,
      light,
      medium,
      heavy,
      success,
      error,
    }),
    [heavy, light, medium, success, error],
  )
}
