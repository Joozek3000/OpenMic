// Firestore helpers for reading and mutating the `posts` collection.
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  serverTimestamp,
  updateDoc,
  type FirestoreError as FirebaseFirestoreError,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"

import { db, storage } from "@/lib/firebase"
import type { CommentDoc, CreateCommentInput, CreatePostInput, Post } from "@/lib/types"
import { FirestoreError, NetworkError, StorageError } from "@/lib/types"
import { getErrorMessage, isNetworkError } from "@/lib/utils"

const postsCollection = collection(db, "posts")

function mapDocToPost(docSnap: QueryDocumentSnapshot<DocumentData>): Post {
  // Convert untyped Firestore payload into the app's stable Post shape.
  const data = docSnap.data()
  return {
    id: docSnap.id,
    title: data.title,
    description: data.description,
    videoURL: data.videoURL,
    category: data.category,
    userId: data.userId,
    timestamp: data.timestamp ?? null,
    likes: data.likes ?? [],
    fileId: data.fileId,
    thumbnailURL: data.thumbnailURL ?? undefined,
    thumbnailFileId: data.thumbnailFileId ?? undefined,
    viewCount: data.viewCount ?? 0,
    commentCount: data.commentCount ?? 0,
  }
}

export function listenToPosts(
  onUpdate: (posts: Post[], lastDoc?: QueryDocumentSnapshot<DocumentData>) => void,
  onError?: (error: FirebaseFirestoreError) => void,
  onTimeout?: () => void,
  options?: { limit?: number; startAfter?: QueryDocumentSnapshot<DocumentData> },
) {
  // Subscribe to Firestore updates ordered by newest first.
  const pageSize = options?.limit ?? 30
  const orderConstraint = orderBy("timestamp", "desc")
  const limitConstraint = limit(pageSize)
  const cursorConstraint = options?.startAfter ? startAfter(options.startAfter) : undefined

  const postsQuery = cursorConstraint
    ? query(postsCollection, orderConstraint, cursorConstraint, limitConstraint)
    : query(postsCollection, orderConstraint, limitConstraint)
  let initialSnapshotPending = true
  const timeoutMs = 10_000
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const clearListenerTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  timeoutId = setTimeout(() => {
    if (!initialSnapshotPending) return
    onTimeout?.()
  }, timeoutMs)

  const unsubscribe = onSnapshot(
    postsQuery,
    (snapshot) => {
      clearListenerTimeout()
      initialSnapshotPending = false
      try {
        const posts = snapshot.docs.map((docSnap) => mapDocToPost(docSnap))
        const lastDocument = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined
        onUpdate(posts, lastDocument)
      } catch (error) {
        console.error("Failed to process posts snapshot", error)
        if (onError) {
          const derived = new FirestoreError("Unable to process posts feed.", {
            code: "app/posts-snapshot",
            retryable: false,
            originalError: error,
          })
          onError({
            code: derived.code,
            message: derived.message,
            name: "FirestoreError",
          } as FirebaseFirestoreError)
        }
      }
    },
    (firestoreError) => {
      console.error("Failed to listen to posts", firestoreError)
      clearListenerTimeout()
      if (!onError) return

      const code = String(firestoreError.code ?? "").toLowerCase()
      let message: string

      if (code.includes("permission")) {
        message = "Can't load posts. Check permissions."
      } else if (isNetworkError(firestoreError)) {
        message = "Connection lost. Reconnecting..."
      } else {
        message = getErrorMessage(firestoreError)
      }

      onError({
        ...firestoreError,
        message,
      })
    },
  )

  return () => {
    clearListenerTimeout()
    unsubscribe()
  }
}

export async function fetchMorePosts(lastDoc: QueryDocumentSnapshot<DocumentData>, pageSize: number) {
  // Cursor pagination keeps reads cheap as the feed grows.
  const postsQuery = query(postsCollection, orderBy("timestamp", "desc"), startAfter(lastDoc), limit(pageSize))

  const snapshot = await getDocs(postsQuery)
  const posts = snapshot.docs.map((docSnap) => mapDocToPost(docSnap))
  const nextLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined

  return {
    posts,
    lastDoc: nextLastDoc,
    hasMore: snapshot.docs.length >= pageSize,
  }
}

export async function createPost(input: CreatePostInput) {
  // Firestore will replace the timestamp server-side so the feed stays in sync globally.
  try {
    await addDoc(postsCollection, {
      title: input.title,
      description: input.description,
      videoURL: input.videoURL,
      category: input.category,
      userId: input.userId,
      timestamp: serverTimestamp(),
      likes: [],
      fileId: input.fileId,
      thumbnailURL: input.thumbnailURL ?? null,
      thumbnailFileId: input.thumbnailFileId ?? null,
      viewCount: 0,
      commentCount: 0,
    })
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable ? "Network issue. Try again." : getErrorMessage(error)

    throw new StorageError(message, {
      code: "app/create-post",
      retryable,
      originalError: error,
    })
  }
}

export async function toggleLike(postId: string, userId: string, shouldLike: boolean) {
  // Uses atomic array operations to avoid race conditions across devices.
  const postRef = doc(db, "posts", postId)
  try {
    await updateDoc(postRef, {
      likes: shouldLike ? arrayUnion(userId) : arrayRemove(userId),
    })
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable ? "Connection issue. Try again." : "Can't update likes."

    throw new FirestoreError(message, {
      code: "app/toggle-like",
      retryable,
      originalError: error,
    })
  }
}

export function listenToComments(
  postId: string,
  onUpdate: (comments: CommentDoc[]) => void,
  onError?: (error: FirebaseFirestoreError) => void,
) {
  const commentsRef = collection(db, "posts", postId, "comments")
  const commentsQuery = query(commentsRef, orderBy("timestamp", "asc"))
  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      try {
        const comments = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            // Support legacy `text` comments while standardizing new writes to `content`.
            text: data.content ?? data.text ?? "",
            userId: data.userId,
            timestamp: data.timestamp,
          } satisfies CommentDoc
        })
        onUpdate(comments)
      } catch (error) {
        console.error("Failed to process comments snapshot", error)
        if (onError) {
          const derived = new FirestoreError("Unable to process comments stream.", {
            code: "app/comments-snapshot",
            retryable: false,
            originalError: error,
          })
          onError({
            code: derived.code,
            message: derived.message,
            name: "FirestoreError",
          } as FirebaseFirestoreError)
        }
      }
    },
    (firestoreError) => {
      console.error("Failed to listen to comments", firestoreError)
      if (!onError) return

      const retryable = isNetworkError(firestoreError)
      const message = retryable ? "Connection lost. Reconnecting..." : getErrorMessage(firestoreError)

      onError({
        ...firestoreError,
        message,
      })
    },
  )
}

export async function addComment({ postId, text, userId }: CreateCommentInput) {
  const commentsRef = collection(db, "posts", postId, "comments")
  try {
    await addDoc(commentsRef, {
      content: text,
      userId,
      timestamp: serverTimestamp(),
    })
    const postRef = doc(db, "posts", postId)
    await updateDoc(postRef, {
      commentCount: increment(1),
    }).catch((countError) => {
      console.warn("Failed to increment comment count", countError)
    })
  } catch (error) {
    const code = String((error as { code?: unknown })?.code ?? "").toLowerCase()
    const retryable = isNetworkError(error)
    const message = code.includes("permission")
      ? "You don't have permission to add comments."
      : retryable
        ? "Network issue. Try again."
        : "Can't add comment."

    throw new FirestoreError(message, {
      code: "app/add-comment",
      retryable,
      originalError: error,
    })
  }
}

export async function deleteComment(postId: string, commentId: string) {
  const commentRef = doc(db, "posts", postId, "comments", commentId)
  try {
    await deleteDoc(commentRef)
    const postRef = doc(db, "posts", postId)
    await updateDoc(postRef, {
      commentCount: increment(-1),
    }).catch((countError) => {
      console.warn("Failed to decrement comment count", countError)
    })
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable ? "Network issue. Try again." : "Can't delete comment."

    throw new FirestoreError(message, {
      code: "app/delete-comment",
      retryable,
      originalError: error,
    })
  }
}

export async function deletePost(post: Pick<Post, "id" | "fileId"> & { thumbnailFileId?: string | null }) {
  const postRef = doc(postsCollection, post.id)
  try {
    // Remove nested comments before deleting the post document to avoid orphaned refs.
    const commentsRef = collection(db, "posts", post.id, "comments")
    const commentsSnapshot = await getDocs(commentsRef)
    await Promise.all(commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)))

    await deleteDoc(postRef)
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable ? "Network issue. Try again." : "Can't delete set."

    throw new FirestoreError(message, {
      code: "app/delete-post",
      retryable,
      originalError: error,
    })
  }

  const storageFailures: string[] = []
  const storageErrors: unknown[] = []

  if (post.fileId) {
    try {
      const storageRef = ref(storage, post.fileId)
      await deleteObject(storageRef)
    } catch (error) {
      console.error("Failed to delete post video asset", error)
      storageFailures.push("video")
      storageErrors.push(error)
    }
  }

  if (post.thumbnailFileId) {
    try {
      const thumbRef = ref(storage, post.thumbnailFileId)
      await deleteObject(thumbRef)
    } catch (error) {
      console.error("Failed to delete post thumbnail asset", error)
      storageFailures.push("thumbnail")
      storageErrors.push(error)
    }
  }

  if (storageFailures.length > 0) {
    const message =
      storageFailures.length === 1
        ? `Set removed, but the ${storageFailures[0]} file could not be deleted.`
        : "Set removed, but some associated files could not be deleted."

    const retryable = storageErrors.some((error) => isNetworkError(error))
    const lastError = storageErrors[storageErrors.length - 1]

    throw new StorageError(message, {
      code: "app/delete-post-assets",
      retryable,
      originalError: lastError,
    })
  }
}

export async function uploadVideoFile(file: File) {
  // Store raw clips under `videos/` with a random suffix to avoid collisions.
  try {
    const extension = file.name.split(".").pop() ?? "mp4"
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    const fileId = `videos/${uniqueId}.${extension}`
    const storageRef = ref(storage, fileId)
    await uploadBytes(storageRef, file)
    const videoURL = await getDownloadURL(storageRef)
    return { videoURL, fileId }
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable
      ? "Upload failed. Check connection."
      : `Can't upload video${file.name ? ` "${file.name}"` : ""}.`

    if (retryable) {
      throw new NetworkError(message, {
        originalError: error,
      })
    }

    throw new StorageError(message, {
      code: "app/upload-video",
      retryable,
      originalError: error,
    })
  }
}

export async function uploadThumbnailFile(blob: Blob) {
  // Mirrors the video uploader but stores static posters under a different prefix.
  try {
    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    const fileId = `thumbnails/${uniqueId}.jpg`
    const storageRef = ref(storage, fileId)
    await uploadBytes(storageRef, blob, {
      contentType: blob.type || "image/jpeg",
    })
    const thumbnailURL = await getDownloadURL(storageRef)
    return { thumbnailURL, fileId }
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable ? "Upload failed. Try again." : "Can't upload cover."

    if (retryable) {
      throw new NetworkError(message, {
        originalError: error,
      })
    }

    throw new StorageError(message, {
      code: "app/upload-thumbnail",
      retryable,
      originalError: error,
    })
  }
}

export async function incrementViewCount(postId: string) {
  // Use Firestore's atomic increment to avoid race conditions between clients.
  const postRef = doc(db, "posts", postId)
  try {
    await updateDoc(postRef, {
      viewCount: increment(1),
    })
  } catch (error) {
    // Increment failures are non-blocking; log for debugging but don't disrupt playback.
    console.warn("Failed to increment view count", error)
  }
}

export async function fetchCommentCount(postId: string) {
  try {
    const commentsRef = collection(db, "posts", postId, "comments")
    const snapshot = await getCountFromServer(commentsRef)
    const count = snapshot.data().count
    const postRef = doc(db, "posts", postId)
    await updateDoc(postRef, {
      commentCount: count,
    }).catch((error) => {
      console.warn("Failed to cache comment count", error)
    })
    return count
  } catch (error) {
    console.warn("Failed to fetch comment count", error)
    return 0
  }
}
