"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Trash2, MessageCircle } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { addComment, deleteComment, listenToComments } from "@/lib/data/posts"
import type { CommentDoc } from "@/lib/types"
import { buildAvatarPlaceholder, formatRelativeTimestamp, getErrorMessage } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"
import { useToast } from "@/components/toast-provider"
import { CommentItemSkeleton } from "@/components/skeletons"
import { useFocusTrap } from "@/hooks/use-focus-trap"

interface CommentsOverlayProps {
  postId: string
  onClose: () => void
  disableActions: boolean
  onCommentCountChange?: (postId: string, count: number) => void
}

interface CommentItemProps {
  comment: CommentDoc
  canDelete: boolean
  onDelete: (commentId: string) => void
  deleting: boolean
}

function CommentItem({ comment, canDelete, onDelete, deleting }: CommentItemProps) {
  const displayName = useDisplayName(comment.userId) ?? "Anonymous"
  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || comment.userId), [displayName, comment.userId])

  return (
    <div className="flex gap-3" role="listitem">
      <Image src={avatar} alt={displayName} width={32} height={32} className="rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-medium text-sm">{displayName}</span>
          <span className="text-gray-400 text-xs">{formatRelativeTimestamp(comment.timestamp)}</span>
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={deleting}
              className="ml-auto text-gray-400 hover:text-red-400 text-xs disabled:opacity-50 focus-visible-ring"
              aria-label="Delete comment"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <p className="text-white text-sm">{comment.text}</p>
      </div>
    </div>
  )
}

export default function CommentsOverlay({ postId, onClose, disableActions, onCommentCountChange }: CommentsOverlayProps) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const { showToast } = useToast()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = listenToComments(
      postId,
      (nextComments) => {
        setComments(nextComments)
        setLoading(false)
        setError(null)
      },
      (firestoreError) => {
        console.error("Failed to fetch comments", firestoreError)
        const message = getErrorMessage(firestoreError)
        setError(message)
        showToast("Unable to load comments. Check your connection.", "error")
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [postId, showToast])

  useEffect(() => {
    onCommentCountChange?.(postId, comments.length)
  }, [comments.length, onCommentCountChange, postId])

  const handleSubmit = async () => {
    if (!user || !newComment.trim() || disableActions || posting) return
    setPosting(true)
    try {
      await addComment({ postId, text: newComment.trim(), userId: user.uid })
      setNewComment("")
    } catch (submitError) {
      console.error("Failed to add comment", submitError)
      const message = getErrorMessage(submitError)
      setError(message)
      showToast(message, "error")
    } finally {
      setPosting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!user || disableActions) return
    setDeletingCommentId(commentId)
    try {
      await deleteComment(postId, commentId)
    } catch (deleteError) {
      console.error("Failed to delete comment", deleteError)
      const message = getErrorMessage(deleteError)
      setError(message)
      showToast(message, "error")
    } finally {
      setDeletingCommentId(null)
    }
  }

  useFocusTrap(overlayRef, true)

  useEffect(() => {
    const firstFocusable = overlayRef.current?.querySelector<HTMLElement>(
      'button, input, textarea, [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onKeyDown={handleKeyDown}>
      <div
        ref={overlayRef}
        className="bg-gray-900 w-full h-2/3 rounded-t-3xl animate-in slide-in-from-bottom duration-300 flex flex-col focus-visible-ring"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comments-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 id="comments-title" className="text-white font-semibold text-lg">
            Comments
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors focus-visible-ring"
            aria-label="Close comments"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" role="list" aria-live="polite">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <CommentItemSkeleton key={`comment-skeleton-${index}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {posting && <CommentItemSkeleton key="comment-posting" />}
              {comments.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-3 py-12 px-4">
                  <MessageCircle size={48} className="text-gray-600" />
                  <div className="space-y-2">
                    <h4 className="text-xl font-semibold text-white">No comments yet</h4>
                    <p className="text-sm text-gray-400">
                      Be the first to share your thoughts! Drop a comment and start the conversation.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 italic">💬 Tip: Great comments get more engagement</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    canDelete={!disableActions && user?.uid === comment.userId}
                    onDelete={handleDelete}
                    deleting={deletingCommentId === comment.id}
                  />
                ))
              )}
            </div>
          )}

          {error && (
            <div className="text-center text-sm text-red-300" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-3 items-start">
            <Image
              src={buildAvatarPlaceholder(user?.uid ?? "guest")}
              alt="Your avatar"
              width={32}
              height={32}
              className="rounded-full flex-shrink-0"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    void handleSubmit()
                  }
                }}
                placeholder={disableActions ? "Sign in to add a comment" : "Add a comment..."}
                disabled={posting || disableActions}
                className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60 focus-visible-ring"
                maxLength={500}
                aria-label="Add a comment"
                aria-invalid={error ? "true" : "false"}
              />
              <button
                onClick={handleSubmit}
                disabled={disableActions || posting || !newComment.trim()}
                className="px-4 py-2 bg-white text-black rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors focus-visible-ring"
                aria-label={posting ? "Posting comment" : "Post comment"}
              >
                {posting ? "Posting" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
