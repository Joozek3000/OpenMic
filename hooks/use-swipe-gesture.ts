"use client"

import { useCallback, useRef } from "react"

interface UseSwipeGestureOptions {
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
  enabled?: boolean
}

interface SwipeHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
}

const DEFAULT_THRESHOLD = 50
const MIN_VELOCITY = 0.3

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  threshold = DEFAULT_THRESHOLD,
  enabled = true,
}: UseSwipeGestureOptions): SwipeHandlers {
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startTimeRef = useRef(0)
  const isSwipingRef = useRef(false)

  const reset = useCallback(() => {
    startXRef.current = 0
    startYRef.current = 0
    startTimeRef.current = 0
    isSwipingRef.current = false
  }, [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || (event.pointerType !== "touch" && event.pointerType !== "pen")) return
      startXRef.current = event.clientX
      startYRef.current = event.clientY
      startTimeRef.current = event.timeStamp
      isSwipingRef.current = false
    },
    [enabled],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || startTimeRef.current === 0) return
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        reset()
        return
      }
      const deltaX = event.clientX - startXRef.current
      const deltaY = event.clientY - startYRef.current

      if (!isSwipingRef.current && Math.abs(deltaY) > 10) {
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          isSwipingRef.current = true
        } else {
          reset()
        }
      }

      if (isSwipingRef.current) {
        event.preventDefault()
      }
    },
    [enabled, reset],
  )

  const finishSwipe = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled || startTimeRef.current === 0) {
        reset()
        return
      }

      const deltaX = event.clientX - startXRef.current
      const deltaY = event.clientY - startYRef.current
      const elapsed = event.timeStamp - startTimeRef.current
      const velocity = elapsed > 0 ? Math.abs(deltaY) / elapsed : 0

      if (
        Math.abs(deltaY) >= threshold &&
        Math.abs(deltaY) > Math.abs(deltaX) &&
        velocity >= MIN_VELOCITY
      ) {
        if (deltaY < 0) {
          onSwipeUp?.()
        } else {
          onSwipeDown?.()
        }
      }

      reset()
    },
    [enabled, onSwipeDown, onSwipeUp, reset, threshold],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        reset()
        return
      }
      finishSwipe(event)
    },
    [finishSwipe],
  )

  const onPointerCancel = useCallback(() => {
    reset()
  }, [reset])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  }
}
