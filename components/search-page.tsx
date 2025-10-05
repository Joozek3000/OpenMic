"use client"

import { useMemo, useState } from "react"
import { Search, TrendingUp, Hash, Play } from "lucide-react"
import Image from "next/image"

import { usePostsContext } from "@/components/posts-provider"
import { useFilters } from "@/components/filters-provider"
import { STANDUP_CATEGORIES } from "@/lib/constants"
import { buildAvatarPlaceholder, formatLargeNumber, getCategoryLabel } from "@/lib/utils"
import { useDisplayName } from "@/hooks/use-display-name"

function SearchUserRow({ userId, sets, likes, views }: { userId: string; sets: number; likes: number; views: number }) {
  const name = useDisplayName(userId) ?? "Anonymous"
  const avatar = useMemo(() => buildAvatarPlaceholder(name || userId), [name, userId])

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image src={avatar} alt={name} width={40} height={40} className="rounded-full" />
        <div>
          <div className="font-semibold">@{name.replace(/\s+/g, "").toLowerCase()}</div>
          <div className="text-sm text-gray-400">
            {sets} {sets === 1 ? "set" : "sets"} · {formatLargeNumber(views)} views · {formatLargeNumber(likes)} laughs
          </div>
        </div>
      </div>
      <button className="bg-white text-black px-4 py-1 rounded-full text-sm font-semibold hover:bg-gray-200 transition-colors">
        Follow
      </button>
    </div>
  )
}

export default function SearchPage() {
  const { posts, loading } = usePostsContext()
  const { category, setCategory } = useFilters()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("trending")

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const matchingPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesQuery =
        !normalizedQuery ||
        post.title.toLowerCase().includes(normalizedQuery) ||
        post.description.toLowerCase().includes(normalizedQuery)
      const matchesCategory = category === "all" || post.category === category
      return matchesQuery && matchesCategory
    })
  }, [posts, normalizedQuery, category])

  const trendingPosts = useMemo(() => {
    return [...matchingPosts].sort((a, b) => {
      const scoreA = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      if (scoreA !== 0) return scoreA
      return (b.likes?.length ?? 0) - (a.likes?.length ?? 0)
    })
  }, [matchingPosts])

  const userSummaries = useMemo(() => {
    const aggregation = new Map<string, { sets: number; likes: number; views: number }>()
    matchingPosts.forEach((post) => {
      const entry = aggregation.get(post.userId) ?? { sets: 0, likes: 0, views: 0 }
      entry.sets += 1
      entry.likes += post.likes?.length ?? 0
      entry.views += post.viewCount ?? 0
      aggregation.set(post.userId, entry)
    })
    return Array.from(aggregation.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.views - a.views)
  }, [matchingPosts])

  const hashtagSummaries = useMemo(() => {
    return STANDUP_CATEGORIES.map((categoryItem) => {
      const filtered = matchingPosts.filter((post) => post.category === categoryItem.value)
      const totalLikes = filtered.reduce((sum, post) => sum + (post.likes?.length ?? 0), 0)
      const totalViews = filtered.reduce((sum, post) => sum + (post.viewCount ?? 0), 0)
      return {
        category: categoryItem,
        count: filtered.length,
        likes: totalLikes,
        views: totalViews,
      }
    }).filter((entry) => entry.count > 0)
  }, [matchingPosts])

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

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
            <button
              onClick={() => setCategory("all")}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                category === "all" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              All Comedy
            </button>
            {STANDUP_CATEGORIES.map((categoryOption) => (
              <button
                key={categoryOption.value}
                onClick={() => setCategory(categoryOption.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  category === categoryOption.value
                    ? "bg-white text-black"
                    : "bg-gray-800 text-gray-300 hover:text-white"
                }`}
              >
                {categoryOption.label}
              </button>
            ))}
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
              {trendingPosts.length === 0 ? (
                <p className="text-gray-400 text-sm">No sets match your search yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {trendingPosts.slice(0, 12).map((post) => (
                    <div key={post.id} className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden group">
                      {post.thumbnailURL ? (
                        <Image
                          src={post.thumbnailURL}
                          alt={post.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <video
                          src={post.videoURL}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
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
              {userSummaries.length === 0 ? (
                <p className="text-gray-400 text-sm">No comedians match your filters yet.</p>
              ) : (
                <div className="space-y-4">
                  {userSummaries.map((summary) => (
                    <SearchUserRow
                      key={summary.userId}
                      userId={summary.userId}
                      sets={summary.sets}
                      likes={summary.likes}
                      views={summary.views}
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
    </div>
  )
}
