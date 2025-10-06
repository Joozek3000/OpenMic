"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, TrendingUp, Hash, Play } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { useFilters, type SortOrder } from "@/components/filters-provider"
import { useFollow } from "@/components/follow-provider"
import { usePostsContext } from "@/components/posts-provider"
import { STANDUP_CATEGORIES } from "@/lib/constants"
import { buildAvatarPlaceholder, formatLargeNumber, getCategoryLabel } from "@/lib/utils"
import type { Post } from "@/lib/types"
import { useDisplayName } from "@/hooks/use-display-name"
import { getDisplayName } from "@/lib/data/users"

interface SearchPageProps {
  onSelectPost: (postId: string) => void
  onRequestAuth?: () => void
}

interface SearchUserRowProps {
  userId: string
  sets: number
  likes: number
  views: number
  onToggleFollow: () => void
  isFollowing: boolean
  disabled: boolean
  onOpenProfile: () => void
  onRequestAuth?: () => void
  displayNameHint?: string
}

function SearchUserRow({
  userId,
  sets,
  likes,
  views,
  onToggleFollow,
  isFollowing,
  disabled,
  onOpenProfile,
  onRequestAuth,
  displayNameHint,
}: SearchUserRowProps) {
  const { user } = useAuth()
  const fetchedName = useDisplayName(userId)
  const name = displayNameHint && displayNameHint.length > 0 ? displayNameHint : fetchedName ?? "Anonymous"
  const avatar = useMemo(() => buildAvatarPlaceholder(name || userId), [name, userId])
  const canFollow = !!user && !user.isAnonymous && user.uid !== userId
  const buttonLabel = canFollow ? (isFollowing ? "Following" : "Follow") : "Sign in"
  const buttonClasses = canFollow
    ? isFollowing
      ? "bg-white/10 text-white"
      : "bg-white text-black hover:bg-gray-200"
    : "bg-white text-black"

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onOpenProfile}
        className="flex items-center gap-3 text-left transition-transform hover:scale-[1.01]"
      >
        <Image src={avatar} alt={name} width={40} height={40} className="rounded-full" />
        <div>
          <div className="font-semibold">@{name.replace(/\s+/g, "").toLowerCase()}</div>
          <div className="text-sm text-gray-400">
            {sets} {sets === 1 ? "set" : "sets"} · {formatLargeNumber(views)} views · {formatLargeNumber(likes)} laughs
          </div>
        </div>
      </button>
      {user?.uid !== userId && (
        <button
          onClick={() => {
            if (!canFollow) {
              onRequestAuth?.()
              return
            }
            onToggleFollow()
          }}
          disabled={disabled || (!canFollow && !onRequestAuth)}
          className={`px-4 py-1 rounded-full text-sm font-semibold transition-colors ${buttonClasses} ${
            disabled || (!canFollow && !onRequestAuth) ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}

export default function SearchPage({ onSelectPost, onRequestAuth }: SearchPageProps) {
  const { posts, loading } = usePostsContext()
  const { category, setCategory, sortOrder, setSortOrder } = useFilters()
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("trending")
  const [selectedProfile, setSelectedProfile] = useState<
    | null
    | {
        userId: string
        sets: number
        likes: number
        views: number
        displayName?: string
      }
  >(null)
  const sortOptions: { key: SortOrder; label: string }[] = [
    { key: "trending", label: "Trending" },
    { key: "newest", label: "Newest" },
    { key: "likes", label: "Most Liked" },
  ]
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const categoryFilteredPosts = useMemo(
    () => (category === "all" ? posts : posts.filter((post) => post.category === category)),
    [posts, category],
  )

  const matchingPosts = useMemo(() => {
    // Apply text + profile filters against the category-scoped subset.
    return categoryFilteredPosts.filter((post) => {
      if (!normalizedQuery) return true
      const title = post.title.toLowerCase()
      const description = post.description.toLowerCase()
      if (title.includes(normalizedQuery) || description.includes(normalizedQuery)) {
        return true
      }
      const displayName = displayNames[post.userId]?.toLowerCase() ?? ""
      const handle = displayName.replace(/\s+/g, "")
      const userIdLower = post.userId.toLowerCase()
      return displayName.includes(normalizedQuery) || handle.includes(normalizedQuery) || userIdLower.includes(normalizedQuery)
    })
  }, [categoryFilteredPosts, displayNames, normalizedQuery])

  const sortedPosts = useMemo(() => {
    const postsToSort = [...matchingPosts]
    const toMillis = (timestamp: (typeof matchingPosts)[number]["timestamp"]) =>
      typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : 0

    if (sortOrder === "newest") {
      return postsToSort.sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))
    }

    if (sortOrder === "likes") {
      return postsToSort.sort((a, b) => (b.likes?.length ?? 0) - (a.likes?.length ?? 0))
    }

    // Default to trending: prioritize views, then likes as a tie-breaker.
    return postsToSort.sort((a, b) => {
      const viewDelta = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (viewDelta !== 0) return viewDelta
      return (b.likes?.length ?? 0) - (a.likes?.length ?? 0)
    })
  }, [matchingPosts, sortOrder])

  const userSummaries = useMemo(() => {
    // Build per-comedian aggregates scoped to the selected category.
    const aggregation = new Map<string, { sets: number; likes: number; views: number }>()
    categoryFilteredPosts.forEach((post) => {
      const entry = aggregation.get(post.userId) ?? { sets: 0, likes: 0, views: 0 }
      entry.sets += 1
      entry.likes += post.likes?.length ?? 0
      entry.views += post.viewCount ?? 0
      aggregation.set(post.userId, entry)
    })
    return Array.from(aggregation.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.views - a.views)
  }, [categoryFilteredPosts])

  const filteredUserSummaries = useMemo(() => {
    if (!normalizedQuery) {
      return userSummaries
    }

    return userSummaries.filter((summary) => {
      const displayName = displayNames[summary.userId]?.toLowerCase() ?? ""
      const handle = displayName.replace(/\s+/g, "")
      const userIdLower = summary.userId.toLowerCase()
      const matchesIdentity =
        displayName.includes(normalizedQuery) || handle.includes(normalizedQuery) || userIdLower.includes(normalizedQuery)

      if (matchesIdentity) {
        return true
      }

      return categoryFilteredPosts.some((post) => {
        if (post.userId !== summary.userId) return false
        const title = post.title.toLowerCase()
        const description = post.description.toLowerCase()
        return title.includes(normalizedQuery) || description.includes(normalizedQuery)
      })
    })
  }, [categoryFilteredPosts, displayNames, normalizedQuery, userSummaries])

  const hashtagSummaries = useMemo(() => {
    // Surface category chips with aggregated performance stats.
    return STANDUP_CATEGORIES.map((categoryItem) => {
      const filtered = categoryFilteredPosts.filter((post) => post.category === categoryItem.value)
      const totalLikes = filtered.reduce((sum, post) => sum + (post.likes?.length ?? 0), 0)
      const totalViews = filtered.reduce((sum, post) => sum + (post.viewCount ?? 0), 0)
      return {
        category: categoryItem,
        count: filtered.length,
        likes: totalLikes,
        views: totalViews,
      }
    }).filter((entry) => entry.count > 0)
  }, [categoryFilteredPosts])

  useEffect(() => {
    const userIds = Array.from(new Set(categoryFilteredPosts.map((post) => post.userId)))
    const missingIds = userIds.filter((id) => !(id in displayNames))
    if (missingIds.length === 0) return

    let isMounted = true

    const loadDisplayNames = async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          const name = await getDisplayName(id)
          return [id, name?.trim() ?? ""] as const
        }),
      )
      if (!isMounted) return
      setDisplayNames((current) => {
        const next = { ...current }
        for (const [id, name] of entries) {
          next[id] = name
        }
        return next
      })
    }

    void loadDisplayNames()

    return () => {
      isMounted = false
    }
  }, [categoryFilteredPosts, displayNames])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    posts.forEach((post) => {
      if (post.category) {
        categories.add(post.category)
      }
    })
    if (categories.size === 0) {
      return STANDUP_CATEGORIES
    }
    return STANDUP_CATEGORIES.filter((categoryOption) => categories.has(categoryOption.value))
  }, [posts])

  useEffect(() => {
    if (category === "all") return
    const stillAvailable = availableCategories.some((categoryOption) => categoryOption.value === category)
    if (!stillAvailable) {
      setCategory("all")
    }
  }, [availableCategories, category, setCategory])

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        <div className="p-4 pt-8">
          <h1 className="text-2xl font-bold mb-4">Discover</h1>

          <div className="relative mb-4">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comedians, sets, categories..."
              className="w-full bg-gray-800 border border-gray-700 rounded-full pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
            />
          </div>

          <div className="-mx-4 mb-4">
            <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
              <button
                onClick={() => setCategory("all")}
                className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 border leading-none ${
                  category === "all"
                    ? "bg-white text-black border-white shadow-sm"
                    : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white"
                }`}
              >
                All Comedy
              </button>
              {availableCategories.map((categoryOption) => (
                <button
                  key={categoryOption.value}
                  onClick={() => setCategory(categoryOption.value)}
                  className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 border leading-none ${
                    category === categoryOption.value
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white"
                  }`}
                >
                  {categoryOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab("trending")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                activeTab === "trending" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              Trending
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                activeTab === "users" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              Comics
            </button>
            <button
              onClick={() => setActiveTab("hashtags")}
              className={`px-4 py-2 rounded-full font-medium transition-colors ${
                activeTab === "hashtags" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              Tags
            </button>
          </div>
        </div>

        <div className="px-4 pb-10">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading sets…</div>
          ) : activeTab === "trending" ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-red-500" />
                <h2 className="text-lg font-semibold">Trending Stand-Up</h2>
              </div>
              <div className="-mx-4 mb-4">
                <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
                  {sortOptions.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => setSortOrder(option.key)}
                      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 border leading-none ${
                        sortOrder === option.key
                          ? "bg-white text-black border-white shadow-sm"
                          : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {sortedPosts.length === 0 ? (
                <p className="text-gray-400 text-sm">No sets match your search yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {sortedPosts.slice(0, 12).map((post) => (
                    <div
                      key={post.id}
                      className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden group cursor-pointer"
                      onClick={() => onSelectPost(post.id)}
                    >
                      {post.thumbnailURL ? (
                        <Image
                          src={post.thumbnailURL}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        // Fallback to the actual video if no poster image is available yet.
                        <video
                          src={post.videoURL}
                          className="h-full w-full object-contain bg-black transition-transform group-hover:scale-105"
                          muted
                          loop
                          playsInline
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center">
                          <Play size={18} className="text-white" />
                        </div>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <div className="flex items-center justify-between text-xs text-white/80">
                          <span className="bg-black/50 px-2 py-1 rounded">{formatLargeNumber(post.viewCount ?? 0)} views</span>
                          <span className="bg-white/10 px-2 py-1 rounded">{getCategoryLabel(post.category)}</span>
                        </div>
                        <p className="text-xs text-white mt-1 line-clamp-2">{post.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === "users" ? (
            <div>
              <h2 className="text-lg font-semibold mb-4">Comedians</h2>
              {filteredUserSummaries.length === 0 ? (
                <p className="text-gray-400 text-sm">No comedians match your filters yet.</p>
              ) : (
                <div className="space-y-4">
                  {filteredUserSummaries.map((summary) => (
                    <SearchUserRow
                      key={summary.userId}
                      userId={summary.userId}
                      sets={summary.sets}
                      likes={summary.likes}
                      views={summary.views}
                      onToggleFollow={() => toggleFollow(summary.userId)}
                      isFollowing={isFollowing(summary.userId)}
                      disabled={followLoading}
                      onOpenProfile={() =>
                        setSelectedProfile({
                          userId: summary.userId,
                          sets: summary.sets,
                          likes: summary.likes,
                          views: summary.views,
                          displayName: displayNames[summary.userId],
                        })
                      }
                      onRequestAuth={onRequestAuth}
                      displayNameHint={displayNames[summary.userId]}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-semibold mb-4">Comedy Tags</h2>
              {hashtagSummaries.length === 0 ? (
                <p className="text-gray-400 text-sm">No categories match your filters.</p>
              ) : (
                <div className="space-y-4">
                  {hashtagSummaries.map(({ category: categoryItem, count, likes, views }) => (
                    <div key={categoryItem.value} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                          <Hash size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <div className="font-semibold">#{categoryItem.label.replace(/\s+/g, "").toLowerCase()}</div>
                          <div className="text-sm text-gray-400">
                            {count} {count === 1 ? "set" : "sets"} · {formatLargeNumber(views)} views · {formatLargeNumber(likes)} laughs
                          </div>
                        </div>
                      </div>
                      <button
                        className="text-gray-400 hover:text-white transition-colors"
                        onClick={() => setCategory(categoryItem.value)}
                      >
                        <TrendingUp size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {selectedProfile && (
        <MiniProfileSheet
          userId={selectedProfile.userId}
          sets={selectedProfile.sets}
          likes={selectedProfile.likes}
          views={selectedProfile.views}
          posts={posts}
          onClose={() => setSelectedProfile(null)}
          onSelectPost={(postId) => {
            onSelectPost(postId)
            setSelectedProfile(null)
          }}
          isFollowing={isFollowing(selectedProfile.userId)}
          onToggleFollow={() => toggleFollow(selectedProfile.userId)}
          followDisabled={followLoading}
          onRequestAuth={onRequestAuth}
          displayNameHint={selectedProfile.displayName}
        />
      )}
    </div>
  )
}

interface MiniProfileSheetProps {
  userId: string
  sets: number
  likes: number
  views: number
  posts: Post[]
  onClose: () => void
  onSelectPost: (postId: string) => void
  isFollowing: boolean
  onToggleFollow: () => void
  followDisabled: boolean
  onRequestAuth?: () => void
  displayNameHint?: string
}

function MiniProfileSheet({
  userId,
  sets,
  likes,
  views,
  posts,
  onClose,
  onSelectPost,
  isFollowing,
  onToggleFollow,
  followDisabled,
  onRequestAuth,
  displayNameHint,
}: MiniProfileSheetProps) {
  const { user } = useAuth()
  const fetchedName = useDisplayName(userId)
  const preferredName = displayNameHint && displayNameHint.length > 0 ? displayNameHint : fetchedName ?? ""
  const displayName = preferredName.trim().length > 0 ? preferredName : "Anonymous Comedian"
  const handle = useMemo(
    () => (preferredName.trim().length > 0 ? preferredName : userId).replace(/\s+/g, "").toLowerCase(),
    [preferredName, userId],
  )
  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || userId), [displayName, userId])
  const canFollow = !!user && !user.isAnonymous && user.uid !== userId
  const followLabel = canFollow ? (isFollowing ? "Following" : "Follow") : "Sign in"
  const followClasses = canFollow
    ? isFollowing
      ? "bg-white/10 text-white"
      : "bg-white text-black hover:bg-gray-200"
    : "bg-white text-black"

  const topPosts = useMemo(() => {
    return posts
      .filter((post) => post.userId === userId)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 3)
  }, [posts, userId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-gray-900 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Image src={avatar} alt={displayName} width={56} height={56} className="rounded-full border border-gray-700" />
            <div>
              <div className="text-lg font-semibold text-white">{displayName}</div>
              <div className="text-sm text-gray-400">@{handle}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm text-gray-300">
          <div>
            <div className="text-xl font-semibold text-white">{sets}</div>
            <div>Sets</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{formatLargeNumber(views)}</div>
            <div>Views</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-white">{formatLargeNumber(likes)}</div>
            <div>Laughs</div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-400">
          Bio coming soon. Follow now to find out when new sets drop or this comic goes on tour.
        </p>

        {user?.uid !== userId && (
          <button
            type="button"
            onClick={() => {
              if (!canFollow) {
                onRequestAuth?.()
                return
              }
              onToggleFollow()
            }}
            disabled={followDisabled || (!canFollow && !onRequestAuth)}
            className={`mt-4 w-full rounded-full py-2 text-sm font-semibold transition-colors ${followClasses} ${
              followDisabled || (!canFollow && !onRequestAuth) ? "cursor-not-allowed opacity-60" : ""
            }`}
          >
            {followLabel}
          </button>
        )}

        <div className="mt-6">
          <div className="mb-3 text-sm font-semibold text-gray-300">Top moments</div>
          {topPosts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 p-4 text-center text-sm text-gray-500">
              No clips yet — check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {topPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onSelectPost(post.id)}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-800 bg-gray-800"
                >
                  {post.thumbnailURL ? (
                    <Image src={post.thumbnailURL} alt={post.title} fill className="object-cover" />
                  ) : (
                    <video src={post.videoURL} className="h-full w-full object-cover" muted loop playsInline />
                  )}
                  <div className="absolute bottom-1 left-1 right-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                    {formatLargeNumber(post.viewCount ?? 0)} views
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
