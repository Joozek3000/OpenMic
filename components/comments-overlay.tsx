"use client"

import { useEffect, useMemo, useState } from "react"
import { X, Trash2 } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { addComment, deleteComment, listenToComments } from "@/lib/data/posts"
import type { CommentDoc } from "@/lib/types"
import { buildAvatarPlaceholder, formatRelativeTimestamp } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"

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
    <div className="flex gap-3">
      <Image src={avatar} alt={displayName} width={32} height={32} className="rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-medium text-sm">{displayName}</span>
          <span className="text-gray-400 text-xs">{formatRelativeTimestamp(comment.timestamp)}</span>
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={deleting}
              className="ml-auto text-gray-400 hover:text-red-400 text-xs disabled:opacity-50"
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
        setError("Unable to load comments right now.")
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [postId])

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
      setError("Could not add comment. Please try again.")
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
      setError("Could not delete comment. Please try again.")
    } finally {
      setDeletingCommentId(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-gray-900 w-full h-2/3 rounded-t-3xl animate-in slide-in-from-bottom duration-300 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold text-lg">Comments</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400">Loading comments…</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Be the first to leave a laugh.</div>
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

          {error && <div className="text-center text-sm text-red-300">{error}</div>}
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
                className="flex-1 bg-gray-800 text-white rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
              />
              <button
                onClick={handleSubmit}
                disabled={disableActions || posting || !newComment.trim()}
                className="px-4 py-2 bg-white text-black rounded-full text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
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
