"use client"

export function CommentItemSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="h-8 w-8 rounded-full bg-gray-800 animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded-full bg-gray-800/80 animate-pulse" />
        <div className="h-3 w-full rounded-full bg-gray-800/70 animate-pulse" />
        <div className="h-3 w-3/4 rounded-full bg-gray-800/60 animate-pulse" />
      </div>
    </div>
  )
}

