"use client"

import { Home, Search, Plus, Compass, User } from "lucide-react"

interface BottomNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = [
    { id: "home", icon: Home, label: "Home" },
    { id: "search", icon: Search, label: "Search" },
    { id: "upload", icon: Plus, label: "Upload" },
    { id: "explore", icon: Compass, label: "Explore" },
    { id: "profile", icon: User, label: "Profile" },
  ]

  return (
    <nav className="bg-black border-t border-gray-800 px-2 py-1">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isUpload = tab.id === "upload"

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center p-2 transition-all duration-200 ${
                isUpload
                  ? "bg-white text-black rounded-lg px-4 py-2"
                  : isActive
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon size={isUpload ? 20 : 24} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-xs mt-1 ${isUpload ? "hidden" : "block"}`}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
