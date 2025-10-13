"use client"

import { useEffect, useMemo, useState } from "react"
import { Play, Compass } from "lucide-react"
import Image from "next/image"

import { usePostsContext } from "@/components/posts-provider"
import { useFilters } from "@/components/filters-provider"
import { STANDUP_CATEGORIES } from "@/lib/constants"
import { formatLargeNumber, getCategoryLabel } from "@/lib/utils"
import { GridItemSkeleton } from "@/components/skeletons"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"

interface ExplorePageProps {
  onSelectPost: (postId: string) => void
}

export default function ExplorePage({ onSelectPost }: ExplorePageProps) {
  const { posts, loading } = usePostsContext()
  const { category, setCategory } = useFilters()
  const haptic = useHapticFeedback()
  const curatedPosts = useMemo(() => {
    // Share the category filter with Search so both tabs stay in sync.
    const filtered = category === "all" ? posts : posts.filter((post) => post.category === category)
    return [...filtered].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  }, [posts, category])

  const totalViews = useMemo(() => curatedPosts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0), [curatedPosts])

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

  const [visibleCount, setVisibleCount] = useState(12)

  useEffect(() => {
    setVisibleCount(12)
  }, [category])

  useEffect(() => {
    setVisibleCount((count) => {
      if (curatedPosts.length === 0) {
        return 12
      }
      return Math.min(count, Math.max(12, curatedPosts.length))
    })
  }, [curatedPosts.length])

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        <div className="p-4 pt-8">
          <div className="flex items-center gap-2 mb-4">
            <Compass size={24} />
            <h1 className="text-2xl font-bold">Explore</h1>
          </div>
          <p className="text-gray-400 text-sm mb-4">{formatLargeNumber(totalViews)} total views across this selection.</p>

          <div className="-mx-4">
            <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
              <button
                onClick={() => {
                  setCategory("all")
                  haptic.light()
                }}
                className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap active-scale tap-highlight-none transition-all duration-300 ease-out flex-shrink-0 border leading-none ${
                  category === "all"
                    ? "bg-white text-black border-white shadow-sm"
                    : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white hover:scale-102"
                }`}
              >
                For You
              </button>
              {availableCategories.map((categoryOption) => (
                <button
                  key={categoryOption.value}
                  onClick={() => {
                    setCategory(categoryOption.value)
                    haptic.light()
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap active-scale tap-highlight-none transition-all duration-300 ease-out flex-shrink-0 border leading-none ${
                    category === categoryOption.value
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-gray-800/90 text-gray-200 border-gray-700 hover:text-white hover:scale-102"
                  }`}
                >
                  {categoryOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-10">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <GridItemSkeleton key={`explore-skeleton-${index}`} />
              ))}
            </div>
          ) : curatedPosts.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-12 px-6">
              <Compass size={48} className="text-gray-600" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">No sets in this category</h3>
                <p className="text-sm text-gray-400">
                  This comedy style doesn&#39;t have any clips yet. Try exploring other categories or check back soon!
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCategory("all")
                  haptic.light()
                }}
                className="inline-flex items-center justify-center bg-white text-black rounded-full px-6 py-3 font-semibold hover:bg-gray-200 active-scale tap-highlight-none transition-all duration-300 ease-out"
              >
                Browse All Comedy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {curatedPosts.slice(0, visibleCount).map((post, index) => (
                <div
                  key={post.id}
                  className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden group cursor-pointer hover-lift active-scale tap-highlight-none transition-all duration-300 ease-out animate-in fade-in"
                  style={{ animationDelay: `${index * 40}ms` }}
                  onClick={() => {
                    haptic.light()
                    onSelectPost(post.id)
                  }}
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
                    // Without a stored thumbnail we still show a muted looping preview.
                    <video
                      src={post.videoURL}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      muted
                      loop
                      playsInline
                    />
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Play size={20} className="text-white fill-current ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent space-y-1">
                    <div className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded inline-block">
                      {formatLargeNumber(post.viewCount ?? 0)} views
                    </div>
                    <p className="text-xs text-white line-clamp-2">{post.title}</p>
                    <span className="text-[10px] uppercase tracking-wide text-white/70">{getCategoryLabel(post.category)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {curatedPosts.length > visibleCount ? (
            <div className="py-8 text-center">
              <button
                onClick={() => {
                  setVisibleCount((count) => Math.min(count + 12, curatedPosts.length))
                  haptic.light()
                }}
                disabled={loading}
                className="bg-gray-800 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-700 active-scale tap-highlight-none transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60"
              >
                Load More Sets
              </button>
            </div>
          ) : (
            curatedPosts.length > 0 && (
              <div className="py-8 text-center text-sm text-gray-500">You&#39;re all caught up.</div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
