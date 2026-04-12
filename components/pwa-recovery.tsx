"use client"

import { useEffect } from "react"

const PWA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PWA === "true"
const RECOVERY_FLAG_KEY = "openmic:pwa-recovery-ran"

export function PwaRecovery() {
  useEffect(() => {
    if (PWA_ENABLED) return
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    if (window.localStorage.getItem(RECOVERY_FLAG_KEY) === "1") return

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      } catch (error) {
        console.warn("Unable to unregister legacy service workers", error)
      }

      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map((name) => caches.delete(name)))
        } catch (error) {
          console.warn("Unable to clear legacy caches", error)
        }
      }

      window.localStorage.setItem(RECOVERY_FLAG_KEY, "1")
      window.location.reload()
    })()
  }, [])

  return null
}
