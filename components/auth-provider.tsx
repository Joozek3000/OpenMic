"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { User } from "firebase/auth"
import {
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type ActionCodeSettings,
  type UserCredential,
} from "firebase/auth"
import type { FirebaseError } from "firebase/app"

import { auth } from "@/lib/firebase"
import { ensureUserProfile } from "@/lib/data/users"
import { showToastExternal } from "@/components/toast-provider"
import { getErrorMessage, isNetworkError, withRetry } from "@/lib/utils"

interface AuthContextValue {
  user: User | null
  loading: boolean
  error?: string
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function resolveResetContinueUrl(origin: string) {
  // In local development, always use the live origin (port can change between 3000/3001).
  try {
    const current = new URL(origin)
    if (current.hostname === "localhost" || current.hostname === "127.0.0.1") {
      return new URL("/reset-password", current).toString()
    }
  } catch {
    // Fall through to env-based parsing.
  }

  // Prefer an explicit app URL when provided, but sanitize accidental annotations.
  const raw = process.env.NEXT_PUBLIC_APP_URL
  const normalized = raw?.split("->").pop()?.trim() ?? ""
  if (normalized) {
    try {
      return new URL("/reset-password", normalized).toString()
    } catch {
      // Ignore invalid env values and fall back to current origin.
    }
  }
  return new URL("/reset-password", origin).toString()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // `user` can be anonymous or fully registered; both are valid sessions for this app.
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
          await withRetry(() => signInAnonymously(auth), { maxAttempts: 3, delayMs: 800, backoff: true })
        } catch (authError) {
          console.error("Anonymous sign-in failed", authError)
          if (isMounted) {
            const message = isNetworkError(authError)
              ? "Unable to reach OpenMic. Check your connection and retry."
              : "Unable to sign in. Please try again later."
            setError(message)
            showToastExternal(message, "error")
            setLoading(false)
          }
        }
        return
      }

      const isAnonymous = firebaseUser.isAnonymous || firebaseUser.providerData.length === 0

      if (!isAnonymous) {
        try {
          await withRetry(() => ensureUserProfile(firebaseUser.uid), { maxAttempts: 3, delayMs: 600, backoff: true })
        } catch (profileError) {
          console.error("Failed to ensure user profile", profileError)
          const message = isNetworkError(profileError)
            ? "Connection interrupted while syncing your profile."
            : getErrorMessage(profileError)
          showToastExternal(message, "error")
          setError(message)
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
      // Defer profile syncing to the pendingCredential effect so sign-in and sign-up share one code path.
      setPendingCredential(credential)
    } catch (authError) {
      console.error("Failed to sign in", authError)
      const message = isNetworkError(authError)
        ? "Network issue while signing in. Please try again."
        : "Sign-in failed. Check your credentials and try again."
      setError(message)
      showToastExternal(message, "error")
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
      // This upgrades the current anonymous user into an email/password account.
      const linked = await linkWithCredential(auth.currentUser, credential)
      setPendingCredential(linked)
    } catch (linkError) {
      console.error("Failed to create account", linkError)
      if ((linkError as { code?: string })?.code === "auth/credential-already-in-use") {
        setError("This email is already linked to another profile.")
      } else {
        const message = isNetworkError(linkError)
          ? "Network issue while creating account. Please try again."
          : "Could not create account. Please try again."
        setError(message)
        showToastExternal(message, "error")
      }
      setLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    setError(undefined)

    const defaultMessage =
      "If an account exists for that email, you'll receive a password reset link shortly."

    try {
      let actionSettings: ActionCodeSettings | undefined

      if (typeof window !== "undefined") {
        actionSettings = {
          url: resolveResetContinueUrl(window.location.origin),
          handleCodeInApp: true,
        }
      }

      await sendPasswordResetEmail(auth, email, actionSettings)
      showToastExternal(defaultMessage, "success")
      return { success: true, message: defaultMessage }
    } catch (authError) {
      console.error("Failed to send password reset email", authError)
      const code = (authError as FirebaseError)?.code

      if (code === "auth/user-not-found") {
        showToastExternal(defaultMessage, "success")
        return { success: true, message: defaultMessage }
      }

      const message = isNetworkError(authError)
        ? "Network issue while sending reset link. Please try again."
        : "Unable to send reset link right now. Please try again later."

      setError(message)
      showToastExternal(message, "error")
      return { success: false, message }
    }
  }, [])

  useEffect(() => {
    if (!pendingCredential) return

    // Run profile creation once Firebase confirms authentication succeeded.
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
      const message = isNetworkError(logoutError)
        ? "Network issue while signing out. Please try again."
        : "Could not log out. Please try again."
      setError(message)
      showToastExternal(message, "error")
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
      resetPassword,
    }),
    [user, loading, error, signIn, signUp, logout, resetPassword],
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
