"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { useAuth } from "@/components/auth-provider"
import { getUserProfile, toggleFollow as toggleFollowApi } from "@/lib/data/users"
import { withRetry } from "@/lib/utils"

interface FollowContextValue {
  following: Set<string>
  isFollowing: (userId: string) => boolean
  toggleFollow: (targetId: string) => Promise<void>
  loading: boolean
}

const FollowContext = createContext<FollowContextValue | undefined>(undefined)

export function FollowProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setFollowing(new Set())
      return
    }

    setLoading(true)
    withRetry(() => getUserProfile(user.uid), {
      maxAttempts: 3,
      delayMs: 600,
      backoff: true,
    })
      .then((profile) => {
        if (profile?.following) {
          setFollowing(new Set(profile.following))
        } else {
          setFollowing(new Set())
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  const contextValue = useMemo<FollowContextValue>(() => ({
    following,
    loading,
    isFollowing: (userId: string) => following.has(userId),
    toggleFollow: async (targetId: string) => {
      if (!user || user.uid === targetId) return

      const currentlyFollowing = following.has(targetId)
      setFollowing((prev) => {
        const next = new Set(prev)
        if (currentlyFollowing) {
          next.delete(targetId)
        } else {
          next.add(targetId)
        }
        return next
      })

      try {
        await withRetry(
          async () => {
            await toggleFollowApi(user.uid, targetId, !currentlyFollowing)
          },
          { maxAttempts: 2, delayMs: 400, backoff: false },
        )
      } catch (error) {
        console.error("Failed to toggle follow", error)
        setFollowing((prev) => {
          const next = new Set(prev)
          if (currentlyFollowing) {
            next.add(targetId)
          } else {
            next.delete(targetId)
          }
          return next
        })
      }
    },
  }), [following, loading, user])

  return <FollowContext.Provider value={contextValue}>{children}</FollowContext.Provider>
}

export function useFollow() {
  const context = useContext(FollowContext)
  if (!context) {
    throw new Error("useFollow must be used within a FollowProvider")
  }
  return context
}
