"use client"

import type { ReactNode } from "react"

import { AuthProvider } from "@/components/auth-provider"
import { PostsProvider } from "@/components/posts-provider"

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PostsProvider>{children}</PostsProvider>
    </AuthProvider>
  )
}
