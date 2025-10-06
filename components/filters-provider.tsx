"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

export type SortOrder = "trending" | "newest" | "likes"

interface FiltersContextValue {
  category: string
  setCategory: (value: string) => void
  sortOrder: SortOrder
  setSortOrder: (value: SortOrder) => void
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined)

export function FiltersProvider({ children }: { children: ReactNode }) {
  // Default to "all" so Search and Explore align until the user picks a category.
  const [category, setCategory] = useState<string>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("trending")

  const value = useMemo<FiltersContextValue>(
    () => ({ category, setCategory, sortOrder, setSortOrder }),
    [category, sortOrder],
  )

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters() {
  const context = useContext(FiltersContext)
  if (!context) {
    throw new Error("useFilters must be used within a FiltersProvider")
  }
  return context
}
