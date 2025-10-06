"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "firebase/auth"
import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type UserCredential,
} from "firebase/auth"

import { auth } from "@/lib/firebase"
import { ensureUserProfile } from "@/lib/data/users"

interface AuthContextValue {
  user: User | null
  loading: boolean
  error?: string
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [pendingCredential, setPendingCredential] = useState<UserCredential | null>(null)

  useEffect(() => {
    let isMounted = true

    // Watch Firebase auth for sign-in changes; anonymous users are bootstrapped automatically.
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

      const isAnonymous = firebaseUser.isAnonymous || firebaseUser.providerData.length === 0

      if (!isAnonymous) {
        try {
          await ensureUserProfile(firebaseUser.uid)
        } catch (profileError) {
          console.error("Failed to ensure user profile", profileError)
        }
      }

      if (!isMounted) return

      // Once we reach this point the app can safely render gated features.
      setUser(firebaseUser)
      setLoading(false)
      setError(undefined)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(undefined)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      setPendingCredential(credential)
    } catch (authError) {
      console.error("Failed to sign in", authError)
      setError("Sign-in failed. Check your credentials and try again.")
      setLoading(false)
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth.currentUser) {
      setError("No user session available. Please refresh the page.")
      return
    }

    setLoading(true)
    setError(undefined)
    try {
      const credential = EmailAuthProvider.credential(email, password)
      const linked = await linkWithCredential(auth.currentUser, credential)
      setPendingCredential(linked)
    } catch (linkError) {
      console.error("Failed to create account", linkError)
      if ((linkError as { code?: string })?.code === "auth/credential-already-in-use") {
        setError("This email is already linked to another profile.")
      } else {
        setError("Could not create account. Please try again.")
      }
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!pendingCredential) return

    const commit = async () => {
      try {
        await ensureUserProfile(pendingCredential.user.uid)
      } finally {
        setPendingCredential(null)
        setLoading(false)
      }
    }

    void commit()
  }, [pendingCredential])

  const logout = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      await signOut(auth)
      await signInAnonymously(auth)
    } catch (logoutError) {
      console.error("Failed to log out", logoutError)
      setError("Could not log out. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      signIn,
      signUp,
      logout,
    }),
    [user, loading, error, signIn, signUp, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
