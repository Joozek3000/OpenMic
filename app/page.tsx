"use client"

import { useEffect, useRef, useState } from "react"
import BottomNavigation from "@/components/bottom-navigation"
import VideoFeed, { type VideoFeedHandle } from "@/components/video-feed"
import SearchPage from "@/components/search-page"
import UploadPage from "@/components/upload-page"
import ExplorePage from "@/components/explore-page"
import MapPage from "@/components/map-page"
import ProfilePage from "@/components/profile-page"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/components/auth-provider"
import { DevToolsOverlay } from "@/components/dev-tools"

type AuthAction = () => Promise<void>

export default function Home() {
  // Main tab state drives which full-screen page is rendered.
  const [activeTab, setActiveTab] = useState("home")
  // Used when another tab (search/map/profile) picks a post and wants home feed to jump to it.
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const feedRef = useRef<VideoFeedHandle | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const { signIn, signUp, resetPassword } = useAuth()
  const openAuthModal = () => setAuthModalOpen(true)

  const handleSelectPost = (postId: string) => {
    // Switch back to home and defer the actual scroll until the feed mounts.
    setPendingPostId(postId)
    setActiveTab("home")
  }

  const runAuthAction = async (action: AuthAction, fallbackMessage: string, logLabel: string) => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      await action()
      setAuthModalOpen(false)
    } catch (error) {
      console.error(logLabel, error)
      setAuthError(fallbackMessage)
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    // Scroll after tab switch so the target post element definitely exists in DOM.
    if (activeTab === "home" && pendingPostId) {
      requestAnimationFrame(() => {
        feedRef.current?.scrollToPost(pendingPostId)
      })
      setPendingPostId(null)
    }
  }, [activeTab, pendingPostId])

  const renderContent = () => {
    // Single place to control tab -> page mapping.
    switch (activeTab) {
      case "home":
        return <VideoFeed ref={feedRef} onNavigateToUpload={() => setActiveTab("upload")} />
      case "search":
        return <SearchPage onSelectPost={handleSelectPost} onRequestAuth={openAuthModal} />
      case "upload":
        return <UploadPage />
      case "map":
        return <MapPage onSelectPost={handleSelectPost} />
      case "explore":
        return <ExplorePage onSelectPost={handleSelectPost} />
      case "profile":
        return (
          <ProfilePage
            onSelectPost={handleSelectPost}
            onRequestAuth={openAuthModal}
            onNavigateToTab={setActiveTab}
          />
        )
      default:
        return <VideoFeed ref={feedRef} onNavigateToUpload={() => setActiveTab("upload")} />
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
        onSignIn={(email, password) =>
          runAuthAction(() => signIn(email, password), "Sign-in failed. Please try again.", "Sign-in failed")
        }
        onSignUp={(email, password) =>
          runAuthAction(() => signUp(email, password), "Account creation failed. Please try again.", "Sign-up failed")
        }
        onResetPassword={async (email) => {
          setAuthLoading(true)
          setAuthError(null)
          try {
            const result = await resetPassword(email)
            if (!result.success && result.message) {
              setAuthError(result.message)
            }
            return result
          } catch (error) {
            console.error("Password reset request failed", error)
            const message = "Unable to send reset link. Please try again."
            setAuthError(message)
            return { success: false, message }
          } finally {
            setAuthLoading(false)
          }
        }}
        loading={authLoading}
        error={authError}
      />
      <DevToolsOverlay onRequestAuth={openAuthModal} />
    </div>
  )
}
