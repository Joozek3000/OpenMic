"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { db, auth, storage } from "@/lib/firebase"
import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  Timestamp,
} from "firebase/firestore"
import { formatDistanceToNow } from "date-fns"
import { deleteObject, ref } from "firebase/storage"
import { Heart, MessageCircle, MoreHorizontal, Pause, Play, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import FloatingBottomNav from "@/components/navigation/FloatingBottomNav"

interface Post {
  id: string
  title: string
  description?: string
  videoURL: string
  userId: string
  timestamp?: Timestamp
  likes?: string[]
  category?: string
  fileId?: string
}

interface Comment {
  id: string
  text: string
  userId: string
  timestamp?: Timestamp
}

export default function FeedView() {
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [posts, setPosts] = useState<Post[]>([])
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [newComments, setNewComments] = useState<Record<string, string>>({})
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null)
  const [playingState, setPlayingState] = useState<Record<string, boolean>>({})

  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const currentUser = auth.currentUser?.uid

  // Pull down posts + related metadata
  useEffect(() => {
    let isMounted = true

    const fetchPosts = async () => {
      try {
        const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"))
        const snapshot = await getDocs(postsQuery)
        const fetchedPosts = snapshot.docs.map((firestoreDoc) => ({
          id: firestoreDoc.id,
          ...(firestoreDoc.data() as Post),
        }))

        if (!isMounted) return
        setPosts(fetchedPosts)

        const commentEntries = await Promise.all(
          fetchedPosts.map(async (post) => {
            const commentsRef = collection(db, "posts", post.id, "comments")
            const commentsSnapshot = await getDocs(query(commentsRef, orderBy("timestamp", "desc")))
            const commentData = commentsSnapshot.docs.map((commentDoc) => ({
              id: commentDoc.id,
              ...(commentDoc.data() as Comment),
            }))
            return [post.id, commentData] as const
          })
        )

        if (isMounted) setComments(Object.fromEntries(commentEntries))

        const distinctUserIds = Array.from(new Set(fetchedPosts.map((post) => post.userId)))
        if (!distinctUserIds.length) return
        const userSnapshots = await Promise.all(
          distinctUserIds.map((userId) => getDoc(doc(db, "users", userId)))
        )

        if (!isMounted) return
        const fetchedNames: Record<string, string> = {}
        userSnapshots.forEach((snap, index) => {
          if (!snap.exists()) return
          const displayName = snap.data().displayName
          if (displayName) fetchedNames[distinctUserIds[index]] = displayName
        })

        if (Object.keys(fetchedNames).length) {
          setUserNames((prev) => ({ ...prev, ...fetchedNames }))
        }
      } catch (error) {
        console.error("Failed to load feed:", error)
      }
    }

    fetchPosts()
    return () => {
      isMounted = false
    }
  }, [])

  const postIds = useMemo(() => posts.map((post) => post.id), [posts])
  const activePost = useMemo(
    () => (activeCommentsPostId ? posts.find((post) => post.id === activeCommentsPostId) : undefined),
    [activeCommentsPostId, posts]
  )
  const activePostComments = activeCommentsPostId ? comments[activeCommentsPostId] ?? [] : []
  const activeCommentDraft = activeCommentsPostId ? newComments[activeCommentsPostId] ?? "" : ""
  const activePostDisplayName = activePost
    ? userNames[activePost.userId] || activePost.userId.slice(0, 6)
    : ""

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveCommentsPostId(null)
      }
    }

    if (activeCommentsPostId) {
      document.addEventListener("keydown", handleKey)
    }

    return () => document.removeEventListener("keydown", handleKey)
  }, [activeCommentsPostId])

  // Seed play state for new clips
  useEffect(() => {
    if (!posts.length) {
      setPlayingState({})
      return
    }

    setPlayingState((prev) => {
      const next: Record<string, boolean> = {}
      for (const id of postIds) {
        next[id] = prev[id] ?? true
      }
      return next
    })
  }, [postIds, posts.length])

  // Auto play the clip in view & pause the rest
  useEffect(() => {
    if (!posts.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute("data-post-id")
          if (!postId) return
          const video = videoRefs.current[postId]
          if (!video) return

          if (entry.isIntersecting && playingState[postId] !== false) {
            void video.play().catch(() => undefined)
          } else if (!entry.isIntersecting && !video.paused) {
            video.pause()
          }
        })
      },
      { threshold: 0.75 }
    )

    postIds.forEach((id) => {
      const section = sectionRefs.current[id]
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [postIds, playingState, posts.length])

  const togglePlayback = (postId: string) => {
    const video = videoRefs.current[postId]
    if (!video) return

    if (video.paused) {
      void video.play().catch(() => undefined)
      setPlayingState((prev) => ({ ...prev, [postId]: true }))
    } else {
      video.pause()
      setPlayingState((prev) => ({ ...prev, [postId]: false }))
    }
  }

  const handleLike = async (post: Post) => {
    if (!currentUser) return
    const alreadyLiked = post.likes?.includes(currentUser)
    const updatedLikes = alreadyLiked
      ? post.likes?.filter((id) => id !== currentUser)
      : [...(post.likes || []), currentUser]

    await updateDoc(doc(db, "posts", post.id), { likes: updatedLikes })
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: updatedLikes } : p)))
  }

  const handleDelete = async (post: Post) => {
    if (!auth.currentUser || auth.currentUser.uid !== post.userId) return

    const confirmDelete = window.confirm("Delete this post?")
    if (!confirmDelete) return

    try {
      if (post.fileId) {
        const videoRef = ref(storage, `videos/${post.fileId}`)
        await deleteObject(videoRef).catch(() => undefined)
      }

      await deleteDoc(doc(db, "posts", post.id))
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } catch (error) {
      console.error("Error deleting post:", error)
    }
  }

  const handleCommentSubmit = async (postId: string) => {
    const text = newComments[postId]
    if (!text?.trim() || !currentUser) return

    const commentRef = collection(db, "posts", postId, "comments")
    const newComment = {
      text: text.trim(),
      userId: currentUser,
      timestamp: serverTimestamp(),
    }

    const docRef = await addDoc(commentRef, newComment)

    setComments((prev) => ({
      ...prev,
      [postId]: [{ id: docRef.id, ...(newComment as Comment) }, ...(prev[postId] || [])],
    }))

    setNewComments((prev) => ({ ...prev, [postId]: "" }))
  }

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!currentUser) return

    const confirmDelete = window.confirm("Delete this comment?")
    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, "posts", postId, "comments", commentId))
      setComments((prev) => ({
        ...prev,
        [postId]: prev[postId]?.filter((comment) => comment.id !== commentId),
      }))
    } catch (error) {
      console.error("Failed to delete comment:", error)
    }
  }

  return (
    <div className="relative h-screen w-full bg-black text-white">
      <div className="relative h-full snap-y snap-mandatory overflow-y-scroll">
        {posts.length === 0 ? (
          <section className="flex h-screen w-full snap-start items-center justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Loading clips…</p>
          </section>
        ) : (
          posts.map((post) => {
            const likeCount = post.likes?.length || 0
            const likedByUser = post.likes?.includes(currentUser || "")
            const displayName = userNames[post.userId] || post.userId.slice(0, 6)
            const commentCount = comments[post.id]?.length ?? 0
            const isPlaying = playingState[post.id] !== false
            const timeAgo = post.timestamp
              ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true })
              : "Just now"

            return (
              <section
                key={post.id}
                data-post-id={post.id}
                ref={(node) => {
                  if (node) sectionRefs.current[post.id] = node
                  else delete sectionRefs.current[post.id]
                }}
                className="relative h-screen w-full snap-start overflow-hidden"
              >
                <video
                  ref={(node) => {
                    if (node) videoRefs.current[post.id] = node
                    else delete videoRefs.current[post.id]
                  }}
                  src={post.videoURL}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  onClick={() => togglePlayback(post.id)}
                  onPlay={() => setPlayingState((prev) => ({ ...prev, [post.id]: true }))}
                  onPause={() => setPlayingState((prev) => ({ ...prev, [post.id]: false }))}
                  className="absolute inset-0 h-full w-full cursor-pointer object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                <button
                  onClick={() => togglePlayback(post.id)}
                  className="pointer-events-auto absolute left-1/2 top-1/2 z-40 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur transition hover:bg-black/75"
                >
                  {isPlaying ? <Pause className="h-10 w-10" /> : <Play className="h-10 w-10" />}
                </button>

                <div className="pointer-events-none absolute inset-0 flex flex-col">
                  <div className="flex justify-between px-6 pt-10 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">
                    <span>{post.category ?? "Comedy"}</span>
                    <span>{timeAgo}</span>
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-8 px-6 pb-32">
                    <div className="pointer-events-auto max-w-md space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/10 text-lg font-semibold">
                          {displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-3 text-sm font-semibold">
                          <span className="text-base font-semibold">@{displayName}</span>
                          <button className="rounded-full bg-white/20 px-4 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:bg-white/30">
                            Follow
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h2 className="text-2xl font-semibold drop-shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
                          {post.title}
                        </h2>
                        {post.description && (
                          <p className="text-sm text-white/80">{post.description}</p>
                        )}
                      </div>

                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                        🎵 Original Sound - {displayName}
                      </p>
                    </div>

                    <div className="pointer-events-auto flex flex-col items-center gap-4 text-white">
                      <button
                        className={`flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-white ${
                          likedByUser ? "bg-orange-500 text-white hover:bg-orange-500" : ""
                        }`}
                        onClick={() => handleLike(post)}
                      >
                        <Heart className="h-6 w-6" />
                      </button>
                      <span className="text-xs font-semibold text-white/80">{likeCount}</span>

                      <button
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-white"
                        onClick={() => setActiveCommentsPostId(post.id)}
                      >
                        <MessageCircle className="h-6 w-6" />
                      </button>
                      <span className="text-xs font-semibold text-white/80">{commentCount}</span>

                      <button
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-white"
                        onClick={() => navigator.clipboard.writeText(post.videoURL).catch(() => undefined)}
                      >
                        <Share2 className="h-6 w-6" />
                      </button>
                      <span className="text-xs font-semibold text-white/80">Share</span>

                      <button className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-white">
                        <MoreHorizontal className="h-6 w-6" />
                      </button>
                      {auth.currentUser?.uid === post.userId && (
                        <button
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-black shadow-[0_6px_20px_rgba(0,0,0,0.4)] transition hover:bg-white"
                          onClick={() => handleDelete(post)}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-[0.3em]">Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )
          })
        )}
      </div>

      <FloatingBottomNav />

      {activePost && (
        <div
          className="pointer-events-auto fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
          onClick={() => setActiveCommentsPostId(null)}
        >
          <div
            className="mt-auto w-full rounded-t-[32px] bg-black/90 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Comments</p>
                <h2 className="text-lg font-semibold text-white">@{activePostDisplayName}</h2>
              </div>
              <button
                onClick={() => setActiveCommentsPostId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close comments"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
              {activePostComments.length ? (
                activePostComments.map((comment) => {
                  const commenterName =
                    userNames[comment.userId] || comment.userId.slice(0, 6)
                  const timestampLabel = comment.timestamp
                    ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true })
                    : "Just now"

                  return (
                    <div
                      key={comment.id}
                      className="rounded-[20px] bg-white/[0.08] px-4 py-3 text-sm text-white"
                    >
                      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.25em] text-white/50">
                        <span>@{commenterName}</span>
                        <span>{timestampLabel}</span>
                      </div>
                      <p className="mt-2 text-base leading-snug text-white/90">{comment.text}</p>
                      {comment.userId === currentUser && (
                        <button
                          onClick={() => handleDeleteComment(activePost.id, comment.id)}
                          className="mt-3 text-xs font-semibold uppercase tracking-[0.3em] text-orange-400 transition hover:text-orange-300"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-[24px] bg-white/5 px-4 py-8 text-center text-sm font-semibold uppercase tracking-[0.3em] text-white/50">
                  Be the first to drop a comment
                </div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (!activePost) return
                handleCommentSubmit(activePost.id)
              }}
              className="mt-6 flex items-center gap-3 rounded-full bg-white/[0.08] px-4 py-3"
            >
              <Input
                value={activeCommentDraft}
                onChange={(event) =>
                  setNewComments((prev) => ({
                    ...prev,
                    [activePost.id]: event.target.value,
                  }))
                }
                placeholder="Add a comment"
                className="border-none bg-transparent text-base text-white placeholder:text-white/50 focus-visible:ring-0"
              />
              <Button
                type="submit"
                disabled={!activeCommentDraft.trim()}
                className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-white/90 disabled:bg-white/40 disabled:text-black/40"
              >
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
