"use client"

import { useState } from "react"
import BottomNavigation from "@/components/bottom-navigation"
import VideoFeed from "@/components/video-feed"
import SearchPage from "@/components/search-page"
import UploadPage from "@/components/upload-page"
import ExplorePage from "@/components/explore-page"
import ProfilePage from "@/components/profile-page"

export default function Home() {
  const [activeTab, setActiveTab] = useState("home")

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <VideoFeed />
      case "search":
        return <SearchPage />
      case "upload":
        return <UploadPage />
      case "explore":
        return <ExplorePage />
      case "profile":
        return <ProfilePage />
      default:
        return <VideoFeed />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      <main className="flex-1 overflow-hidden">{renderContent()}</main>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
