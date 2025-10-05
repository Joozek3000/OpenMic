"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/auth-provider"
import { FiltersProvider } from "@/components/filters-provider"
import { FollowProvider } from "@/components/follow-provider"
import { PostsProvider } from "@/components/posts-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FollowProvider>
        <PostsProvider>
          {/* FiltersProvider shares category state across Search & Explore tabs. */}
          <FiltersProvider>{children}</FiltersProvider>
        </PostsProvider>
      </FollowProvider>
    </AuthProvider>
  )
}
