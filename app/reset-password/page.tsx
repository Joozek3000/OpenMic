"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth"
import type { FirebaseError } from "firebase/app"

import { auth } from "@/lib/firebase"
import { isNetworkError } from "@/lib/utils"
import { showToastExternal } from "@/components/toast-provider"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const actionCode = searchParams.get("oobCode")
  const mode = searchParams.get("mode")
  const status = searchParams.get("status")

  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const isInvalidMode = useMemo(() => mode && mode !== "resetPassword", [mode])
  const shouldShowSuccess = status === "complete"

  useEffect(() => {
    if (shouldShowSuccess) {
      setVerifying(false)
      setSuccess(true)
      return
    }

    let isMounted = true

    if (!actionCode || isInvalidMode) {
      setError("This password reset link is invalid or has expired.")
      setVerifying(false)
      return
    }

    verifyPasswordResetCode(auth, actionCode)
      .then((accountEmail) => {
        if (!isMounted) return
        setEmail(accountEmail)
        setVerifying(false)
      })
      .catch((verifyError) => {
        console.error("Failed to verify password reset code", verifyError)
        if (!isMounted) return
        setError("This password reset link is invalid or has expired.")
        setVerifying(false)
      })

    return () => {
      isMounted = false
    }
  }, [actionCode, isInvalidMode, shouldShowSuccess])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!actionCode) {
      setError("Reset link is missing required information.")
      return
    }

    if (!password.trim() || password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setSubmitting(true)

    try {
      await confirmPasswordReset(auth, actionCode, password)
      setSuccess(true)
      showToastExternal("Password updated. You can sign in with your new password.", "success")
      router.replace("/reset-password?status=complete")
    } catch (resetError) {
      console.error("Failed to confirm new password", resetError)
      const code = (resetError as FirebaseError)?.code

      if (code === "auth/weak-password") {
        setError("Password is too weak. Try a longer or more complex password.")
      } else if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        setError("This password reset link is invalid or has expired.")
      } else {
        const message = isNetworkError(resetError)
          ? "Network issue while updating password. Please try again."
          : "Unable to update password right now. Please try again later."
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 text-center text-white shadow-lg">
          <p className="text-sm text-gray-300">Checking your reset link…</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-4">
        <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 text-center text-white shadow-lg">
          <h1 className="text-xl font-semibold">Password updated</h1>
          <p className="mt-2 text-sm text-gray-300">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className="w-full rounded-lg bg-white py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 focus-visible-ring"
              onClick={() => router.push("/")}
            >
              Return to sign in
            </button>
            <Link
              href="/"
              className="text-sm text-gray-400 underline underline-offset-4 hover:text-white focus-visible-ring"
            >
              Go back home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 text-white shadow-lg">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="mt-2 text-sm text-gray-300">
          {email ? `Resetting password for ${email}.` : "Enter a new password to finish resetting your account."}
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-white focus:border-white focus:outline-none focus-visible-ring"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-white focus-visible-ring"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-white focus:border-white focus:outline-none focus-visible-ring"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-white focus-visible-ring"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-white py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible-ring"
            aria-label={submitting ? "Updating password" : "Update password"}
            aria-busy={submitting}
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          <Link href="/" className="underline underline-offset-4 hover:text-white focus-visible-ring">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
