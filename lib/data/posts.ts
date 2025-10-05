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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type FirestoreError,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage"

import { db, storage } from "@/lib/firebase"
import type { CommentDoc, CreateCommentInput, CreatePostInput, Post } from "@/lib/types"

const postsCollection = collection(db, "posts")

function mapDocToPost(docSnap: QueryDocumentSnapshot<DocumentData>): Post {
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
  }
}

export function listenToPosts(
  onUpdate: (posts: Post[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // Subscribe to Firestore updates ordered by newest first.
  const postsQuery = query(postsCollection, orderBy("timestamp", "desc"))
  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((docSnap) => mapDocToPost(docSnap))
      onUpdate(posts)
    },
    onError,
  )
}

export async function createPost(input: CreatePostInput) {
  // Firestore will replace the timestamp server-side so the feed stays in sync globally.
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
  })
}

export async function toggleLike(postId: string, userId: string, shouldLike: boolean) {
  const postRef = doc(db, "posts", postId)
  await updateDoc(postRef, {
    likes: shouldLike ? arrayUnion(userId) : arrayRemove(userId),
  })
}

export function listenToComments(
  postId: string,
  onUpdate: (comments: CommentDoc[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const commentsRef = collection(db, "posts", postId, "comments")
  const commentsQuery = query(commentsRef, orderBy("timestamp", "asc"))
  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          text: data.text,
          userId: data.userId,
          timestamp: data.timestamp,
        } satisfies CommentDoc
      })
      onUpdate(comments)
    },
    onError,
  )
}

export async function addComment({ postId, text, userId }: CreateCommentInput) {
  const commentsRef = collection(db, "posts", postId, "comments")
  await addDoc(commentsRef, {
    text,
    userId,
    timestamp: serverTimestamp(),
  })
}

export async function deleteComment(postId: string, commentId: string) {
  const commentRef = doc(db, "posts", postId, "comments", commentId)
  await deleteDoc(commentRef)
}

export async function deletePost(post: Pick<Post, "id" | "fileId"> & { thumbnailFileId?: string | null }) {
  const postRef = doc(postsCollection, post.id)

  // Remove nested comments before deleting the post document to avoid orphaned refs.
  const commentsRef = collection(db, "posts", post.id, "comments")
  const commentsSnapshot = await getDocs(commentsRef)
  await Promise.all(commentsSnapshot.docs.map((commentDoc) => deleteDoc(commentDoc.ref)))

  await deleteDoc(postRef)

  if (post.fileId) {
    const storageRef = ref(storage, post.fileId)
    await deleteObject(storageRef)
  }

  if (post.thumbnailFileId) {
    const thumbRef = ref(storage, post.thumbnailFileId)
    await deleteObject(thumbRef)
  }
}

export async function uploadVideoFile(file: File) {
  // Store raw clips under `videos/` with a random suffix to avoid collisions.
  const extension = file.name.split(".").pop() ?? "mp4"
  const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const fileId = `videos/${uniqueId}.${extension}`
  const storageRef = ref(storage, fileId)
  await uploadBytes(storageRef, file)
  const videoURL = await getDownloadURL(storageRef)
  return { videoURL, fileId }
}

export async function uploadThumbnailFile(blob: Blob) {
  // Mirrors the video uploader but stores static posters under a different prefix.
  const uniqueId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  const fileId = `thumbnails/${uniqueId}.jpg`
  const storageRef = ref(storage, fileId)
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || "image/jpeg",
  })
  const thumbnailURL = await getDownloadURL(storageRef)
  return { thumbnailURL, fileId }
}

export async function incrementViewCount(postId: string) {
  // Use Firestore's atomic increment to avoid race conditions between clients.
  const postRef = doc(db, "posts", postId)
  await updateDoc(postRef, {
    viewCount: increment(1),
  })
}
