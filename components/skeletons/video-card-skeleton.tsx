"use client"

export function VideoCardSkeleton() {
  return (
    <div className="relative h-screen w-full snap-start bg-black">
      <div className="absolute inset-0">
        <div className="h-full w-full bg-gray-900/80 animate-pulse" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <div className="absolute inset-0 flex">
        <div className="flex-1 flex flex-col justify-end p-4 pb-20">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gray-800 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-full bg-gray-800/80 animate-pulse" />
              <div className="h-2.5 w-20 rounded-full bg-gray-800/60 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 w-48 rounded-full bg-gray-800/80 animate-pulse" />
            <div className="h-3 w-64 rounded-full bg-gray-800/60 animate-pulse" />
            <div className="h-3 w-44 rounded-full bg-gray-800/60 animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-end gap-6 p-4 pb-20">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-1"
            >
              <div className="h-14 w-14 rounded-full bg-gray-900/70 animate-pulse" />
              <div className="h-3 w-10 rounded-full bg-gray-800/70 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
