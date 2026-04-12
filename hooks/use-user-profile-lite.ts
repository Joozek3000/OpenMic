"use client"

import { useEffect, useState } from "react"

import { getUserProfileLite } from "@/lib/data/users"
import type { UserProfile } from "@/lib/types"

export function useUserProfileLite(userId?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }

    let isMounted = true

    getUserProfileLite(userId)
      .then((nextProfile) => {
        if (!isMounted) return
        setProfile(nextProfile ?? null)
      })
      .catch((error) => {
        console.error("Failed to load user profile", error)
      })

    return () => {
      isMounted = false
    }
  }, [userId])

  return profile
}
