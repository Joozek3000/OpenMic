"use client"

import { useMemo, useState } from "react"
import { Play } from "lucide-react"

import { usePostsContext } from "@/components/posts-provider"
import { STANDUP_CATEGORIES } from "@/lib/constants"
import { formatLargeNumber, getCategoryLabel } from "@/lib/utils"

export default function ExplorePage() {
  const { posts, loading } = usePostsContext()
  const [selectedCategory, setSelectedCategory] = useState("all")

  const curatedPosts = useMemo(() => {
    const filtered = selectedCategory === "all" ? posts : posts.filter((post) => post.category === selectedCategory)
    return [...filtered].sort((a, b) => (b.likes?.length ?? 0) - (a.likes?.length ?? 0))
  }, [posts, selectedCategory])

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto">
        <div className="p-4 pt-8">
          <h1 className="text-2xl font-bold mb-4">Explore</h1>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                selectedCategory === "all" ? "bg-white text-black" : "bg-gray-800 text-gray-300 hover:text-white"
              }`}
            >
              For You
            </button>
            {STANDUP_CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category.value
                    ? "bg-white text-black"
                    : "bg-gray-800 text-gray-300 hover:text-white"
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pb-10">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Loading clips…</div>
          ) : curatedPosts.length === 0 ? (
            <div className="text-center text-gray-400 py-12">No sets in this category yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {curatedPosts.slice(0, 20).map((post) => (
                <div
                  key={post.id}
                  className="relative aspect-[3/4] bg-gray-800 rounded-lg overflow-hidden group cursor-pointer"
                >
                  <video
                    src={post.videoURL}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    muted
                    loop
                    playsInline
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Play size={20} className="text-white fill-current ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent space-y-1">
                    <div className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded inline-block">
                      {formatLargeNumber(post.likes?.length ?? 0)} laughs
                    </div>
                    <p className="text-xs text-white line-clamp-2">{post.title}</p>
                    <span className="text-[10px] uppercase tracking-wide text-white/70">{getCategoryLabel(post.category)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="py-8 text-center">
            <button className="bg-gray-800 text-white px-6 py-3 rounded-full font-medium hover:bg-gray-700 transition-colors">
              Load More Sets
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
