"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Home, Search, Plus, Compass, User } from "lucide-react"

import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation"

interface BottomNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs = useMemo(
    () => [
      { id: "home", icon: Home, label: "Home" },
      { id: "search", icon: Search, label: "Search" },
      { id: "upload", icon: Plus, label: "Upload" },
      { id: "explore", icon: Compass, label: "Explore" },
      { id: "profile", icon: User, label: "Profile" },
    ],
    [],
  )

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab),
  )
  const [focusedIndex, setFocusedIndex] = useState(activeIndex)

  useEffect(() => {
    setFocusedIndex(activeIndex)
  }, [activeIndex])

  const shouldFocusRef = useRef(false)

  useKeyboardNavigation({
    axis: "horizontal",
    onNext: () => {
      setFocusedIndex((index) => {
        const next = (index + 1) % tabs.length
        shouldFocusRef.current = true
        return next
      })
    },
    onPrevious: () => {
      setFocusedIndex((index) => {
        const next = (index - 1 + tabs.length) % tabs.length
        shouldFocusRef.current = true
        return next
      })
    },
    onFirst: () => {
      shouldFocusRef.current = true
      setFocusedIndex(0)
    },
    onLast: () => {
      shouldFocusRef.current = true
      setFocusedIndex(tabs.length - 1)
    },
    onSelect: () => {
      const tab = tabs[focusedIndex]
      if (tab) {
        shouldFocusRef.current = true
        onTabChange(tab.id)
      }
    },
  })

  useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    const tab = tabs[focusedIndex]
    if (!tab) return
    const button = document.querySelector<HTMLButtonElement>(`button[data-tab="${tab.id}"]`)
    button?.focus()
  }, [focusedIndex, tabs])

  return (
    <nav className="bg-black border-t border-gray-800 px-2 py-1" role="navigation" aria-label="Main navigation">
      <div className="flex justify-around items-center max-w-md mx-auto" role="tablist" aria-label="App tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isUpload = tab.id === "upload"
          const index = tabs.indexOf(tab)
          const isFocused = focusedIndex === index

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
              } focus-visible-ring`}
              data-tab={tab.id}
              role="tab"
              aria-label={`${tab.label} tab${isActive ? ", selected" : ""}`}
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              tabIndex={isFocused ? 0 : -1}
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
