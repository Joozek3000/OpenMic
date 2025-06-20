"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/lib/firebase"
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
    getFirestore,
    getDoc,

} from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"
import { deleteObject, ref } from "firebase/storage"
import { storage } from "@/lib/firebase"



interface Post {
    id: string;
    title: string;
    description?: string;
    videoURL: string;
    userId: string;
    timestamp?: any;
    likes?: string[];
    category?: string;
    fileId?: string;
}



interface Comment {
    id: string
    text: string
    userId: string
}

export default function FeedPage() {
    const [userNames, setUserNames] = useState<Record<string, string>>({})
    const [posts, setPosts] = useState<Post[]>([])
    const [comments, setComments] = useState<Record<string, Comment[]>>({})
    const [newComments, setNewComments] = useState<Record<string, string>>({})
    const currentUser = auth.currentUser?.uid

    useEffect(() => {
        const fetchPosts = async () => {
            const q = query(collection(db, "posts"), orderBy("timestamp", "desc"))
            const snapshot = await getDocs(q)
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Post),
            }))
            setPosts(data)

            // Fetch comments for all posts
            for (const post of data) {
                const cRef = collection(db, "posts", post.id, "comments")
                const cQuery = query(cRef, orderBy("timestamp", "desc"))
                const cSnap = await getDocs(cQuery)
                const cData = cSnap.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as Comment),
                }))
                setComments((prev) => ({ ...prev, [post.id]: cData }))
            }

            for (const post of data) {
                const userId = post.userId
                if (!userNames[userId]) {
                    const snap = await getDoc(doc(db, "users", userId))
                    if (snap.exists()) {
                        setUserNames((prev) => ({ ...prev, [userId]: snap.data().displayName }))
                    }
                }
            }

        }

        fetchPosts()
    }, [])

    const handleLike = async (post: Post) => {
        if (!currentUser) return
        const alreadyLiked = post.likes?.includes(currentUser)
        const updatedLikes = alreadyLiked
            ? post.likes?.filter((id) => id !== currentUser)
            : [...(post.likes || []), currentUser]

        await updateDoc(doc(db, "posts", post.id), {
            likes: updatedLikes,
        })

        setPosts((prev) =>
            prev.map((p) =>
                p.id === post.id ? { ...p, likes: updatedLikes } : p
            )
        )
    };

    const handleDelete = async (post: Post) => {
        if (!auth.currentUser || auth.currentUser.uid !== post.userId) return;

        const confirm = window.confirm("Delete this post?");
        if (!confirm) return;

        try {
            // Delete video from storage (safe handling for fileId fallback)
            if (post.fileId) {
                const videoRef = ref(storage, `videos/${post.fileId}`);
                await deleteObject(videoRef).catch(() => { });
            } else {
                console.warn("No fileId on post — skipping storage delete.");
            }

            // Delete Firestore post
            await deleteDoc(doc(db, "posts", post.id));

            // Update local state
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
        } catch (error) {
            console.error("Error deleting post:", error);
        }
    };


    const handleCommentSubmit = async (postId: string) => {
        const text = newComments[postId]
        if (!text || !currentUser) return

        const commentRef = collection(db, "posts", postId, "comments")
        const newComment = {
            text,
            userId: currentUser,
            timestamp: serverTimestamp(),
        }

        const docRef = await addDoc(commentRef, newComment)

        setComments((prev) => ({
            ...prev,
            [postId]: [{ id: docRef.id, ...newComment }, ...(prev[postId] || [])],
        }))

        setNewComments((prev) => ({ ...prev, [postId]: "" }))
    };

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
    };


    return (
        <div className="min-h-screen bg-black text-white p-6">
            <h1 className="text-3xl font-bold mb-6">🔥 OpenMic Feed</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                    <Card
                        key={post.id}
                        className="bg-zinc-900 rounded-xl overflow-hidden max-w-md mx-auto"
                    >
                        <CardContent className="p-4">
                            <video
                                src={post.videoURL}
                                controls
                                className="w-full h-auto rounded-lg"
                            />
                            <h2 className="mt-3 text-lg font-semibold">{post.title}</h2>

                            {post.description && (
                                <p className="text-sm text-gray-300 mt-1">{post.description}</p>
                            )}

                            {post.category && (
                                <p className="text-xs text-gray-400 mt-1">🎭 {post.category}</p>
                            )}


                            <p className="text-sm text-gray-500 mb-1">
                                Posted{" "}
                                {post.timestamp?.seconds
                                    ? formatDistanceToNow(new Date(post.timestamp.seconds * 1000), { addSuffix: true })
                                    : "just now"}{" "}
                                by {userNames[post.userId] || post.userId.slice(0, 6)}
                            </p>



                            <Button
                                onClick={() => handleLike(post)}
                                variant={
                                    post.likes?.includes(currentUser || "") ? "default" : "outline"
                                }
                                className="mb-3"
                            >
                                👍 {post.likes?.length || 0}
                            </Button>

                            {auth.currentUser?.uid === post.userId && (
                                <Button
                                    variant="destructive"
                                    className="mt-2"
                                    onClick={() => handleDelete(post)}
                                >
                                    🗑️ Delete
                                </Button>
                            )}


                            {/* Comments */}
                            <div className="space-y-2">
                                <h3 className="text-sm text-gray-400">💬 Comments:</h3>
                                {comments[post.id]?.slice(0, 3).map((comment) => (
                                    <div key={comment.id} className="text-sm text-gray-300 flex justify-between items-center">
                                        <span>
                                            <span className="font-semibold">
                                                {userNames[comment.userId] || comment.userId.slice(0, 6)}:
                                            </span>{" "}
                                            {comment.text}
                                        </span>

                                        {comment.userId === currentUser && (
                                            <button
                                                onClick={() => handleDeleteComment(post.id, comment.id)}
                                                className="text-xs text-red-400 hover:text-red-600 ml-2"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                ))}


                                <div className="flex gap-2 mt-2">
                                    <Input
                                        className="text-black"
                                        placeholder="Write a comment..."
                                        value={newComments[post.id] || ""}
                                        onChange={(e) =>
                                            setNewComments((prev) => ({
                                                ...prev,
                                                [post.id]: e.target.value,
                                            }))
                                        }
                                    />
                                    <Button
                                        onClick={() => handleCommentSubmit(post.id)}
                                        disabled={!newComments[post.id]}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
