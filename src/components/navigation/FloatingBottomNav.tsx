"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import BottomNav from "@/components/navigation/BottomNav"

export default function FloatingBottomNav() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div
      data-nav-overlay
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "0 1.5rem calc(env(safe-area-inset-bottom) + 0.75rem)",
        pointerEvents: "none",
        zIndex: 2147483647,
      }}
    >
      <div className="pointer-events-auto w-full max-w-xl mx-auto">
        <BottomNav />
      </div>
    </div>,
    document.body
  )
}
