"use client"

import { useEffect, useRef } from "react"

type KeyboardNavigationConfig = {
  onNext?: () => void
  onPrevious?: () => void
  onSelect?: () => void
  onFirst?: () => void
  onLast?: () => void
  enabled?: boolean
  axis?: "horizontal" | "vertical" | "both"
}

export function useKeyboardNavigation({
  onNext,
  onPrevious,
  onSelect,
  onFirst,
  onLast,
  enabled = true,
  axis = "both",
}: KeyboardNavigationConfig) {
  const handlersRef = useRef({ onNext, onPrevious, onSelect, onFirst, onLast })
  handlersRef.current = { onNext, onPrevious, onSelect, onFirst, onLast }

  useEffect(() => {
    if (!enabled) {
      return
    }

    const allowHorizontal = axis === "horizontal" || axis === "both"
    const allowVertical = axis === "vertical" || axis === "both"

    const handleKeyDown = (event: KeyboardEvent) => {
      const { onNext, onPrevious, onSelect, onFirst, onLast } = handlersRef.current

      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          if ((event.key === "ArrowDown" && allowVertical) || (event.key === "ArrowRight" && allowHorizontal)) {
            if (onNext) {
              event.preventDefault()
              onNext()
            }
          }
          break
        case "ArrowUp":
        case "ArrowLeft":
          if ((event.key === "ArrowUp" && allowVertical) || (event.key === "ArrowLeft" && allowHorizontal)) {
            if (onPrevious) {
              event.preventDefault()
              onPrevious()
            }
          }
          break
        case "Home":
          if (onFirst) {
            event.preventDefault()
            onFirst()
          }
          break
        case "End":
          if (onLast) {
            event.preventDefault()
            onLast()
          }
          break
        case "Enter":
        case " ":
          if (onSelect) {
            event.preventDefault()
            onSelect()
          }
          break
        default:
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [enabled])
}
