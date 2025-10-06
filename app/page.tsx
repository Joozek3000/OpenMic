"use client"

import { useEffect, useRef, useState } from "react"
import BottomNavigation from "@/components/bottom-navigation"
import VideoFeed, { type VideoFeedHandle } from "@/components/video-feed"
import SearchPage from "@/components/search-page"
import UploadPage from "@/components/upload-page"
import ExplorePage from "@/components/explore-page"
import ProfilePage from "@/components/profile-page"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/components/auth-provider"
import { DevToolsOverlay } from "@/components/dev-tools"

export default function Home() {
  const [activeTab, setActiveTab] = useState("home")
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const feedRef = useRef<VideoFeedHandle | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const { signIn, signUp } = useAuth()

  const handleSelectPost = (postId: string) => {
    setPendingPostId(postId)
    setActiveTab("home")
  }

  useEffect(() => {
    if (activeTab === "home" && pendingPostId) {
      requestAnimationFrame(() => {
        feedRef.current?.scrollToPost(pendingPostId)
      })
      setPendingPostId(null)
    }
  }, [activeTab, pendingPostId])

  const renderContent = () => {
    switch (activeTab) {
      case "home":
        return <VideoFeed ref={feedRef} />
      case "search":
        return <SearchPage onSelectPost={handleSelectPost} onRequestAuth={() => setAuthModalOpen(true)} />
      case "upload":
        return <UploadPage />
      case "explore":
        return <ExplorePage onSelectPost={handleSelectPost} />
      case "profile":
        return <ProfilePage onSelectPost={handleSelectPost} onRequestAuth={() => setAuthModalOpen(true)} />
      default:
        return <VideoFeed ref={feedRef} />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      <main className="flex-1 overflow-hidden">{renderContent()}</main>
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <AuthModal
        open={authModalOpen}
        onClose={() => {
          if (!authLoading) {
            setAuthModalOpen(false)
            setAuthError(null)
          }
        }}
        onSignIn={async (email, password) => {
          setAuthLoading(true)
          setAuthError(null)
          try {
            await signIn(email, password)
            setAuthModalOpen(false)
          } catch (error) {
            console.error("Sign-in not yet implemented", error)
            setAuthError("Sign-in failed. Please try again.")
          } finally {
            setAuthLoading(false)
          }
        }}
        onSignUp={async (email, password) => {
          setAuthLoading(true)
          setAuthError(null)
          try {
            await signUp(email, password)
            setAuthModalOpen(false)
          } catch (error) {
            console.error("Sign-up not yet implemented", error)
            setAuthError("Account creation failed. Please try again.")
          } finally {
            setAuthLoading(false)
          }
        }}
        loading={authLoading}
        error={authError}
      />
      <DevToolsOverlay onRequestAuth={() => setAuthModalOpen(true)} />
    </div>
  )
}
