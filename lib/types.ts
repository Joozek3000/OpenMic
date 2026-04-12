import type { Timestamp } from "firebase/firestore"

export type ToastVariant = "success" | "error" | "info"

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

export interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, variant?: ToastVariant, options?: { duration?: number }) => string
  dismissToast: (id: string) => void
}

export type ConnectionStatus = "online" | "offline" | "connecting" | "retrying" | "error"

export interface ConnectionInfo {
  status: ConnectionStatus
  message?: string
  retryCount?: number
  maxRetries?: number
}

export class AppError extends Error {
  code: string
  retryable: boolean
  originalError?: unknown

  constructor(message: string, options: { code?: string; retryable?: boolean; originalError?: unknown } = {}) {
    super(message)
    this.name = "AppError"
    this.code = options.code ?? "app/error"
    this.retryable = options.retryable ?? false
    this.originalError = options.originalError

    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NetworkError extends AppError {
  constructor(message: string, options: { code?: string; originalError?: unknown } = {}) {
    super(message, { code: options.code ?? "app/network", retryable: true, originalError: options.originalError })
    this.name = "NetworkError"
  }
}

export class StorageError extends AppError {
  constructor(message: string, options: { code?: string; retryable?: boolean; originalError?: unknown } = {}) {
    super(message, {
      code: options.code ?? "app/storage",
      retryable: options.retryable ?? false,
      originalError: options.originalError,
    })
    this.name = "StorageError"
  }
}

export class FirestoreError extends AppError {
  constructor(message: string, options: { code?: string; retryable?: boolean; originalError?: unknown } = {}) {
    super(message, {
      code: options.code ?? "app/firestore",
      retryable: options.retryable ?? false,
      originalError: options.originalError,
    })
    this.name = "FirestoreError"
  }
}

export interface Post {
  id: string
  title: string
  description: string
  videoURL: string
  category: string
  userId: string
  timestamp: Timestamp | null
  likes?: string[]
  fileId?: string
  thumbnailURL?: string
  thumbnailFileId?: string
  viewCount?: number
  commentCount?: number
}

export interface CommentDoc {
  id: string
  text: string
  userId: string
  timestamp: Timestamp
}

export interface UserProfile {
  uid: string
  displayName?: string
  displayNameLower?: string | null
  updatedAt?: Timestamp
  following?: string[]
  geoLocation?: GeoLocation
  cityLocation?: GeoLocation
  accountType?: "user" | "editorial"
  isSeedAccount?: boolean
  officialLabel?: string
  isVerified?: boolean
  handle?: string
  handleLower?: string
  createdAt?: Timestamp
  createdBy?: string
}

export interface CreatePostInput {
  title: string
  description: string
  videoURL: string
  category: string
  userId: string
  fileId: string
  thumbnailURL?: string
  thumbnailFileId?: string
}

export interface CreateCommentInput {
  postId: string
  text: string
  userId: string
}

export interface DisplayPost extends Post {
  likeCount: number
  likedByCurrentUser: boolean
  authorDisplayName: string
}

export interface PostsContextValue {
  posts: Post[]
  loading: boolean
  error?: string
  connectionStatus: ConnectionStatus
  connectionInfo?: ConnectionInfo
  loadMorePosts: () => Promise<void>
  hasMore: boolean
  loadingMore: boolean
}

export interface GeoLocation {
  lat: number
  lng: number
}

export type MapEntityType = "event" | "venue" | "comedian" | "video"

interface MapEntityBase {
  id: string
  entityType: MapEntityType
  geoLocation: GeoLocation
}

export interface MapEvent extends MapEntityBase {
  entityType: "event"
  title: string
  description: string
  venueId: string
  startTime?: Timestamp | null
  endTime?: Timestamp | null
  lineup: string[]
  ticketUrl?: string
  isFree?: boolean
  coverImage?: string
  comedyType?: string
}

export interface MapVenue extends MapEntityBase {
  entityType: "venue"
  name: string
  description: string
  address?: string
  image?: string
  tags: string[]
  eventIds: string[]
}

export interface MapComedian extends MapEntityBase {
  entityType: "comedian"
  displayName: string
  profileImage?: string
}

export interface MapVideo extends MapEntityBase {
  entityType: "video"
  videoId: string
  thumbnail?: string
  comedianId: string
  venueId?: string
  timestamp?: Timestamp | null
  title?: string
}

export type MapEntity = MapEvent | MapVenue | MapComedian | MapVideo

export interface MapFilters {
  showEvents: boolean
  showVenues: boolean
  showComedians: boolean
  showVideos: boolean
  dateFrom?: Date
  dateTo?: Date
  comedyType?: string
  radiusKm: number
}
