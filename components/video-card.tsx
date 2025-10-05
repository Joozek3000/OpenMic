"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Heart, MessageCircle, Share, Music, Trash2, Tag, CheckCircle, Volume2, VolumeX, Play } from "lucide-react"
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
  onViewed?: () => void
  elementId?: string
  isFollowing: boolean
  onToggleFollow: () => void
  followDisabled?: boolean
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
  onViewed,
  elementId,
  isFollowing,
  onToggleFollow,
  followDisabled = false,
}: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const displayName = useDisplayName(post.userId) ?? "Anonymous Comedian"
  const [videoError, setVideoError] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const hasTrackedViewRef = useRef(false)

  // Build derived values up front so the JSX stays tidy.
  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || post.userId), [displayName, post.userId])
  const relativeTime = useMemo(() => formatRelativeTimestamp(post.timestamp), [post.timestamp])
  const categoryLabel = useMemo(() => getCategoryLabel(post.category), [post.category])

  useEffect(() => {
    hasTrackedViewRef.current = false
    setIsPortrait(false)
  }, [post.id])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // Drive autoplay/pause based on intersection and trigger view tracking exactly once.
    const handleVisible = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!hasTrackedViewRef.current) {
            hasTrackedViewRef.current = true
            onViewed?.()
          }
          videoElement.muted = isMuted
          void videoElement.play().then(() => {
            setIsPlaying(true)
          })
            .catch((error) => {
              if (!isMuted) {
                // Browser blocked autoplay with sound, fall back to muted playback.
                console.warn("Autoplay with sound blocked; reverting to muted", error)
                videoElement.muted = true
                setIsMuted(true)
                void videoElement.play().then(() => setIsPlaying(true)).catch((err) => console.error("Video playback failed", err))
              } else {
                console.error("Video playback failed", error)
              }
            })
        } else {
          videoElement.pause()
          setIsPlaying(false)
        }
      })
    }

    const observer = new IntersectionObserver(handleVisible, { threshold: 0.6 })
    observer.observe(videoElement)

    return () => {
      observer.disconnect()
    }
  }, [isMuted, onViewed])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return
    videoElement.muted = isMuted
  }, [isMuted])

  const handleToggleMute = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // Attempt to unmute and resume playback; browsers may reject until user interacts.
    if (isMuted) {
      videoElement.muted = false
      void videoElement.play()
        .then(() => {
          setIsMuted(false)
          setIsPlaying(true)
        })
        .catch((error) => {
          console.warn("Unable to unmute automatically", error)
          videoElement.muted = true
          setIsMuted(true)
        })
    } else {
      videoElement.muted = true
      setIsMuted(true)
    }
  }

  return (
    <div
      id={elementId}
      className="relative h-screen w-full snap-start bg-black"
      // Global click toggles playback while action buttons stop propagation.
      onClick={() => {
        const videoElement = videoRef.current
        if (!videoElement) return
        if (videoElement.paused) {
          void videoElement.play()
            .then(() => {
              setIsPlaying(true)
            })
            .catch((error) => {
              console.error("Failed to resume playback", error)
            })
        } else {
          videoElement.pause()
          setIsPlaying(false)
        }
      }}
    >
      <div className="absolute inset-0">
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          {videoError ? (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-gray-400 text-sm">Video unavailable</span>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={post.videoURL}
              className={
                isPortrait
                  ? "h-full max-h-full w-auto max-w-full object-contain"
                  : "h-full w-full object-cover"
              }
              loop
              playsInline
              muted={isMuted}
              controls={false}
              onError={() => setVideoError(true)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadedMetadata={(event) => {
                const media = event.currentTarget
                if (media.videoWidth && media.videoHeight) {
                  setIsPortrait(media.videoHeight > media.videoWidth)
                }
              }}
              poster={post.thumbnailURL}
            />
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {!isPlaying && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/40 rounded-full p-4">
              <Play size={36} className="text-white" />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleToggleMute()
          }}
          className="absolute top-16 right-4 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors"
        >
          {isMuted ? <VolumeX size={22} className="text-white" /> : <Volume2 size={22} className="text-white" />}
        </button>
      </div>

      <div className="absolute inset-0 flex">
        <div className="flex-1 flex flex-col justify-end p-4 pb-20">
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
            {!isOwner && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleFollow()
                }}
                disabled={disableActions || followDisabled}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${
                  isFollowing ? "bg-white/10 text-white" : "bg-white text-black hover:bg-gray-200"
                } ${disableActions || followDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
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

        <div className="flex flex-col items-center justify-end gap-6 p-4 pb-20">
          <div className="flex flex-col items-center">
            <button
              onClick={(event) => {
                event.stopPropagation()
                onToggleLike()
              }}
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
              onClick={(event) => {
                event.stopPropagation()
                onCommentsClick()
              }}
              className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-200"
            >
              <MessageCircle size={24} className="text-white" />
            </button>
            <span className="text-white text-xs mt-1">{formatLargeNumber(commentCount)}</span>
          </div>

          <div className="flex flex-col items-center">
            <button
              onClick={(event) => {
                event.stopPropagation()
                onShare()
              }}
              className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-200"
            >
              <Share size={24} className="text-white" />
            </button>
            <span className="text-white text-xs mt-1">{showShareSuccess ? "Copied" : "Share"}</span>
          </div>

          {isOwner && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
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
