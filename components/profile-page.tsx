"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Settings, Grid, Heart, UserPlus, Save, X } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { usePostsContext } from "@/components/posts-provider"
import { updateDisplayName, DisplayNameUnavailableError } from "@/lib/data/users"
import { buildAvatarPlaceholder, formatLargeNumber, getErrorMessage, sanitizeDisplayName } from "@/lib/utils"
import { GridItemSkeleton } from "@/components/skeletons"
import { useToast } from "@/components/toast-provider"
import { useDisplayName } from "@/hooks/use-display-name"
import { useUserProfileLite } from "@/hooks/use-user-profile-lite"
import { usePlaybackSettings } from "@/components/playback-settings-provider"
import { useFocusTrap } from "@/hooks/use-focus-trap"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"

interface ProfilePageProps {
  onSelectPost: (postId: string) => void
  onRequestAuth: () => void
  onNavigateToTab?: (tab: string) => void
}
const PROFILE_TABS = [
  { key: "videos", label: "Sets", icon: Grid },
  { key: "liked", label: "Liked", icon: Heart },
] as const

export default function ProfilePage({ onSelectPost, onRequestAuth, onNavigateToTab }: ProfilePageProps) {
  const { user, logout, loading: authLoading, error: authError } = useAuth()
  const { posts, loading: postsLoading } = usePostsContext()
  // "videos" and "liked" are the two profile content panes.
  const [activeTab, setActiveTab] = useState("videos")
  const savedDisplayName = useDisplayName(user?.uid)
  const profileMeta = useUserProfileLite(user?.uid)
  const [displayName, setDisplayName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackVariant, setFeedbackVariant] = useState<"success" | "error">("success")
  const [showSettings, setShowSettings] = useState(false)
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  const stageNameHintId = "stage-name-hint"
  const stageNameCountId = "stage-name-count"
  const stageNameMaxLength = 40
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const showProfileFeedback = (
    message: string,
    variant: "success" | "error",
    toastType?: Parameters<typeof showToast>[1],
  ) => {
    setFeedback(message)
    setFeedbackVariant(variant)
    if (toastType) showToast(message, toastType)
  }
  // Keep tab switching + haptic behavior consistent everywhere this is called.
  const selectTab = (tab: "videos" | "liked") => {
    setActiveTab(tab)
    haptic.light()
  }
  // Shared skeleton grid used by both "Sets" and "Liked" while content is loading.
  const renderGridSkeleton = (prefix: string) => (
    <div className="grid grid-cols-3 gap-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <GridItemSkeleton key={`${prefix}-${index}`} />
      ))}
    </div>
  )
  const renderPostGrid = (items: typeof userPosts) => (
    // Shared grid renderer for uploaded and liked posts.
    <div className="grid grid-cols-3 gap-1">
      {items.map((post) => (
        <div
          key={post.id}
          className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover-lift active-scale tap-highlight-none transition-all duration-300 ease-out"
          onClick={() => {
            haptic.light()
            onSelectPost(post.id)
          }}
        >
          {post.thumbnailURL ? (
            <Image src={post.thumbnailURL} alt={post.title} fill className="object-cover" />
          ) : (
            <video src={post.videoURL} className="h-full w-full object-contain bg-black" muted loop playsInline />
          )}
          <div className="absolute bottom-2 left-2">
            <span className="text-white text-xs font-medium bg-black/60 px-2 py-1 rounded">
              {formatLargeNumber(post.viewCount ?? 0)} views
            </span>
          </div>
        </div>
      ))}
    </div>
  )

  useEffect(() => {
    // Keep input synced with persisted stage name, with a deterministic fallback for first-time users.
    if (savedDisplayName) {
      setDisplayName(savedDisplayName)
    } else if (user) {
      setDisplayName(`comedian-${user.uid.slice(0, 6)}`)
    }
  }, [savedDisplayName, user])

  const userPosts = useMemo(() => {
    // Clips uploaded by the current comedian.
    if (!user || user.isAnonymous) return []
    return posts.filter((post) => post.userId === user.uid)
  }, [posts, user])

  const totalLikes = useMemo(
    () => userPosts.reduce((sum, post) => sum + (post.likes?.length ?? 0), 0),
    [userPosts],
  )

  const totalViews = useMemo(
    // Accumulate views so users can see how often their clips are watched.
    () => userPosts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0),
    [userPosts],
  )

  const likedPosts = useMemo(() => {
    // Clips liked by this user (used for the "Liked" tab).
    if (!user || user.isAnonymous) return []
    return posts.filter((post) => post.likes?.includes(user.uid))
  }, [posts, user])

  const avatar = useMemo(
    () => buildAvatarPlaceholder((displayName || user?.uid) ?? "guest"),
    [displayName, user?.uid],
  )
  const isOfficialAccount = profileMeta?.accountType === "editorial" || profileMeta?.isSeedAccount === true
  const officialLabel = profileMeta?.officialLabel?.trim() || "Official OpenMic"
  // Anonymous users can browse but some profile actions are gated.
  const isAnonymous = !user || user.isAnonymous

  const handleSave = async () => {
    if (!user || !displayName.trim()) return
    setIsSaving(true)
    try {
      // Persist the chosen stage name so other users can see it in feed/search.
      await updateDisplayName(user.uid, displayName.trim())
      showProfileFeedback("Stage name saved", "success", "success")
      haptic.medium()
      setShowSaveSuccess(true)
      setTimeout(() => setShowSaveSuccess(false), 800)
    } catch (error) {
      console.error("Failed to update display name", error)
      if (error instanceof DisplayNameUnavailableError) {
        showProfileFeedback("That stage name is already taken.", "error", "error")
      } else {
        const message = getErrorMessage(error)
        showProfileFeedback(message, "error", "error")
      }
      setShowSaveSuccess(false)
    } finally {
      setIsSaving(false)
      setTimeout(() => {
        setFeedback(null)
        setFeedbackVariant("success")
      }, 3000)
    }
  }

  const handleCopyProfile = async () => {
    if (!user) return
    const link = `${window.location.origin}/profile/${user.uid}`
    try {
      // Prefer the async clipboard API but fall back for older browsers.
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = link
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      showProfileFeedback("Profile link copied", "success", "success")
      haptic.light()
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 700)
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      console.error("Failed to copy profile link", error)
      showProfileFeedback("Unable to copy link", "error", "error")
      setCopySuccess(false)
    }
  }

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        {/* Profile header + account actions */}
        <div className="flex items-center justify-between p-4 pt-8">
          <h1 className="text-xl font-bold">Profile</h1>
          <div className="flex items-center gap-2">
            {user?.isAnonymous && (
              <button
                type="button"
                onClick={() => {
                  haptic.light()
                  onRequestAuth()
                }}
                className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-black active-scale tap-highlight-none transition-all duration-300 ease-out hover:bg-gray-200 hover:scale-102 focus-visible-ring"
                aria-label="Sign in to save your profile"
              >
                Sign in
              </button>
            )}
            <button
              onClick={() => {
                haptic.light()
                setShowSettings(true)
              }}
              className="p-2 hover:bg-gray-800 rounded-full active-scale tap-highlight-none transition-all duration-200 ease-out focus-visible-ring"
              aria-label="Open playback settings"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6">
          {/* Identity/stats/editor section */}
          <div className="flex items-center gap-6 mb-4">
            <Image
              src={avatar}
              alt={displayName}
              width={80}
              height={80}
              className="rounded-full border-2 border-gray-700"
            />
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-xl font-bold">{userPosts.length}</div>
                <div className="text-sm text-gray-400">Sets</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{formatLargeNumber(totalLikes)}</div>
                <div className="text-sm text-gray-400">Laughs</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">{formatLargeNumber(totalViews)}</div>
                <div className="text-sm text-gray-400">Views</div>
              </div>
            </div>
          </div>

          {!user?.isAnonymous && user?.email && (
            <p className="mb-4 text-sm text-gray-400">Signed in as {user.email}</p>
          )}
          {isOfficialAccount && (
            <p className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
              {officialLabel}
            </p>
          )}

          {authError && <p className="mb-3 text-sm text-red-400">{authError}</p>}

          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm text-gray-400" htmlFor="stage-name-input">
                Stage Name (public)
              </label>
              <input
                id="stage-name-input"
                type="text"
                value={displayName}
                onChange={(event) => {
                  const sanitized = sanitizeDisplayName(event.target.value)
                  setDisplayName(sanitized)
                }}
                maxLength={stageNameMaxLength}
                className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus-visible-ring transition-all duration-200 ${
                  showSaveSuccess ? "ring-2 ring-emerald-400/50" : ""
                }`}
                aria-label="Stage name"
                aria-describedby={`${stageNameHintId} ${stageNameCountId}`}
              />
              <div className="mt-1 flex items-baseline justify-between text-xs text-gray-500">
                <p id={stageNameHintId}>3-40 characters • Letters, numbers, spaces, hyphens, underscores</p>
                <p
                  id={stageNameCountId}
                  aria-live="polite"
                  role="status"
                  aria-atomic="true"
                >
                  {displayName.length}/{stageNameMaxLength}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving || !displayName.trim()}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold bg-white text-black active-scale tap-highlight-none transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed focus-visible-ring ${
                  showSaveSuccess ? "animate-bounce-subtle" : ""
                }`}
                aria-label={isSaving ? "Saving stage name" : "Save stage name"}
              >
                <div className="flex items-center justify-center gap-2">
                  <Save size={18} />
                  {isSaving ? "Saving" : "Save name"}
                </div>
              </button>
              <button
                onClick={handleCopyProfile}
                className={`px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 active-scale tap-highlight-none transition-all duration-200 ease-out focus-visible-ring ${
                  copySuccess ? "animate-bounce-subtle" : ""
                }`}
                aria-label="Copy profile link"
              >
                <UserPlus size={20} />
              </button>
            </div>
            {!isAnonymous && (
              <button
                onClick={() => {
                  void logout().catch((error) => {
                    console.error("Failed to log out", error)
                    showToast(getErrorMessage(error), "error")
                  })
                  haptic.light()
                }}
                disabled={authLoading}
                className="w-full rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 active-scale tap-highlight-none transition-all duration-200 ease-out hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible-ring"
                aria-label={authLoading ? "Signing out" : "Sign out"}
              >
                {authLoading ? "Signing out…" : "Sign out"}
              </button>
            )}
            {feedback && (
              <p className={`text-sm ${feedbackVariant === "error" ? "text-red-400" : "text-emerald-300"}`}>
                {feedback}
              </p>
            )}
          </div>
        </div>

        <div className="border-b border-gray-800" role="tablist" aria-label="Profile tabs">
          <div className="flex">
            {PROFILE_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => selectTab(tab.key)}
                  className={`flex-1 py-3 flex items-center justify-center gap-2 active-scale tap-highlight-none transition-all duration-300 ease-out ${
                    isActive ? "text-white border-b-2 border-white" : "text-gray-400 hover:text-gray-200"
                  } focus-visible-ring`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="profile-content"
                >
                  <Icon size={18} />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4" role="tabpanel" id="profile-content" aria-live="polite">
          {/* Tab body section: uploaded sets vs liked sets */}
          {activeTab === "videos" ? (
            postsLoading && userPosts.length === 0 ? (
              renderGridSkeleton("profile-upload-skeleton")
            ) : userPosts.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
                <Grid size={48} className="text-gray-600" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{isAnonymous ? "No sets yet" : "Share your first set"}</h3>
                  <p className="text-sm text-gray-400">
                    {isAnonymous
                      ? "Sign in to start uploading your stand-up clips and build your comedy portfolio."
                      : "Upload your best stand-up moments and start building your audience."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isAnonymous) {
                      haptic.light()
                      onRequestAuth()
                    } else {
                      haptic.light()
                      onNavigateToTab?.("upload")
                    }
                  }}
                  className="inline-flex items-center justify-center bg-white text-black rounded-full px-6 py-3 font-semibold hover:bg-gray-200 active-scale tap-highlight-none transition-all duration-300 ease-out"
                >
                  {isAnonymous ? "Sign In to Upload" : "Upload a Set"}
                </button>
              </div>
            ) : (
              renderPostGrid(userPosts)
            )
          ) : postsLoading && likedPosts.length === 0 ? (
            renderGridSkeleton("profile-liked-skeleton")
          ) : likedPosts.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
              <Heart size={48} className="text-gray-600" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No liked sets yet</h3>
                <p className="text-sm text-gray-400">
                  Start exploring the feed and tap the heart on sets that make you laugh. They&#39;ll appear here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptic.light()
                  onNavigateToTab?.("home")
                }}
                className="inline-flex items-center justify-center bg-white text-black rounded-full px-6 py-3 font-semibold hover:bg-gray-200 active-scale tap-highlight-none transition-all duration-300 ease-out"
              >
                Discover Sets
              </button>
            </div>
          ) : (
            renderPostGrid(likedPosts)
          )}
        </div>
      </div>

      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
    </div>
  )
}

interface SettingsSheetProps {
  onClose: () => void
}

function SettingsSheet({ onClose }: SettingsSheetProps) {
  const { preferences, setPreference, reset } = usePlaybackSettings()
  const sheetRef = useRef<HTMLDivElement>(null)
  const descriptionId = "settings-description"
  const haptic = useHapticFeedback()
  const [isClosing, setIsClosing] = useState(false)

  useFocusTrap(sheetRef, true)

  // Close with animation first, then unmount to avoid abrupt visual jumps.
  const closeSheet = useCallback(() => {
    if (isClosing) return
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 200)
  }, [isClosing, onClose])

  useEffect(() => {
    // Accessibility: focus first interactive control when sheet opens.
    const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    firstFocusable?.focus()
  }, [])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeSheet()
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 ${
        isClosing ? "animate-out fade-out duration-200" : "animate-in fade-in duration-300"
      }`}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (isClosing) return
        haptic.light()
        closeSheet()
      }}
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-md rounded-2xl bg-gray-900 p-6 shadow-lg focus-visible-ring ${
          isClosing ? "animate-out fade-out scale-out duration-200" : "animate-in fade-in scale-in duration-300"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 id="settings-title" className="text-xl font-semibold text-white">
              Playback preferences
            </h2>
            <p id={descriptionId} className="text-sm text-gray-400">
              Tune how videos behave across the app.
            </p>
          </div>
          <button
            onClick={() => {
              if (isClosing) return
              haptic.light()
              closeSheet()
            }}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white active-scale tap-highlight-none focus-visible-ring"
            type="button"
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <SettingToggle
            label="Autoplay in feed"
            description="Start playing clips automatically when they appear on screen."
            active={preferences.autoplay}
            onToggle={() => setPreference("autoplay", !preferences.autoplay)}
          />
          <SettingToggle
            label="Start muted"
            description="Keep the feed silent until you tap for sound."
            active={preferences.startMuted}
            onToggle={() => setPreference("startMuted", !preferences.startMuted)}
          />
          <SettingToggle
            label="Loop videos"
            description="Repeat clips continuously while they stay in view."
            active={preferences.loop}
            onToggle={() => setPreference("loop", !preferences.loop)}
          />
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
          <button
            onClick={() => {
              reset()
              haptic.light()
            }}
            className="underline underline-offset-4 hover:text-white active-scale tap-highlight-none transition-colors focus-visible-ring"
            type="button"
            aria-label="Reset to default settings"
          >
            Reset defaults
          </button>
          <button
            onClick={() => {
              if (isClosing) return
              haptic.light()
              closeSheet()
            }}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200 active-scale tap-highlight-none transition-all duration-200 ease-out focus-visible-ring"
            type="button"
            aria-label="Close settings"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

interface SettingToggleProps {
  label: string
  description: string
  active: boolean
  onToggle: () => void
}

function SettingToggle({ label, description, active, onToggle }: SettingToggleProps) {
  const haptic = useHapticFeedback()
  return (
    <button
      type="button"
      onClick={() => {
        haptic.light()
        onToggle()
      }}
      className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 text-left active-scale tap-highlight-none transition-all duration-300 ease-out hover:border-gray-700 hover:bg-gray-800 focus-visible-ring"
      role="switch"
      aria-checked={active}
      aria-label={label}
    >
      <div className="pr-4">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full px-1 transition-colors duration-200 ease-out ${
          active ? "bg-emerald-500 justify-end" : "bg-gray-600 justify-start"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-out" />
      </span>
    </button>
  )
}
