"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { Upload } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { useFollow } from "@/components/follow-provider"
import { usePostsContext } from "@/components/posts-provider"
import CommentsOverlay from "@/components/comments-overlay"
import VideoCard from "@/components/video-card"
import { VideoCardSkeleton } from "@/components/skeletons"
import { useToast } from "@/components/toast-provider"
import { deletePost, fetchCommentCount, incrementViewCount, toggleLike } from "@/lib/data/posts"
import type { Post } from "@/lib/types"
import { getErrorMessage } from "@/lib/utils"
import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"
import { useSwipeGesture } from "@/hooks/use-swipe-gesture"

interface LikeState {
  liked: boolean
  count: number
  pending: boolean
}

export interface VideoFeedHandle {
  scrollToPost: (postId: string) => void
}

interface VideoFeedProps {
  onNavigateToUpload?: () => void
}

const VideoFeed = forwardRef<VideoFeedHandle, VideoFeedProps>(({ onNavigateToUpload }, ref) => {
  const { posts, loading: postsLoading, error, loadMorePosts, hasMore, loadingMore } = usePostsContext()
  const { user, loading: authLoading } = useAuth()
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, LikeState>>({})
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const viewedPostsRef = useRef<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [prefetchIndex, setPrefetchIndex] = useState<number>(-1)
  const prefetchVideoRef = useRef<HTMLVideoElement | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useImperativeHandle(ref, () => ({
    scrollToPost: (postId: string) => {
      const node = document.getElementById(`post-${postId}`)
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    },
  }))

  useEffect(() => {
    if (!user?.uid) {
      setOptimisticLikes({})
      return
    }

    setOptimisticLikes((current) => {
      const next: Record<string, LikeState> = {}
      posts.forEach((post) => {
        const baseLiked = post.likes?.includes(user.uid) ?? false
        const baseCount = post.likes?.length ?? 0
        const existing = current[post.id]
        if (existing && existing.pending) {
          next[post.id] = existing
        } else {
          next[post.id] = { liked: baseLiked, count: baseCount, pending: false }
        }
      })
      return next
    })
  }, [posts, user?.uid])

  useEffect(() => {
    if (!copiedPostId) return
    const timeout = setTimeout(() => setCopiedPostId(null), 2000)
    return () => clearTimeout(timeout)
  }, [copiedPostId])

  useEffect(() => {
    if (posts.length === 0) return
    const nextIndex = activeIndex + 1
    if (nextIndex < posts.length) {
      setPrefetchIndex(nextIndex)
    }
  }, [activeIndex, posts.length])

  useEffect(() => {
    const videoElement = prefetchVideoRef.current
    if (!videoElement) {
      return
    }

    if (prefetchIndex < 0 || prefetchIndex >= posts.length) {
      videoElement.removeAttribute("src")
      videoElement.load()
      return
    }

    videoElement.src = posts[prefetchIndex].videoURL
    videoElement.load()
  }, [prefetchIndex, posts])

  useEffect(() => {
    const nextCounts: Record<string, number> = {}
    posts.forEach((post) => {
      if (typeof post.commentCount === "number") {
        nextCounts[post.id] = post.commentCount
      }
    })

    setCommentCounts((current) => {
      const sameKeys = Object.keys(nextCounts).length === Object.keys(current).length
      if (sameKeys) {
        const hasDiff = Object.entries(nextCounts).some(([key, value]) => current[key] !== value)
        if (!hasDiff) {
          return current
        }
      }
      return nextCounts
    })
  }, [posts])

  useEffect(() => {
    const missing = posts.filter((post) => typeof post.commentCount !== "number")
    if (missing.length === 0) return

    let cancelled = false

    const loadCounts = async () => {
      const entries = await Promise.all(
        missing.map(async (post) => {
          const count = await fetchCommentCount(post.id)
          return { id: post.id, count }
        }),
      )

      if (cancelled) return

      setCommentCounts((current) => {
        const next = { ...current }
        let changed = false
        entries.forEach(({ id, count }) => {
          if (next[id] !== count) {
            next[id] = count
            changed = true
          }
        })
        return changed ? next : current
      })
    }

    void loadCounts()

    return () => {
      cancelled = true
    }
  }, [posts])

  const handleCommentsOpen = (postId: string) => {
    setSelectedPostId(postId)
    setShowComments(true)
  }

  const handleCommentsClose = () => {
    setShowComments(false)
    setSelectedPostId(null)
  }

  const handleToggleLike = useCallback(
    async (post: Post) => {
      if (!user || authLoading) return

      const currentState: LikeState = optimisticLikes[post.id] ?? {
        liked: post.likes?.includes(user.uid) ?? false,
        count: post.likes?.length ?? 0,
        pending: false,
      }

      const nextLiked = !currentState.liked
      const nextCount = Math.max(0, currentState.count + (nextLiked ? 1 : -1))

      setOptimisticLikes((current) => ({
        ...current,
        [post.id]: { liked: nextLiked, count: nextCount, pending: true },
      }))

      try {
        await toggleLike(post.id, user.uid, nextLiked)
        setOptimisticLikes((current) => ({
          ...current,
          [post.id]: {
            ...(current[post.id] ?? { liked: nextLiked, count: nextCount }),
            pending: false,
          },
        }))
      } catch (toggleError) {
        console.error("Failed to toggle like", toggleError)
        setOptimisticLikes((current) => ({
          ...current,
          [post.id]: {
            liked: currentState.liked,
            count: currentState.count,
            pending: false,
          },
        }))
        showToast(getErrorMessage(toggleError), "error")
      }
    },
    [authLoading, optimisticLikes, showToast, user],
  )

  const handleShare = useCallback(
    async (post: Post) => {
      try {
        if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(post.videoURL)
        } else {
        const textarea = document.createElement("textarea")
        textarea.value = post.videoURL
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopiedPostId(post.id)
      } catch (shareError) {
        console.error("Failed to copy share link", shareError)
        setCopiedPostId(null)
        showToast("Unable to copy link. Please copy it manually.", "error")
      }
    },
    [showToast],
  )

  const handleDelete = useCallback(
    async (post: Post) => {
      if (!user || user.uid !== post.userId) return
      const confirmed = window.confirm("Delete this set? This cannot be undone.")
      if (!confirmed) return

      setDeletingPostId(post.id)
      try {
        await deletePost({ id: post.id, fileId: post.fileId, thumbnailFileId: post.thumbnailFileId })
        showToast("Set deleted successfully", "success")
      } catch (deleteError) {
        console.error("Failed to delete post", deleteError)
        showToast(getErrorMessage(deleteError), "error")
      } finally {
        setDeletingPostId(null)
      }
    },
    [showToast, user],
  )

  const handleCommentCountChange = useCallback((postId: string, count: number) => {
    setCommentCounts((current) => ({ ...current, [postId]: count }))
  }, [])

  const handleToggleFollow = useCallback(
    (targetUserId: string) => {
      if (!user || user.uid === targetUserId) return
      void toggleFollow(targetUserId)
    },
    [toggleFollow, user],
  )

const derivedPosts = useMemo(() => posts, [posts])
const disableActions = authLoading || !user

const showSkeletons = postsLoading && derivedPosts.length === 0

  const scrollToIndex = useCallback(
    (index: number) => {
      const target = derivedPosts[index]
      if (!target) return
      const node = document.getElementById(`post-${target.id}`)
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" })
        setActiveIndex(index)
      }
    },
    [derivedPosts],
  )

  const swipeHandlers = useSwipeGesture({
    threshold: 80,
    enabled: !showComments && derivedPosts.length > 0,
    onSwipeUp: () => {
      if (activeIndex >= derivedPosts.length - 1) return
      scrollToIndex(activeIndex + 1)
      haptic.light()
    },
    onSwipeDown: () => {
      if (activeIndex <= 0) return
      scrollToIndex(activeIndex - 1)
      haptic.light()
    },
  })

  useKeyboardNavigation({
    axis: "vertical",
    enabled: !showComments,
    onNext: () => {
      const nextIndex = Math.min(activeIndex + 1, derivedPosts.length - 1)
      if (nextIndex !== activeIndex) {
        scrollToIndex(nextIndex)
      }
    },
    onPrevious: () => {
      const previousIndex = Math.max(activeIndex - 1, 0)
      if (previousIndex !== activeIndex) {
        scrollToIndex(previousIndex)
      }
    },
  })

  useEffect(() => {
    if (derivedPosts.length === 0) {
      return
    }
    const current = derivedPosts[activeIndex]
    setAnnouncement(`Now viewing ${current.title}`)
  }, [activeIndex, derivedPosts])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingMore) {
            loadMorePosts().catch(() => {
              // errors handled in provider
            })
          }
        })
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loadMorePosts, loadingMore])

  return (
    <div
      className="relative h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide overscroll-contain"
      role="feed"
      aria-label="Video feed"
      {...swipeHandlers}
    >
      {error && !postsLoading && (
        <div className="px-4 py-3 bg-red-600/20 text-red-200 text-sm text-center">{error}</div>
      )}

      {showSkeletons ? (
        Array.from({ length: 3 }).map((_, index) => <VideoCardSkeleton key={`video-skeleton-${index}`} />)
      ) : derivedPosts.length === 0 && !postsLoading && !loadingMore ? (
        <div className="flex h-full items-center justify-center px-6">
          <div className="flex flex-col items-center text-center gap-4 max-w-sm">
            <Upload size={72} className="text-gray-600" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No sets yet</h2>
              <p className="text-gray-400 text-sm">
                Be the first comedian to upload a stand-up clip and get the laughs rolling.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToUpload?.()}
              className="inline-flex items-center gap-2 bg-white text-black rounded-full px-6 py-3 font-semibold hover:bg-gray-200 transition-colors"
            >
              <Upload size={20} />
              Upload Your First Set
            </button>
          </div>
        </div>
      ) : (
        derivedPosts.map((post) => {
          const likeState = optimisticLikes[post.id] ?? {
            liked: user ? post.likes?.includes(user.uid) ?? false : false,
            count: post.likes?.length ?? 0,
            pending: false,
          }

          return (
            <VideoCard
              key={post.id}
              post={post}
              likeState={likeState}
              commentCount={commentCounts[post.id] ?? post.commentCount ?? 0}
              onToggleLike={() => handleToggleLike(post)}
              onCommentsClick={() => handleCommentsOpen(post.id)}
              onShare={() => handleShare(post)}
              onDelete={() => handleDelete(post)}
              disableActions={disableActions}
              isDeleting={deletingPostId === post.id}
              isOwner={user?.uid === post.userId}
              showShareSuccess={copiedPostId === post.id}
              onViewed={() => {
                if (viewedPostsRef.current.has(post.id)) return
                viewedPostsRef.current.add(post.id)
                void incrementViewCount(post.id).catch((incrementError) => {
                  console.error("Failed to increment view count", incrementError)
                  viewedPostsRef.current.delete(post.id)
                })
                const index = derivedPosts.findIndex((item) => item.id === post.id)
                if (index >= 0) {
                  setActiveIndex(index)
                }
              }}
              elementId={`post-${post.id}`}
              isFollowing={!!user && isFollowing(post.userId)}
              onToggleFollow={() => handleToggleFollow(post.userId)}
              followDisabled={followLoading || !user || user.uid === post.userId}
            />
          )
        })
      )}

      {hasMore && <div ref={sentinelRef} className="h-6 w-full" aria-hidden="true" />}
      {loadingMore && (
        <div className="px-4 py-6" aria-live="polite">
          <span className="sr-only">Loading more videos</span>
          <VideoCardSkeleton />
        </div>
      )}

      {showComments && selectedPostId && (
        <CommentsOverlay
          postId={selectedPostId}
          onClose={handleCommentsClose}
          disableActions={disableActions}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
      <video
        ref={prefetchVideoRef}
        preload="metadata"
        style={{ display: "none" }}
      />
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
})

VideoFeed.displayName = "VideoFeed"

export default VideoFeed
