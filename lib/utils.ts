import { formatDistanceToNow } from "date-fns"
import type { Timestamp } from "firebase/firestore"

import { STANDUP_CATEGORIES } from "@/lib/constants"

export function formatLargeNumber(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }
  return value.toString()
}

export function getCategoryLabel(value: string) {
  return STANDUP_CATEGORIES.find((category) => category.value === value)?.label ?? value
}

export function formatRelativeTimestamp(timestamp?: Timestamp | null) {
  if (!timestamp) return "moments ago"
  try {
    return formatDistanceToNow(timestamp.toDate(), { addSuffix: true })
  } catch (error) {
    console.error("Failed to format timestamp", error)
    return "moments ago"
  }
}

export function getInitials(seed: string) {
  if (!seed) return "?"
  const parts = seed.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export function buildAvatarPlaceholder(identifier: string) {
  const initials = getInitials(identifier)
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='16' fill='#111827'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter, sans-serif' font-size='28' fill='#F9FAFB'>${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
