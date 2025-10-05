import type { Timestamp } from "firebase/firestore"

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
