"use client"

import { useEffect, useState } from "react"

import { getDisplayName } from "@/lib/data/users"

export function useDisplayName(userId?: string) {
  const [displayName, setDisplayName] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setDisplayName(null)
      return
    }

    let isMounted = true

    getDisplayName(userId)
      .then((name) => {
        if (!isMounted) return
        setDisplayName(name ?? null)
      })
      .catch((error) => {
        console.error("Failed to fetch display name", error)
      })

    return () => {
      isMounted = false
    }
  }, [userId])

  return displayName
}
