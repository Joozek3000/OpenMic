"use client"

export function GridItemSkeleton() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-900">
      <div className="absolute inset-0 bg-gray-800 shimmer-bg animate-shimmer" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
        <div className="h-3 w-20 rounded-full bg-gray-700/90 shimmer-bg animate-shimmer" />
        <div className="h-3 w-32 rounded-full bg-gray-700/70 shimmer-bg animate-shimmer" />
      </div>
    </div>
  )
}
