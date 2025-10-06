"use client"

import { useEffect, useState } from "react"

interface AuthModalProps {
  open: boolean
  onClose: () => void
  onSignIn: (email: string, password: string) => Promise<void> | void
  onSignUp: (email: string, password: string) => Promise<void> | void
  loading?: boolean
  error?: string | null
}

type AuthMode = "signin" | "signup"

export function AuthModal({ open, onClose, onSignIn, onSignUp, loading = false, error }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!open) {
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setLocalError(null)
      setShowPassword(false)
      setShowConfirmPassword(false)
      setMode("signin")
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.")
      return
    }

    if (mode === "signup" && password !== confirmPassword) {
      setLocalError("Passwords do not match.")
      return
    }

    if (mode === "signin") {
      await onSignIn(email.trim(), password)
    } else {
      await onSignUp(email.trim(), password)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 p-6 shadow-lg">
        <div className="mb-4 text-center">
          <h2 className="text-xl font-semibold text-white">
            {mode === "signin" ? "Sign in to OpenMic" : "Create your OpenMic account"}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Save your stage name, follow comics, and keep your sets synced across devices.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-white focus:outline-none"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-white focus:border-white focus:outline-none"
                placeholder="••••••••"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-white"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-white focus:border-white focus:outline-none"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-white"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {(localError || error) && <p className="text-sm text-red-400">{localError ?? error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="underline underline-offset-4 hover:text-white"
            type="button"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
          <button onClick={onClose} className="underline underline-offset-4 hover:text-white" type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
