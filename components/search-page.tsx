"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import { Search, TrendingUp, Hash, Play, Users, Clapperboard } from "lucide-react"
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
import { GridItemSkeleton, UserRowSkeleton } from "@/components/skeletons"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"

interface SearchPageProps {
  onSelectPost: (postId: string) => void
  onRequestAuth?: () => void
}

const SORT_OPTIONS: { key: SortOrder; label: string }[] = [
  { key: "trending", label: "Trending" },
  { key: "newest", label: "Newest" },
  { key: "likes", label: "Most Liked" },
]
const SEARCH_TABS = [
  { key: "trending", label: "Trending" },
  { key: "users", label: "Comics" },
  { key: "hashtags", label: "Tags" },
] as const

function getPreferredName(hint: string | undefined, fetched: string | null | undefined, fallback: string) {
  const preferred = hint?.trim()
  if (preferred) return preferred
  const fetchedTrimmed = fetched?.trim()
  if (fetchedTrimmed) return fetchedTrimmed
  return fallback
}

function toHandle(value: string) {
  return value.replace(/\s+/g, "").toLowerCase()
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
  currentUserId?: string
  canFollowUsers: boolean
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
  currentUserId,
  canFollowUsers,
}: SearchUserRowProps) {
  const name = getPreferredName(displayNameHint, null, "Anonymous")
  const avatar = useMemo(() => buildAvatarPlaceholder(name || userId), [name, userId])
  const canFollow = canFollowUsers && currentUserId !== userId
  const buttonLabel = canFollow ? (isFollowing ? "Following" : "Follow") : "Sign in"
  const buttonClasses = canFollow
    ? isFollowing
      ? "bg-white/10 text-white"
      : "bg-white text-black hover:bg-gray-200"
    : "bg-white text-black"
  const haptic = useHapticFeedback()

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={() => {
          onOpenProfile()
          haptic.light()
        }}
        className="flex items-center gap-3 text-left active-scale tap-highlight-none transition-transform duration-200 ease-out hover:scale-102 focus-visible-ring"
        aria-label={`View profile of ${name}`}
      >
        <Image src={avatar} alt={name} width={40} height={40} className="rounded-full" />
        <div>
          <div className="font-semibold">@{toHandle(name)}</div>
          <div className="text-sm text-gray-400">
            {sets} {sets === 1 ? "set" : "sets"} · {formatLargeNumber(views)} views · {formatLargeNumber(likes)} laughs
          </div>
        </div>
      </button>
      {currentUserId !== userId && (
        <button
          onClick={() => {
            if (!canFollow) {
              onRequestAuth?.()
              haptic.light()
              return
            }
            onToggleFollow()
            haptic.medium()
          }}
          disabled={disabled || (!canFollow && !onRequestAuth)}
          className={`min-h-[48px] px-4 py-1 rounded-full text-sm font-semibold active-scale tap-highlight-none transition-all duration-300 ease-out ${buttonClasses} ${
            disabled || (!canFollow && !onRequestAuth) ? "opacity-60 cursor-not-allowed" : ""
          } focus-visible-ring`}
          aria-label={
            canFollow
              ? isFollowing
                ? `Unfollow ${name}`
                : `Follow ${name}`
              : "Sign in to follow"
          }
          aria-pressed={canFollow ? isFollowing : undefined}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}

const MemoizedSearchUserRow = memo(SearchUserRow)

export default function SearchPage({ onSelectPost, onRequestAuth }: SearchPageProps) {
  const { user } = useAuth()
  const { posts, loading } = usePostsContext()
  const { category, setCategory, sortOrder, setSortOrder } = useFilters()
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow()
  // Raw input state + debounced query keep typing responsive while reducing filter churn.
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedQuery = useDebouncedValue(searchQuery, 300)
  // Top-level tab controls which section body (Trending / Comics / Tags) is visible.
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
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({})
  const loadingDisplayNameIdsRef = useRef<Set<string>>(new Set())
  const haptic = useHapticFeedback()
  const setCategoryWithHaptic = (value: string) => {
    setCategory(value)
    haptic.light()
  }
  const setTabWithHaptic = (tab: string) => {
    setActiveTab(tab)
    haptic.light()
  }
  const resetFilters = () => {
    setCategory("all")
    setSortOrder("trending")
    haptic.light()
  }
  const chipClass = (active: boolean) =>
    // Shared styling helper for category and sort chips.
    `inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap active-scale tap-highlight-none transition-all duration-300 ease-out flex-shrink-0 border leading-none ${
      active
        ? "bg-white text-black border-white shadow-sm"
        : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white hover:scale-102"
    } focus-visible-ring`
  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-full font-medium active-scale tap-highlight-none transition-all duration-300 ease-out ${
      active ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white hover:scale-102"
    } focus-visible-ring`

  const normalizedQuery = debouncedQuery.trim().toLowerCase()

  const categoryFilteredPosts = useMemo(
    // First-stage filter: category chips narrow the overall search space.
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
    // Sorting is applied after all filters/search are done.
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
    // User list supports searching by name/handle/userId and post text relevance.
    if (!normalizedQuery) {
      return userSummaries
    }

    // Build a quick lookup so we avoid scanning all posts for every user row.
    const queryMatchesByUser = new Map<string, boolean>()
    categoryFilteredPosts.forEach((post) => {
      const title = post.title.toLowerCase()
      const description = post.description.toLowerCase()
      if (!title.includes(normalizedQuery) && !description.includes(normalizedQuery)) return
      queryMatchesByUser.set(post.userId, true)
    })

    return userSummaries.filter((summary) => {
      const displayName = displayNames[summary.userId]?.toLowerCase() ?? ""
      const handle = displayName.replace(/\s+/g, "")
      const userIdLower = summary.userId.toLowerCase()
      const matchesIdentity =
        displayName.includes(normalizedQuery) || handle.includes(normalizedQuery) || userIdLower.includes(normalizedQuery)

      if (matchesIdentity) {
        return true
      }

      return queryMatchesByUser.get(summary.userId) === true
    })
  }, [categoryFilteredPosts, displayNames, normalizedQuery, userSummaries])

  const hashtagSummaries = useMemo(() => {
    // Surface category chips with aggregated performance stats.
    const statsByCategory = new Map<string, { count: number; likes: number; views: number }>()
    categoryFilteredPosts.forEach((post) => {
      if (!post.category) return
      const entry = statsByCategory.get(post.category) ?? { count: 0, likes: 0, views: 0 }
      entry.count += 1
      entry.likes += post.likes?.length ?? 0
      entry.views += post.viewCount ?? 0
      statsByCategory.set(post.category, entry)
    })

    return STANDUP_CATEGORIES.map((categoryItem) => {
      const stats = statsByCategory.get(categoryItem.value)
      return {
        category: categoryItem,
        count: stats?.count ?? 0,
        likes: stats?.likes ?? 0,
        views: stats?.views ?? 0,
      }
    }).filter((entry) => entry.count > 0)
  }, [categoryFilteredPosts])

  useEffect(() => {
    // Lazy-load display names for visible userIds to avoid repeated fetches every render.
    const userIds = Array.from(new Set(categoryFilteredPosts.map((post) => post.userId)))
    const missingIds = userIds.filter((id) => !(id in displayNames) && !loadingDisplayNameIdsRef.current.has(id))
    if (missingIds.length === 0) return

    let isMounted = true
    missingIds.forEach((id) => loadingDisplayNameIdsRef.current.add(id))

    const loadDisplayNames = async () => {
      try {
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
      } finally {
        missingIds.forEach((id) => loadingDisplayNameIdsRef.current.delete(id))
      }
    }

    void loadDisplayNames()

    return () => {
      isMounted = false
    }
  }, [categoryFilteredPosts, displayNames])

  const availableCategories = useMemo(() => {
    // Show only categories that currently have content; falls back to full list when feed is empty.
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
    // If selected category disappears (e.g. after live updates), reset safely to "all".
    if (category === "all") return
    const stillAvailable = availableCategories.some((categoryOption) => categoryOption.value === category)
    if (!stillAvailable) {
      setCategory("all")
    }
  }, [availableCategories, category, setCategory])

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        {/* Header/search/filters region */}
        <div className="p-4 pt-8" role="search" aria-label="Search comedians, sets, and categories">
          <h1 className="text-2xl font-bold mb-4">Discover</h1>

          <div className="relative mb-4">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search comedians, sets, categories..."
              className="w-full bg-gray-800 border border-gray-700 rounded-full pl-10 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
              aria-label="Search comedians, sets, and categories"
            />
          </div>

          <div className="-mx-4 mb-4" role="radiogroup" aria-label="Filter by category">
            <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
              <button
                onClick={() => setCategoryWithHaptic("all")}
                className={chipClass(category === "all")}
                role="radio"
                aria-checked={category === "all"}
              >
                All Comedy
              </button>
              {availableCategories.map((categoryOption) => (
                <button
                  key={categoryOption.value}
                  onClick={() => setCategoryWithHaptic(categoryOption.value)}
                  className={chipClass(category === categoryOption.value)}
                  role="radio"
                  aria-checked={category === categoryOption.value}
                >
                  {categoryOption.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mb-6" role="tablist" aria-label="Search sections">
            {SEARCH_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTabWithHaptic(tab.key)}
                className={tabClass(activeTab === tab.key)}
                role="tab"
                aria-selected={activeTab === tab.key}
                aria-controls="search-content"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-10" role="tabpanel" id="search-content" aria-live="polite">
          {/* Body region switches by loading state and selected tab. */}
          {loading ? (
            // Tab-specific skeletons help preserve layout while data is streaming in.
            activeTab === "trending" ? (
                <div className="grid grid-cols-2 gap-3" role="list">
                {Array.from({ length: 6 }).map((_, index) => (
                  <GridItemSkeleton key={`trending-skeleton-${index}`} />
                ))}
              </div>
            ) : activeTab === "users" ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <UserRowSkeleton key={`user-skeleton-${index}`} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`tag-skeleton-${index}`}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-800 animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-3 w-28 rounded-full bg-gray-800/80 animate-pulse" />
                        <div className="h-3 w-36 rounded-full bg-gray-800/60 animate-pulse" />
                      </div>
                    </div>
                    <div className="h-6 w-12 rounded-full bg-gray-800/70 animate-pulse" />
                  </div>
                ))}
              </div>
            )
          ) : activeTab === "trending" ? (
            <div>
              {/* "Trending" mixes search + sorting over clip cards. */}
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={20} className="text-red-500" />
                <h2 className="text-lg font-semibold">Trending Stand-Up</h2>
              </div>
              <div className="-mx-4 mb-4" role="radiogroup" aria-label="Sort by">
                <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        setSortOrder(option.key)
                        haptic.light()
                      }}
                      className={chipClass(sortOrder === option.key)}
                      role="radio"
                      aria-checked={sortOrder === option.key}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {sortedPosts.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
                  <Search size={48} className="text-gray-600" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">No matching sets</h3>
                    <p className="text-sm text-gray-400">
                      Try adjusting your search or category filters to discover more comedy.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {normalizedQuery.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("")
                          haptic.light()
                        }}
                        className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2 text-sm font-medium text-white active-scale tap-highlight-none transition-all duration-300 ease-out focus-visible-ring"
                        aria-label="Clear search"
                      >
                        Clear Search
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2 text-sm font-medium text-white active-scale tap-highlight-none transition-all duration-300 ease-out focus-visible-ring"
                      aria-label="Reset filters"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3" role="list">
                  {sortedPosts.slice(0, 12).map((post) => (
                    <div key={post.id} role="listitem">
                      <div
                        className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden group cursor-pointer hover-lift active-scale tap-highlight-none transition-all duration-300 ease-out"
                        onClick={() => {
                          haptic.light()
                          onSelectPost(post.id)
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            haptic.light()
                            onSelectPost(post.id)
                          }
                        }}
                        aria-label={`Watch ${post.title}`}
                      >
                        {post.thumbnailURL ? (
                          <Image
                            src={post.thumbnailURL}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                            loading="lazy"
                            priority={false}
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
                          <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110" aria-hidden="true">
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === "users" ? (
            <div>
              {/* "Comics" surfaces creator-level aggregates with follow actions. */}
              <h2 className="text-lg font-semibold mb-4">Comedians</h2>
              {filteredUserSummaries.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
                  <Users size={48} className="text-gray-600" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">No comedians found</h3>
                    <p className="text-sm text-gray-400">
                      No comics match your current filters. Try broadening your search or exploring different categories.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2 text-sm font-medium text-white active-scale tap-highlight-none transition-all duration-300 ease-out focus-visible-ring"
                    aria-label="Reset filters"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUserSummaries.map((summary) => (
                    <MemoizedSearchUserRow
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
                      currentUserId={user?.uid}
                      canFollowUsers={!!user && !user.isAnonymous}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* "Tags" is category-level discovery with quick jump back into filtered results. */}
              <h2 className="text-lg font-semibold mb-4">Comedy Tags</h2>
              {hashtagSummaries.length === 0 ? (
                <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
                  <Hash size={48} className="text-gray-600" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">No tags available</h3>
                    <p className="text-sm text-gray-400">
                      Categories will appear here once comedians start uploading sets.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {hashtagSummaries.map(({ category: categoryItem, count, likes, views }) => (
                    <div key={categoryItem.value} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                          <Hash size={20} className="text-gray-400" />
                        </div>
                        <div>
                          <div className="font-semibold">#{toHandle(categoryItem.label)}</div>
                          <div className="text-sm text-gray-400">
                            {count} {count === 1 ? "set" : "sets"} · {formatLargeNumber(views)} views · {formatLargeNumber(likes)} laughs
                          </div>
                        </div>
                      </div>
                      <button
                        className="text-gray-400 hover:text-white transition-all duration-200 ease-out active-scale tap-highlight-none"
                        onClick={() => setCategoryWithHaptic(categoryItem.value)}
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
  const preferredName = getPreferredName(displayNameHint, fetchedName, "")
  const displayName = preferredName || "Anonymous Comedian"
  const handle = useMemo(() => toHandle(preferredName || userId), [preferredName, userId])
  const avatar = useMemo(() => buildAvatarPlaceholder(displayName || userId), [displayName, userId])
  const canFollow = !!user && !user.isAnonymous && user.uid !== userId
  const followLabel = canFollow ? (isFollowing ? "Following" : "Follow") : "Sign in"
  const followClasses = canFollow
    ? isFollowing
      ? "bg-white/10 text-white"
      : "bg-white text-black hover:bg-gray-200"
    : "bg-white text-black"
  const haptic = useHapticFeedback()

  const topPosts = useMemo(() => {
    return posts
      .filter((post) => post.userId === userId)
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, 3)
  }, [posts, userId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-4 animate-in fade-in duration-300"
      onClick={() => {
        haptic.light()
        onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-gray-900 p-5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
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
            onClick={() => {
              haptic.light()
              onClose()
            }}
            className="rounded-full bg-gray-800 p-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white active-scale tap-highlight-none focus-visible-ring"
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
                haptic.light()
                return
              }
              onToggleFollow()
              haptic.medium()
            }}
            disabled={followDisabled || (!canFollow && !onRequestAuth)}
            className={`mt-4 w-full rounded-full py-2 text-sm font-semibold active-scale tap-highlight-none transition-all duration-300 ease-out ${followClasses} ${
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
              <div className="flex flex-col items-center gap-2">
                <Clapperboard size={32} className="text-gray-600" />
                <p>No clips yet — check back soon or follow to get notified when they upload!</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {topPosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    haptic.light()
                    onSelectPost(post.id)
                  }}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg border border-gray-800 bg-gray-800 hover-lift active-scale tap-highlight-none transition-all duration-300 ease-out"
                >
                  {post.thumbnailURL ? (
                    <Image
                      src={post.thumbnailURL}
                      alt={post.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                      priority={false}
                    />
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
