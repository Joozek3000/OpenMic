"use client"

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/auth-provider"
import { useFollow } from "@/components/follow-provider"

interface DevToolsOverlayProps {
  onRequestAuth: () => void
}

const isProduction = process.env.NODE_ENV === "production"

export function DevToolsOverlay({ onRequestAuth }: DevToolsOverlayProps) {
  const { user, logout, loading: authLoading, error } = useAuth()
  const { following } = useFollow()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (isProduction) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.code === "KeyD") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const followingList = useMemo(() => Array.from(following), [following])

  if (isProduction) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4 text-sm text-white">
      <div
        className="pointer-events-auto max-w-xs rounded-2xl border border-white/10 bg-black/80 p-4 shadow-xl backdrop-blur"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ opacity: open || hovered ? 1 : 0.2, transition: "opacity 150ms ease" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dev Tools</h3>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="rounded bg-white/10 px-2 py-0.5 text-xs font-medium hover:bg-white/20"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>

        {open && (
          <div className="space-y-3">
            <section className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Status</span>
                <span className="text-white">{authLoading ? "Loading" : user?.isAnonymous ? "Anonymous" : "Signed in"}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>UID</span>
                <span className="max-w-[8rem] truncate text-white" title={user?.uid}>
                  {user?.uid ?? "—"}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Email</span>
                <span className="max-w-[8rem] truncate text-white" title={user?.email ?? "—"}>
                  {user?.email ?? "—"}
                </span>
              </div>
            </section>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <section className="space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Following</span>
                <span className="text-white">{followingList.length}</span>
              </div>
              {followingList.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded bg-white/5 p-2 text-[11px] text-gray-300">
                  {followingList.map((uid) => (
                    <div key={uid} className="truncate" title={uid}>
                      {uid}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-2 text-xs">
              <button
                type="button"
                onClick={() => onRequestAuth()}
                className="rounded bg-white/10 px-3 py-1 font-semibold uppercase tracking-wide hover:bg-white/20"
              >
                Open Auth Modal
              </button>
              <button
                type="button"
                onClick={() => {
                  void logout()
                }}
                className="rounded bg-white/10 px-3 py-1 font-semibold uppercase tracking-wide hover:bg-white/20"
              >
                {user?.isAnonymous ? "Refresh Anonymous" : "Sign Out"}
              </button>
            </section>

            <p className="text-[10px] text-gray-500">
              Shift + D toggles this panel. Hidden in production builds.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
