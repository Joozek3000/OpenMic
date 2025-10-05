"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { useAuth } from "@/components/auth-provider"
import { usePostsContext } from "@/components/posts-provider"
import CommentsOverlay from "@/components/comments-overlay"
import VideoCard from "@/components/video-card"
import { deletePost, incrementViewCount, toggleLike } from "@/lib/data/posts"
import type { Post } from "@/lib/types"

interface LikeState {
  liked: boolean
  count: number
  pending: boolean
}

export default function VideoFeed() {
  const { posts, loading: postsLoading, error } = usePostsContext()
  const { user, loading: authLoading } = useAuth()

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [optimisticLikes, setOptimisticLikes] = useState<Record<string, LikeState>>({})
  const [likeError, setLikeError] = useState<string | null>(null)
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null)
  const viewedPostsRef = useRef<Set<string>>(new Set())

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
        setLikeError(null)
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
        setLikeError("Could not update like. Please try again.")
      }
    },
    [authLoading, optimisticLikes, user],
  )

  const handleShare = useCallback(async (post: Post) => {
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
      alert("Unable to copy link. Please copy it manually.")
    }
  }, [])

  const handleDelete = useCallback(
    async (post: Post) => {
      if (!user || user.uid !== post.userId) return
      const confirmed = window.confirm("Delete this set? This cannot be undone.")
      if (!confirmed) return

      setDeletingPostId(post.id)
      try {
        await deletePost({ id: post.id, fileId: post.fileId, thumbnailFileId: post.thumbnailFileId })
      } catch (deleteError) {
        console.error("Failed to delete post", deleteError)
        alert("Failed to delete post. Please try again.")
      } finally {
        setDeletingPostId(null)
      }
    },
    [user],
  )

  const handleCommentCountChange = useCallback((postId: string, count: number) => {
    setCommentCounts((current) => ({ ...current, [postId]: count }))
  }, [])

  const derivedPosts = useMemo(() => posts, [posts])

  const disableActions = authLoading || !user

  return (
    <div className="relative h-full overflow-y-auto snap-y snap-mandatory scrollbar-hide">
      {postsLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
        </div>
      )}

      {error && !postsLoading && (
        <div className="px-4 py-3 bg-red-600/20 text-red-200 text-sm text-center">{error}</div>
      )}

      {likeError && (
        <div className="px-4 py-2 bg-amber-500/20 text-amber-200 text-sm text-center">{likeError}</div>
      )}

      {derivedPosts.length === 0 && !postsLoading ? (
        <div className="flex h-full items-center justify-center text-center px-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">No sets yet</h2>
            <p className="text-gray-400">Be the first to upload a stand-up clip and kick off the laughs.</p>
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
              commentCount={commentCounts[post.id] ?? 0}
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
                void incrementViewCount(post.id).catch((error) => {
                  console.error("Failed to increment view count", error)
                  viewedPostsRef.current.delete(post.id)
                })
              }}
            />
          )
        })
      )}

      {showComments && selectedPostId && (
        <CommentsOverlay
          postId={selectedPostId}
          onClose={handleCommentsClose}
          disableActions={disableActions}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </div>
  )
}
