"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { listenToPosts } from "@/lib/data/posts"
import type { Post } from "@/lib/types"
import { getErrorMessage, isNetworkError } from "@/lib/utils"

interface PostsContextValue {
  posts: Post[]
  loading: boolean
  error?: string
}

const PostsContext = createContext<PostsContextValue | undefined>(undefined)

export function PostsProvider({ children }: { children: ReactNode }) {
  // Store the live results from the Firestore subscription.
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [connectionMessage, setConnectionMessage] = useState<string | undefined>(undefined)

  useEffect(() => {
    const handleOnline = () => {
      setConnectionMessage("Connection restored")
      setTimeout(() => setConnectionMessage(undefined), 3000)
    }
    const handleOffline = () => {
      setConnectionMessage("You are offline. Changes may not sync.")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    // Firestore gives us realtime updates; unsubscribe when the component unmounts.
    const unsubscribe = listenToPosts(
      (postList) => {
        setPosts(postList)
        setLoading(false)
        setError(undefined)
      },
      (firestoreError) => {
        console.error("Failed to listen to posts", firestoreError)
        const message = isNetworkError(firestoreError)
          ? "Connection lost. Posts will refresh when you’re back online."
          : getErrorMessage(firestoreError)
        setError(message)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [])

  const value = useMemo<PostsContextValue>(
    () => ({ posts, loading, error: error ?? connectionMessage }),
    [posts, loading, error, connectionMessage],
  )

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>
}

export function usePostsContext() {
  const context = useContext(PostsContext)
  if (!context) {
    throw new Error("usePostsContext must be used within a PostsProvider")
  }
  return context
}
