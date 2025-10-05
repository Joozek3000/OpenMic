"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { listenToPosts } from "@/lib/data/posts"
import type { Post } from "@/lib/types"

interface PostsContextValue {
  posts: Post[]
  loading: boolean
  error?: string
}

const PostsContext = createContext<PostsContextValue | undefined>(undefined)

export function PostsProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = listenToPosts(
      (postList) => {
        setPosts(postList)
        setLoading(false)
        setError(undefined)
      },
      (firestoreError) => {
        console.error("Failed to listen to posts", firestoreError)
        setError(firestoreError.message)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const value = useMemo<PostsContextValue>(() => ({ posts, loading, error }), [posts, loading, error])

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

export function usePostsContext() {
  const context = useContext(PostsContext)
  if (!context) {
    throw new Error("usePostsContext must be used within a PostsProvider")
  }
  return context
}
