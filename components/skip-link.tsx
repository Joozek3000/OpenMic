"use client"

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="absolute -top-full left-0 z-[200] rounded-lg bg-white px-4 py-2 text-black transition-all focus-visible:top-4 focus-visible:left-4 focus-visible:ring-4 focus-visible:ring-black/50"
    >
      Skip to main content
    </a>
  )
}
