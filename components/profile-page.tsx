"use client"

import { useEffect, useMemo, useState } from "react"
import { Settings, Grid, Heart, UserPlus, Save } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { usePostsContext } from "@/components/posts-provider"
import { updateDisplayName } from "@/lib/data/users"
import { buildAvatarPlaceholder, formatLargeNumber } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"

export default function ProfilePage() {
  const { user } = useAuth()
  const { posts } = usePostsContext()
  const [activeTab, setActiveTab] = useState("videos")
  const savedDisplayName = useDisplayName(user?.uid)
  const [displayName, setDisplayName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (savedDisplayName) {
      setDisplayName(savedDisplayName)
    } else if (user) {
      setDisplayName(`comedian-${user.uid.slice(0, 6)}`)
    }
  }, [savedDisplayName, user])

  const userPosts = useMemo(() => {
    if (!user) return []
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
          <button className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <Settings size={24} />
          </button>
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
                  <div key={post.id} className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden">
                    {post.thumbnailURL ? (
                      <Image src={post.thumbnailURL} alt={post.title} fill className="object-cover" />
                    ) : (
                      <video src={post.videoURL} className="h-full w-full object-cover" muted loop playsInline />
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
            <div className="text-center py-12">
              <Heart size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400">Liked sets will appear here soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
