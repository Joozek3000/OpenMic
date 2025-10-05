"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

interface FiltersContextValue {
  category: string
  setCategory: (value: string) => void
}

const FiltersContext = createContext<FiltersContextValue | undefined>(undefined)

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<string>("all")

  const value = useMemo<FiltersContextValue>(() => ({ category, setCategory }), [category])

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export function useFilters() {
  const context = useContext(FiltersContext)
  if (!context) {
    throw new Error("useFilters must be used within a FiltersProvider")
  }
  return context
}
