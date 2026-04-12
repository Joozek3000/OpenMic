"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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

  // UI state for comment overlay and per-post actions.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)
  // Optimistic state lets the heart count update immediately before the network call finishes.
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, LikeState>>({})
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  // Local comment counts cache avoids extra reads for already-loaded posts.
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  // Used to count a view once per card render, even if a user scrolls back and forth.
  const viewedPostsRef = useRef<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState<number>(0)
  // Hidden off-screen <video> used for preloading the next clip.
  const prefetchVideoRef = useRef<HTMLVideoElement | null>(null)
  // Screen-reader announcement so keyboard/swipe navigation has audible context.
  const [announcement, setAnnouncement] = useState("")
  // Infinite-scroll trigger element at bottom of feed.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const disableActions = authLoading || !user
  const showSkeletons = postsLoading && posts.length === 0

  const scrollToPostId = useCallback((postId: string) => {
    // Exposed to parent tabs so "open post from map/search" can jump directly in feed.
    const node = document.getElementById(`post-${postId}`)
    if (!node) return false
    node.scrollIntoView({ behavior: "smooth", block: "start" })
    return true
  }, [])

  useImperativeHandle(ref, () => ({ scrollToPost: scrollToPostId }), [scrollToPostId])

  useEffect(() => {
    // Keep optimistic like state aligned with latest server values whenever posts/user changes.
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
    // Show temporary "copied" state after share action succeeds.
    if (!copiedPostId) return
    const timeout = setTimeout(() => setCopiedPostId(null), 2000)
    return () => clearTimeout(timeout)
  }, [copiedPostId])

  useEffect(() => {
    // Preload next video for smoother swipe/scroll playback.
    const prefetchIndex = activeIndex + 1
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
  }, [activeIndex, posts])

  useEffect(() => {
    // Seed comment counts from posts payload when available to avoid an extra query.
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
    // Backfill only the posts that did not include commentCount from the main query.
    const missing = posts.filter((post) => {
      return typeof post.commentCount !== "number" && typeof commentCounts[post.id] !== "number"
    })
    if (missing.length === 0) {
      return
    }

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
  }, [commentCounts, posts])

  // Keep handlers tiny and stable where possible to reduce prop churn on child cards.
  const handleCommentsOpen = (postId: string) => { setSelectedPostId(postId); setShowComments(true) }

  const handleCommentsClose = () => { setShowComments(false); setSelectedPostId(null) }

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

      // Optimistic UI: apply immediately, then rollback if request fails.
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
        if (navigator.clipboard?.writeText) {
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
      // Browser confirm is intentional here: fast guardrail with no custom modal complexity.
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
      // Ignore self-follow and unauthenticated actions.
      if (!user || user.uid === targetUserId) return
      void toggleFollow(targetUserId)
    },
    [toggleFollow, user],
  )

  const scrollToIndex = useCallback(
    (index: number) => {
      // Scroll by post id so DOM order and filtered lists remain robust.
      const target = posts[index]
      if (target && scrollToPostId(target.id)) setActiveIndex(index)
    },
    [posts, scrollToPostId],
  )

  const swipeHandlers = useSwipeGesture({
    threshold: 80,
    // Disable feed swipe while comments are open to avoid gesture conflicts.
    enabled: !showComments && posts.length > 0,
    onSwipeUp: () => {
      if (activeIndex >= posts.length - 1) return
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
    // Keyboard shortcuts are paused while modal-like overlays are visible.
    enabled: !showComments,
    onNext: () => {
      const nextIndex = Math.min(activeIndex + 1, posts.length - 1)
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
    // Announce currently focused post to assistive tech users.
    const current = posts[activeIndex]
    if (current) setAnnouncement(`Now viewing ${current.title}`)
  }, [activeIndex, posts])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || loadingMore) return
          // Provider owns request dedupe/retry/error messaging for pagination.
          loadMorePosts().catch(() => {
            // errors handled in provider
          })
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
      ) : posts.length === 0 && !postsLoading && !loadingMore ? (
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
        posts.map((post, index) => {
          // Prefer optimistic state for responsive likes; fallback to server payload.
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
                setActiveIndex(index)
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
        // Hidden element keeps browser cache warm for the next item.
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
