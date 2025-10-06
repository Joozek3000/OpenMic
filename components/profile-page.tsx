"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings, Grid, Heart, UserPlus, Save, X } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { usePostsContext } from "@/components/posts-provider"
import { updateDisplayName } from "@/lib/data/users"
import { buildAvatarPlaceholder, formatLargeNumber } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"
import { usePlaybackSettings } from "@/components/playback-settings-provider"

interface ProfilePageProps {
  onSelectPost: (postId: string) => void
  onRequestAuth: () => void
}

export default function ProfilePage({ onSelectPost, onRequestAuth }: ProfilePageProps) {
  const { user, logout, loading: authLoading, error: authError } = useAuth()
  const { posts } = usePostsContext()
  const [activeTab, setActiveTab] = useState("videos")
  const savedDisplayName = useDisplayName(user?.uid)
  const [displayName, setDisplayName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    if (savedDisplayName) {
      setDisplayName(savedDisplayName)
    } else if (user) {
      setDisplayName(`comedian-${user.uid.slice(0, 6)}`)
    }
  }, [savedDisplayName, user])

  const userPosts = useMemo(() => {
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
    if (!user || user.isAnonymous) return []
    return posts.filter((post) => post.likes?.includes(user.uid))
  }, [posts, user])

  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || user?.uid ?? "guest"), [displayName, user?.uid])

  const handleSave = async () => {
    if (!user || !displayName.trim()) return
    setIsSaving(true)
    try {
      // Persist the chosen stage name so other users can see it in feed/search.
      await updateDisplayName(user.uid, displayName.trim())
      setFeedback("Stage name saved")
    } catch (error) {
      console.error("Failed to update display name", error)
      setFeedback("Could not save name. Try again.")
    } finally {
      setIsSaving(false)
      setTimeout(() => setFeedback(null), 3000)
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
      setFeedback("Profile link copied")
      setTimeout(() => setFeedback(null), 2000)
    } catch (error) {
      console.error("Failed to copy profile link", error)
      setFeedback("Unable to copy link")
    }
  }

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between p-4 pt-8">
          <h1 className="text-xl font-bold">Profile</h1>
          <div className="flex items-center gap-2">
            {user?.isAnonymous && (
              <button
                onClick={onRequestAuth}
                className="rounded-full border border-gray-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-200 hover:bg-gray-800"
              >
                Sign in
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <Settings size={24} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-6">
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

          {authError && <p className="mb-3 text-sm text-red-400">{authError}</p>}

          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm text-gray-400">Stage Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving || !displayName.trim()}
                className="flex-1 py-2 px-4 rounded-lg font-semibold transition-colors bg-white text-black disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  <Save size={18} />
                  {isSaving ? "Saving" : "Save name"}
                </div>
              </button>
              <button
                onClick={handleCopyProfile}
                className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <UserPlus size={20} />
              </button>
            </div>
            {!user?.isAnonymous && (
              <button
                onClick={() => logout()}
                disabled={authLoading}
                className="w-full rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authLoading ? "Signing out…" : "Sign out"}
              </button>
            )}
            {feedback && <p className="text-sm text-emerald-300">{feedback}</p>}
          </div>
        </div>

        <div className="border-b border-gray-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab("videos")}
              className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "videos" ? "text-white border-b-2 border-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Grid size={18} />
              <span className="font-medium">Sets</span>
            </button>
            <button
              onClick={() => setActiveTab("liked")}
              className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${
                activeTab === "liked" ? "text-white border-b-2 border-white" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Heart size={18} />
              <span className="font-medium">Liked</span>
            </button>
          </div>
        </div>

        <div className="p-4">
          {activeTab === "videos" ? (
            userPosts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">You have not uploaded any sets yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => onSelectPost(post.id)}
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
          ) : (
            likedPosts.length === 0 ? (
              <div className="text-center py-12">
                <Heart size={48} className="mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">Liked sets will appear here soon.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {likedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
                    onClick={() => onSelectPost(post.id)}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Playback preferences</h2>
            <p className="text-sm text-gray-400">Tune how videos behave across the app.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            type="button"
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
            onClick={reset}
            className="underline underline-offset-4 hover:text-white"
            type="button"
          >
            Reset defaults
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black hover:bg-gray-200"
            type="button"
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
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-700 hover:bg-gray-800"
    >
      <div className="pr-4">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          active ? "bg-emerald-500" : "bg-gray-600"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            active ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  )
}
