"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/auth-provider"
import { FiltersProvider } from "@/components/filters-provider"
import { FollowProvider } from "@/components/follow-provider"
import { PostsProvider } from "@/components/posts-provider"
import { PlaybackSettingsProvider } from "@/components/playback-settings-provider"
import { ToastProvider } from "@/components/toast-provider"
import { ConnectionStatusIndicator } from "@/components/connection-status-indicator"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <FollowProvider>
          <PostsProvider>
            <PlaybackSettingsProvider>
              {/* FiltersProvider shares category state across Search & Explore tabs. */}
              <FiltersProvider>
                {children}
                <ConnectionStatusIndicator />
              </FiltersProvider>
            </PlaybackSettingsProvider>
          </PostsProvider>
        </FollowProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
