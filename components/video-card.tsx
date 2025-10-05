"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Heart, MessageCircle, Share, Music, Trash2, Tag, CheckCircle } from "lucide-react"
import Image from "next/image"

import type { Post } from "@/lib/types"
import { buildAvatarPlaceholder, formatLargeNumber, formatRelativeTimestamp, getCategoryLabel } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"

interface LikeState {
  liked: boolean
  count: number
  pending: boolean
}

interface VideoCardProps {
  post: Post
  likeState: LikeState
  commentCount: number
  onToggleLike: () => void
  onCommentsClick: () => void
  onShare: () => void
  onDelete: () => void
  disableActions: boolean
  isDeleting: boolean
  isOwner: boolean
  showShareSuccess: boolean
}

export default function VideoCard({
  post,
  likeState,
  commentCount,
  onToggleLike,
  onCommentsClick,
  onShare,
  onDelete,
  disableActions,
  isDeleting,
  isOwner,
  showShareSuccess,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const displayName = useDisplayName(post.userId) ?? "Anonymous Comedian"
  const [videoError, setVideoError] = useState(false)

  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || post.userId), [displayName, post.userId])
  const relativeTime = useMemo(() => formatRelativeTimestamp(post.timestamp), [post.timestamp])
  const categoryLabel = useMemo(() => getCategoryLabel(post.category), [post.category])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleVisible = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          void videoElement.play().catch(() => {
            videoElement.muted = true
            void videoElement.play().catch((error) => {
              console.error("Video playback failed", error)
            })
          })
        } else {
          videoElement.pause()
        }
      })
    }

    const observer = new IntersectionObserver(handleVisible, { threshold: 0.75 })
    observer.observe(videoElement)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="relative h-screen w-full snap-start bg-black">
      <div className="absolute inset-0">
        {videoError ? (
          <div className="h-full w-full bg-gray-900 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Video unavailable</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={post.videoURL}
            className="h-full w-full object-cover"
            loop
            playsInline
            muted
            controls={false}
            onError={() => setVideoError(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <div className="absolute inset-0 flex">
        <div className="flex-1 flex flex-col justify-end p-4 pb-24">
          <div className="flex items-center gap-3 mb-3">
            <Image
              src={avatar}
              alt={displayName}
              width={40}
              height={40}
              className="rounded-full border-2 border-white object-cover"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-white flex items-center gap-1">
                @{displayName.replace(/\s+/g, "").toLowerCase() || "comedian"}
                {isOwner && <CheckCircle size={16} className="text-blue-500 fill-current" />}
              </span>
              <span className="text-xs text-gray-300">{relativeTime}</span>
            </div>
          </div>

          <h2 className="text-white text-lg font-semibold mb-1 line-clamp-2">{post.title}</h2>
          <p className="text-white/90 text-sm mb-3 leading-relaxed line-clamp-3">{post.description}</p>

          <div className="flex items-center gap-3 text-white/80 text-sm">
            <span className="flex items-center gap-1">
              <Tag size={14} />
              {categoryLabel}
            </span>
            <span className="flex items-center gap-1">
              <Music size={14} />
              Tight Five
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-end gap-6 p-4 pb-24">
          <div className="flex flex-col items-center">
            <button
              onClick={onToggleLike}
              disabled={disableActions || likeState.pending}
              className={`p-3 rounded-full transition-all duration-200 ${
                likeState.liked ? "bg-red-500" : "bg-black/30 hover:bg-black/50"
              } ${disableActions || likeState.pending ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <Heart size={24} className={`text-white ${likeState.liked ? "fill-current" : ""}`} />
            </button>
            <span className="text-white text-xs mt-1">{formatLargeNumber(likeState.count)}</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={onCommentsClick}
              className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-200"
            >
              <MessageCircle size={24} className="text-white" />
            </button>
            <span className="text-white text-xs mt-1">{formatLargeNumber(commentCount)}</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={onShare}
              className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-200"
            >
              <Share size={24} className="text-white" />
            </button>
            <span className="text-white text-xs mt-1">{showShareSuccess ? "Copied" : "Share"}</span>
          </div>

          {isOwner && (
            <button
              onClick={onDelete}
              disabled={isDeleting || disableActions}
              className="p-3 rounded-full bg-black/30 hover:bg-red-600/60 transition-all duration-200 text-white disabled:opacity-60"
            >
              <Trash2 size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
