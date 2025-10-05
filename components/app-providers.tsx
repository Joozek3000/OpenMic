"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/auth-provider"
import { FiltersProvider } from "@/components/filters-provider"
import { PostsProvider } from "@/components/posts-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PostsProvider>
        <FiltersProvider>{children}</FiltersProvider>
      </PostsProvider>
    </AuthProvider>
  )
}
