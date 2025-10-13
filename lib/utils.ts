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

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
}

export function sanitizeText(input: string) {
  if (!input) return ""
  const escaped = input.replace(/[&<>"']/g, (char) => htmlEscapeMap[char])
  return escaped
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
}

export function sanitizeDisplayName(input: string) {
  return input
    .replace(/[^\p{L}\p{N}_\- ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function validateDisplayName(name: string) {
  const trimmed = name.trim()
  if (trimmed.length < 3 || trimmed.length > 40) {
    return { valid: false, error: "Stage name must be between 3 and 40 characters." }
  }

  if (!/^[\p{L}\p{N}_\- ]+$/u.test(trimmed)) {
    return {
      valid: false,
      error: "Stage name can only include letters, numbers, spaces, hyphens, and underscores.",
    }
  }

  if (/^[_\- ]|[_\- ]$/.test(trimmed)) {
    return { valid: false, error: "Stage name cannot start or end with special characters." }
  }

  return { valid: true }
}

export function validateTextLength(text: string, min: number, max: number, fieldName: string) {
  const length = text.trim().length
  if (length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} character${min === 1 ? "" : "s"}.` }
  }

  if (length > max) {
    return { valid: false, error: `${fieldName} cannot exceed ${max} characters.` }
  }

  return { valid: true }
}

export function sanitizeAndValidate(
  input: string,
  options: { minLength?: number; maxLength?: number; fieldName: string },
) {
  const sanitized = sanitizeText(input)
  const { minLength = 0, maxLength = Infinity, fieldName } = options
  const validation = validateTextLength(sanitized, minLength, maxLength, fieldName)
  if (!validation.valid) {
    return { sanitized, valid: false, error: validation.error }
  }
  return { sanitized, valid: true }
}

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"])
const MAX_VIDEO_BYTES = 209_715_200 // 200MB
const DEFAULT_MAX_DURATION = 180 // seconds

export function validateVideoFile(file: File) {
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    return { valid: false, error: "Unsupported format. Use MP4, MOV, or WebM." }
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return { valid: false, error: "Video must be under 200MB." }
  }

  return { valid: true }
}

export async function getVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.src = URL.createObjectURL(file)

    const cleanup = () => {
      URL.revokeObjectURL(video.src)
      video.remove()
    }

    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Unable to read video duration."))
        return
      }
      resolve(duration)
    }

    video.onerror = () => {
      cleanup()
      reject(new Error("Unable to load video metadata."))
    }
  })
}

export function validateVideoDuration(duration: number, maxSeconds: number = DEFAULT_MAX_DURATION) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return { valid: false, error: "Invalid video duration." }
  }

  if (duration > maxSeconds) {
    return {
      valid: false,
      error: `Video must be under ${Math.floor(maxSeconds / 60)} minutes. Current length: ${formatDuration(duration)}.`,
    }
  }

  return { valid: true }
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.round(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function resizeCanvas(source: HTMLCanvasElement, maxWidth: number, maxHeight: number) {
  const { width, height } = source
  let targetWidth = width
  let targetHeight = height

  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width
    const heightRatio = maxHeight / height
    const scale = Math.min(widthRatio, heightRatio)
    targetWidth = Math.floor(width * scale)
    targetHeight = Math.floor(height * scale)
  }

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    return source
  }

  context.drawImage(source, 0, 0, targetWidth, targetHeight)
  return canvas
}

export async function optimizeThumbnail(
  video: HTMLVideoElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
) {
  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth || 720
  canvas.height = video.videoHeight || 1280
  const context = canvas.getContext("2d")
  if (!context) {
    return null
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const resized = resizeCanvas(canvas, maxWidth, maxHeight)

  return new Promise<Blob | null>((resolve) => {
    resized.toBlob(
      (blob) => {
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
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
