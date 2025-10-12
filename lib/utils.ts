import { formatDistanceToNow } from "date-fns"
import type { Timestamp } from "firebase/firestore"

import { STANDUP_CATEGORIES } from "@/lib/constants"
import { AppError, NetworkError } from "@/lib/types"

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

export function getErrorMessage(error: unknown) {
  if (!error) return "Something went wrong. Please try again."
  if (error instanceof AppError) return error.message
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message || "Unexpected error encountered."
  if (typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message.trim().length > 0) {
      return message
    }
  }
  return "Something went wrong. Please try again."
}

export function isNetworkError(error: unknown) {
  if (!error) return false
  if (error instanceof NetworkError) return true
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "" ) : ""
  const message = getErrorMessage(error).toLowerCase()
  return [code.toLowerCase(), message].some((value) =>
    ["network", "offline", "unavailable", "timeout", "failed-precondition"].some((needle) => value.includes(needle)),
  )
}

export function isRetryableError(error: unknown) {
  if (!error) return false
  if (error instanceof AppError) return error.retryable
  if (isNetworkError(error)) return true

  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "" ) : ""
  const retryableCodes = ["deadline-exceeded", "resource-exhausted", "unavailable", "aborted"]
  return retryableCodes.some((retryableCode) => code.includes(retryableCode))
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoff?: boolean
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}) {
  const { maxAttempts = 3, delayMs = 500, backoff = true } = options

  let attempt = 0
  let lastError: unknown

  while (attempt < maxAttempts) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      attempt += 1

      const shouldRetry = attempt < maxAttempts && isRetryableError(error)
      if (!shouldRetry) break

      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs
      await sleep(delay)
    }
  }

  throw lastError ?? new AppError("Retry attempts exhausted")
}
