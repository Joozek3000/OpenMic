"use client"

import FeedView from "@/components/feed/FeedView"

export default function HomePage() {
  return (
    // Pull the feed full-bleed by negating the layout padding from RootLayout
    <div className="-mx-4 -mt-12 sm:-mx-10 lg:-mx-10">
      <FeedView />
    </div>
  )
}
