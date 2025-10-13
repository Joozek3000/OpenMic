"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Heart, MessageCircle, Share, Music, Trash2, Tag, CheckCircle, Volume2, VolumeX, Play } from "lucide-react"
import Image from "next/image"

import { useToast } from "@/components/toast-provider"
import { usePlaybackSettings } from "@/components/playback-settings-provider"
import { useDisplayName } from "@/hooks/use-display-name"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"
import type { Post } from "@/lib/types"
import {
  buildAvatarPlaceholder,
  formatLargeNumber,
  formatRelativeTimestamp,
  getCategoryLabel,
  canAutoplay,
  detectAutoplaySupport,
} from "@/lib/utils"

interface LikeState {
  liked: boolean
  count: number
  pending: boolean
}

const autoplayGlobals = {
  lastWarningTime: 0,
  autoplayBlocked: false,
}

const AUTOPLAY_WARNING_COOLDOWN = 10_000

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
  const { preferences } = usePlaybackSettings()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const displayName = useDisplayName(post.userId) ?? "Anonymous Comedian"
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  const [videoError, setVideoError] = useState(false)
  const [isMuted, setIsMuted] = useState(preferences.startMuted)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [showPlayOverlay, setShowPlayOverlay] = useState(false)
  const hasTrackedViewRef = useRef(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const observerOptionsRef = useRef<IntersectionObserverInit>({ threshold: 0.6 })
  const isMutedRef = useRef(isMuted)
  const autoplayRef = useRef(preferences.autoplay)

  const isAbortError = (error: unknown) => {
    return error instanceof DOMException && error.name === "AbortError"
  }

  const warnAutoplayBlocked = useCallback(() => {
    const now = Date.now()
    if (now - autoplayGlobals.lastWarningTime < AUTOPLAY_WARNING_COOLDOWN) {
      autoplayGlobals.autoplayBlocked = true
      setShowPlayOverlay(true)
      return
    }
    autoplayGlobals.lastWarningTime = now
    autoplayGlobals.autoplayBlocked = true
    setShowPlayOverlay(true)
    showToast("Video autoplay blocked. Tap to play.", "info")
  }, [showToast])

  // Build derived values up front so the JSX stays tidy.
  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || post.userId), [displayName, post.userId])
  const relativeTime = useMemo(() => formatRelativeTimestamp(post.timestamp), [post.timestamp])
  const categoryLabel = useMemo(() => getCategoryLabel(post.category), [post.category])

  useEffect(() => {
    hasTrackedViewRef.current = false
    setIsPortrait(false)
    setShowPlayOverlay(false)
  }, [post.id])

  useEffect(() => {
    void detectAutoplaySupport()
  }, [])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    autoplayRef.current = preferences.autoplay
  }, [preferences.autoplay])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const handleVisible = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.target !== videoElement) return

        if (entry.isIntersecting) {
          if (!autoplayRef.current) {
            return
          }

          const support = canAutoplay()
          if (support.blocked) {
            setShowPlayOverlay(true)
          }
          if (autoplayGlobals.autoplayBlocked) {
            setShowPlayOverlay(true)
          }

          if (!hasTrackedViewRef.current) {
            hasTrackedViewRef.current = true
            onViewed?.()
          }

          const desiredMuted = isMutedRef.current
          videoElement.muted = desiredMuted

          void videoElement
            .play()
            .then(() => {
              setIsPlaying(true)
              setShowPlayOverlay(false)
              autoplayGlobals.autoplayBlocked = false
            })
            .catch((error) => {
              if (isAbortError(error)) {
                return
              }

              const isPermissionError =
                error instanceof DOMException &&
                (error.name === "NotAllowedError" || error.name === "AbortError")

              if (!desiredMuted) {
                if (!isPermissionError) {
                  console.warn("Autoplay with sound blocked; reverting to muted", error)
                }
                videoElement.muted = true
                setIsMuted(true)
                  isMutedRef.current = true
                  void videoElement
                    .play()
                    .then(() => {
                      setIsPlaying(true)
                      setShowPlayOverlay(false)
                      autoplayGlobals.autoplayBlocked = false
                    })
                    .catch((err) => {
                      if (isAbortError(err)) {
                        return
                      }
                      const mutedPermissionError =
                        err instanceof DOMException &&
                        (err.name === "NotAllowedError" || err.name === "AbortError")
                      if (!mutedPermissionError) {
                        console.warn("Video playback failed", err)
                      }
                      warnAutoplayBlocked()
                    })
                } else {
                  if (!isPermissionError) {
                    console.warn("Video playback failed", error)
                  }
                  warnAutoplayBlocked()
                }
            })
        } else if (!videoElement.paused) {
          videoElement.pause()
          setIsPlaying(false)
        }
      })
    }

    const observer = new IntersectionObserver(handleVisible, observerOptionsRef.current)
    observer.observe(videoElement)
    observerRef.current = observer

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [onViewed, warnAutoplayBlocked])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return
    if (videoElement.muted !== isMuted) {
      videoElement.muted = isMuted
      if (!isMuted && !videoElement.paused) {
        void videoElement.play().catch(() => {
          // Some browsers still require user interaction; ignore errors here.
        })
      }
    }
  }, [isMuted])

  useEffect(() => {
    if (preferences.autoplay) return
    const videoElement = videoRef.current
    if (!videoElement) return
    if (!videoElement.paused) {
      videoElement.pause()
      setIsPlaying(false)
    }
  }, [preferences.autoplay])

  useEffect(() => {
    setIsMuted(preferences.startMuted)
  }, [preferences.startMuted])

  const handleToggleMute = () => {
    const videoElement = videoRef.current
    if (!videoElement) return

    // Attempt to unmute and resume playback; browsers may reject until user interacts.
    if (isMuted) {
      videoElement.muted = false
      void videoElement
        .play()
        .then(() => {
          setIsMuted(false)
          setIsPlaying(true)
          setShowPlayOverlay(false)
          autoplayGlobals.autoplayBlocked = false
          isMutedRef.current = false
        })
            .catch((error) => {
              if (isAbortError(error)) {
                videoElement.muted = true
                setIsMuted(true)
                isMutedRef.current = true
                return
              }
              const isPermissionError =
                error instanceof DOMException &&
                (error.name === "NotAllowedError" || error.name === "AbortError")
              if (!isPermissionError) {
                console.warn("Unable to unmute automatically", error)
              }
              videoElement.muted = true
              setIsMuted(true)
              warnAutoplayBlocked()
            })
    } else {
      videoElement.muted = true
      setIsMuted(true)
      isMutedRef.current = true
    }
  }

  return (
    <div
      id={elementId}
      className="relative h-screen w-full snap-start bg-black"
      role="article"
      aria-label={`Video by ${displayName}: ${post.title}`}
      onClick={() => {
        const videoElement = videoRef.current
        if (!videoElement) return
        if (videoElement.paused) {
          void videoElement
            .play()
            .then(() => {
              setIsPlaying(true)
              setShowPlayOverlay(false)
              autoplayGlobals.autoplayBlocked = false
            })
            .catch((error) => {
              if (isAbortError(error)) {
                return
              }
              console.error("Failed to resume playback", error)
              showToast("Unable to play this video. Please try again.", "error")
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
              loop={preferences.loop}
              playsInline
              muted={isMuted}
              controls={false}
              onError={() => {
                setVideoError(true)
                showToast("Unable to play this video. Please try another.", "error")
              }}
              onPlay={() => {
                setIsPlaying(true)
                setShowPlayOverlay(false)
                autoplayGlobals.autoplayBlocked = false
                if (!hasTrackedViewRef.current) {
                  hasTrackedViewRef.current = true
                  onViewed?.()
                }
              }}
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
        {(showPlayOverlay || !isPlaying) && !videoError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`rounded-full p-4 transition-transform ${showPlayOverlay ? "bg-black/60 scale-110" : "bg-black/40"}`}>
              <Play size={36} className="text-white" />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            handleToggleMute()
            haptic.light()
          }}
          className="absolute top-16 right-4 z-10 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors active-scale tap-highlight-none focus-visible-ring"
          aria-label={isMuted ? "Unmute video" : "Mute video"}
          aria-pressed={!isMuted}
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
                  if (disableActions || followDisabled) return
                  onToggleFollow()
                  haptic.medium()
                }}
                disabled={disableActions || followDisabled}
                className={`min-h-[40px] min-w-[48px] max-w-[140px] px-3 py-2 rounded-full text-sm font-semibold active-scale tap-highlight-none transition-all duration-300 ease-out flex items-center justify-center whitespace-nowrap overflow-hidden text-ellipsis ${
                  isFollowing
                    ? "bg-white/10 text-white"
                    : "bg-white text-black hover:bg-gray-200 hover:shadow-lg"
                } ${disableActions || followDisabled ? "opacity-60 cursor-not-allowed" : "hover-lift"} focus-visible-ring`}
                aria-label={isFollowing ? `Unfollow ${displayName}` : `Follow ${displayName}`}
                aria-pressed={isFollowing}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <h2 className="text-white text-lg font-semibold mb-1 line-clamp-2">{post.title}</h2>
          <p className="text-white/90 text-sm mb-3 leading-relaxed line-clamp-3">{post.description}</p>

          <div className="flex items-center gap-3 text-white/80 text-sm">
            <span className="flex items-center gap-1" aria-hidden="true">
              <Tag size={14} />
              {categoryLabel}
            </span>
            <span className="flex items-center gap-1" aria-hidden="true">
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
                if (disableActions || likeState.pending) return
                onToggleLike()
                if (!likeState.liked) {
                  haptic.medium()
                } else {
                  haptic.light()
                }
              }}
              disabled={disableActions || likeState.pending}
              className={`p-3 rounded-full active-scale tap-highlight-none transition-all duration-300 ease-out ${
                likeState.liked
                  ? "bg-red-500 shadow-red-500/40 animate-bounce-subtle"
                  : "bg-black/30 hover:bg-black/50 hover:shadow-lg"
              } ${disableActions || likeState.pending ? "opacity-60 cursor-not-allowed" : ""} focus-visible-ring`}
              aria-label={
                likeState.liked
                  ? `Unlike. ${likeState.count} likes`
                  : `Like. ${likeState.count} likes`
              }
              aria-pressed={likeState.liked}
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
                haptic.light()
              }}
              className="p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-300 ease-out hover:shadow-lg active-scale tap-highlight-none focus-visible-ring"
              aria-label={`View ${commentCount} comments`}
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
                haptic.light()
              }}
              className={`p-3 rounded-full bg-black/30 hover:bg-black/50 transition-all duration-300 ease-out hover:shadow-lg active-scale tap-highlight-none focus-visible-ring ${
                showShareSuccess ? "animate-bounce-subtle" : ""
              }`}
              aria-label={showShareSuccess ? "Link copied" : "Share video"}
            >
              <Share size={24} className="text-white" />
            </button>
            <span className="text-white text-xs mt-1">{showShareSuccess ? "Copied" : "Share"}</span>
          </div>

          {isOwner && (
            <button
              onClick={(event) => {
                event.stopPropagation()
                if (isDeleting || disableActions) return
                haptic.heavy()
                onDelete()
              }}
              disabled={isDeleting || disableActions}
              className="p-3 rounded-full bg-black/30 hover:bg-red-600/60 transition-all duration-300 ease-out text-white disabled:opacity-60 active-scale tap-highlight-none focus-visible-ring"
              aria-label="Delete this video"
            >
              <Trash2 size={24} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
