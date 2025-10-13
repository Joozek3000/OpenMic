"use client"

import { useEffect, useRef, type RefObject } from "react"

const FOCUSABLE_SELECTORS =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap<T extends HTMLElement>(containerRef: RefObject<T>, isActive: boolean) {
  const previousFocusedElementRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!isActive) {
      return
    }

    const container = containerRef.current
    if (!container) {
      return
    }

    previousFocusedElementRef.current = document.activeElement

    const focusableElements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
      (element) => !element.hasAttribute("data-focus-guard"),
    )

    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    } else {
      container.focus({ preventScroll: true })
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return
      }

      const currentFocusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)).filter(
        (element) => !element.hasAttribute("data-focus-guard"),
      )
      if (currentFocusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = currentFocusable[0]
      const last = currentFocusable[currentFocusable.length - 1]
      const activeElement = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      const previous = previousFocusedElementRef.current as HTMLElement | null
      if (previous && typeof previous.focus === "function") {
        previous.focus({ preventScroll: true })
      }
    }
  }, [containerRef, isActive])
}
