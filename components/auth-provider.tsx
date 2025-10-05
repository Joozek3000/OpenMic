"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "firebase/auth"
import { onAuthStateChanged, signInAnonymously } from "firebase/auth"

import { auth } from "@/lib/firebase"
import { ensureUserProfile } from "@/lib/data/users"

interface AuthContextValue {
  user: User | null
  loading: boolean
  error?: string
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let isMounted = true

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return

      if (!firebaseUser) {
        try {
          setLoading(true)
          await signInAnonymously(auth)
        } catch (authError) {
          console.error("Anonymous sign-in failed", authError)
          if (isMounted) {
            setError("Unable to sign in. Please try again later.")
            setLoading(false)
          }
        }
        return
      }

      try {
        await ensureUserProfile(firebaseUser.uid)
      } catch (profileError) {
        console.error("Failed to ensure user profile", profileError)
      }

      if (!isMounted) return

      setUser(firebaseUser)
      setLoading(false)
      setError(undefined)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ user, loading, error }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
