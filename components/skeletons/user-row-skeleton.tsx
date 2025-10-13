"use client"

export function UserRowSkeleton() {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-800 shimmer-bg animate-shimmer" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-gray-800/80 shimmer-bg animate-shimmer" />
          <div className="h-3 w-40 rounded-full bg-gray-800/60 shimmer-bg animate-shimmer" />
        </div>
      </div>
      <div className="h-8 w-20 rounded-full bg-gray-800 shimmer-bg animate-shimmer" />
    </div>
  )
}
