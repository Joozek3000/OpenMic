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
  updatedAt?: Timestamp
  following?: string[]
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
