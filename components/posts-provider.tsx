"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore"

import { fetchMorePosts, listenToPosts } from "@/lib/data/posts"
import type { ConnectionInfo, ConnectionStatus, Post, PostsContextValue } from "@/lib/types"
import { getErrorMessage, getMobileOptimizations, isRetryableError } from "@/lib/utils"

const PostsContext = createContext<PostsContextValue | undefined>(undefined)

// Retry policy for transient network/Firestore listener failures.
const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 1000

function getRetryDelay(attempt: number) {
  return INITIAL_RETRY_DELAY * Math.pow(2, attempt)
}

function mergeUniquePosts(current: Post[], incoming: Post[]) {
  if (incoming.length === 0) return current
  const currentIds = new Set(current.map((post) => post.id))
  const additions = incoming.filter((post) => !currentIds.has(post.id))
  return additions.length > 0 ? [...current, ...additions] : current
}

export function PostsProvider({ children }: { children: ReactNode }) {
  // Store live feed state from Firestore; UI reads this context everywhere.
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [connectionMessage, setConnectionMessage] = useState<string | undefined>(undefined)
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [listenerStalled, setListenerStalled] = useState(false)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting")

  // Device/network-aware tuning loaded once to keep behavior stable during a session.
  const optimizationRef = useRef(getMobileOptimizations())
  const initialPageSize = optimizationRef.current.initialPageSize

  // Mutable refs hold values needed by async callbacks without re-rendering.
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const connectionMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postsRef = useRef<Post[]>([])

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  const clearConnectionMessageTimer = useCallback(() => {
    if (connectionMessageTimeoutRef.current) {
      clearTimeout(connectionMessageTimeoutRef.current)
      connectionMessageTimeoutRef.current = null
    }
  }, [])

  const setupListenerWithRetry = useCallback(
    (attempt = 0) => {
      // Always tear down previous subscription before creating a new one.
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }

      clearRetryTimer()

      setRetryCount(attempt)
      if (attempt > 0) {
        setIsRetrying(true)
        setConnectionStatus("retrying")
      } else {
        setIsRetrying(false)
        setListenerStalled(false)
        setConnectionStatus(postsRef.current.length > 0 ? "online" : "connecting")
      }

      if (postsRef.current.length === 0) {
        setLoading(true)
      }

      // Single subscription entry point with retry/backoff and timeout recovery.
      const unsubscribe = listenToPosts(
        (postList, lastDocument) => {
          // Preserve paginated items already loaded while replacing "top of feed" live snapshot.
          const baseIds = new Set(postList.map((post) => post.id))
          const appended = postsRef.current.filter((post) => !baseIds.has(post.id))
          const combinedPosts = [...postList, ...appended]
          postsRef.current = combinedPosts
          setPosts(combinedPosts)
          setLoading(false)
          setError(undefined)
          setIsRetrying(false)
          setListenerStalled(false)
          setRetryCount(0)
          clearRetryTimer()
          setConnectionStatus("online")
          setConnectionMessage(undefined)
          setLastDoc(lastDocument)
          const more = Boolean(lastDocument) && postList.length >= initialPageSize
          setHasMore(more)
        },
        (firestoreError) => {
          // Listener hard error path (permission, unavailable, etc).
          const clearListener = () => {
            unsubscribe()
            unsubscribeRef.current = null
          }

          const retryLater = (nextAttempt: number) => {
            setIsRetrying(true)
            setError(undefined)
            setConnectionStatus("retrying")
            clearRetryTimer()
            retryTimeoutRef.current = setTimeout(() => {
              setupListenerWithRetry(nextAttempt)
            }, getRetryDelay(attempt))
          }

          const retryable = isRetryableError(firestoreError)
          const message = getErrorMessage(firestoreError)

          if (retryable && attempt < MAX_RETRY_ATTEMPTS) {
            const nextAttempt = attempt + 1
            clearListener()
            retryLater(nextAttempt)
            return
          }

          clearListener()
          setIsRetrying(false)
          setListenerStalled(false)
          setConnectionStatus("error")
          setError(message || "Can't load feed. Try again.")
          setLoading(false)
        },
        () => {
          // Initial snapshot timeout path: no explicit Firestore error, but stream appears stalled.
          const clearListener = () => {
            unsubscribe()
            unsubscribeRef.current = null
          }

          const retryLater = (nextAttempt: number) => {
            setListenerStalled(true)
            setError(undefined)
            setConnectionStatus("retrying")
            clearRetryTimer()
            retryTimeoutRef.current = setTimeout(() => {
              setupListenerWithRetry(nextAttempt)
            }, getRetryDelay(attempt))
          }

          if (attempt < MAX_RETRY_ATTEMPTS) {
            const nextAttempt = attempt + 1
            clearListener()
            retryLater(nextAttempt)
            return
          }

          clearListener()
          setListenerStalled(true)
          setIsRetrying(false)
          setConnectionStatus("error")
          setError("Connection timed out. Check network.")
          setLoading(false)
        },
        { limit: initialPageSize },
      )

      unsubscribeRef.current = unsubscribe
    },
    [clearRetryTimer, initialPageSize],
  )

  const loadMorePosts = useCallback(async () => {
    // Pagination is cursor-based; this avoids loading full feed repeatedly.
    if (loadingMore || !hasMore || !lastDoc) {
      return
    }

    setLoadingMore(true)
    try {
      const { posts: nextPosts, lastDoc: nextCursor, hasMore: more } = await fetchMorePosts(lastDoc, initialPageSize)
      setLastDoc(nextCursor)
      if (nextPosts.length > 0) {
        const merged = mergeUniquePosts(postsRef.current, nextPosts)
        postsRef.current = merged
        setPosts(merged)
        setHasMore(more)
        setError(undefined)
        setConnectionStatus("online")
      } else {
        setHasMore(false)
      }
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, initialPageSize, lastDoc, loadingMore])

  useEffect(() => {
    // Browser network events are used as signals to reset/restart listeners.
    const handleOnline = () => {
      clearConnectionMessageTimer()
      setConnectionMessage("Connection restored")
      connectionMessageTimeoutRef.current = setTimeout(() => setConnectionMessage(undefined), 3000)
      setRetryCount(0)
      setListenerStalled(false)
      setError(undefined)
      setConnectionStatus("connecting")
      setupListenerWithRetry(0)
    }
    const handleOffline = () => {
      clearConnectionMessageTimer()
      setConnectionMessage("Offline. Changes won't sync.")
      setConnectionStatus("offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      clearConnectionMessageTimer()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [clearConnectionMessageTimer, setupListenerWithRetry])

  useEffect(() => {
    // Initial listener setup on mount.
    setupListenerWithRetry(0)

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      clearRetryTimer()
      postsRef.current = []
      clearConnectionMessageTimer()
    }
  }, [clearConnectionMessageTimer, clearRetryTimer, setupListenerWithRetry])

  const contextualError = useMemo(() => {
    // Priority order: reconnecting status > stalled state > concrete error > transient connection note.
    if (isRetrying) {
      const attemptNumber = Math.min(retryCount + 1, MAX_RETRY_ATTEMPTS + 1)
      return `Reconnecting… (${attemptNumber}/${MAX_RETRY_ATTEMPTS + 1})`
    }

    if (listenerStalled && loading) {
      return "Connection timed out. Retrying..."
    }

    return error ?? connectionMessage
  }, [connectionMessage, error, isRetrying, listenerStalled, loading, retryCount])

  const connectionInfo: ConnectionInfo = useMemo(
    () => ({
      status: connectionStatus,
      message: contextualError,
      retryCount,
      maxRetries: MAX_RETRY_ATTEMPTS + 1,
    }),
    [connectionStatus, contextualError, retryCount],
  )

  const value = useMemo<PostsContextValue>(
    () => ({
      posts,
      loading,
      error: contextualError,
      connectionStatus,
      connectionInfo,
      loadMorePosts,
      hasMore,
      loadingMore,
    }),
    [connectionInfo, connectionStatus, contextualError, hasMore, loadMorePosts, loading, loadingMore, posts],
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
