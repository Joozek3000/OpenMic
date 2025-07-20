"use client"

import { useEffect, useState } from "react"
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
} from "firebase/firestore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDistanceToNow } from "date-fns"
import { deleteObject, ref } from "firebase/storage"

// TypeScript interfaces for data structures
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
    id: string;
    text: string;
    userId: string;
}

/**
 * Feed page component - main content discovery interface
 * - Displays all comedy videos in reverse chronological order
 * - Includes like/unlike functionality for posts
 * - Comment system with add/delete capabilities
 * - User display names fetched and cached
 * - Post deletion for content owners
 * - Mobile-first responsive grid layout
 */
export default function FeedPage() {
    // State management for posts, comments, and user data
    const [userNames, setUserNames] = useState<Record<string, string>>({}) // Cache user display names
    const [posts, setPosts] = useState<Post[]>([]) // All posts from Firestore
    const [comments, setComments] = useState<Record<string, Comment[]>>({}) // Comments by post ID
    const [newComments, setNewComments] = useState<Record<string, string>>({}) // Form state for new comments
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

            <div className="flex flex-col gap-8">
                {posts.map((post) => (
                    <div key={post.id} className="bg-zinc-900 rounded-xl overflow-hidden max-w-md mx-auto">
                        {/* Video with overlaid buttons and info - TikTok style */}
                        <div className="relative w-full overflow-hidden rounded-t-lg">
                            <video
                                src={post.videoURL}
                                controls
                                className="w-full h-auto block"
                            />
                            
                            {/* TikTok-style video info overlay - BOTTOM LEFT */}
                            <div 
                                className="absolute bottom-16 left-4 right-20 z-30"
                                style={{
                                    position: 'absolute',
                                    bottom: '64px', // Above video controls
                                    left: '16px',
                                    right: '80px', // Space for engagement buttons
                                    zIndex: 30
                                }}
                            >
                                {/* Video Title */}
                                <h2 style={{
                                    color: '#ffffff',
                                    fontSize: '28px',
                                    fontWeight: 'bold',
                                    marginBottom: '8px',
                                    textShadow: '4px 4px 8px rgba(0,0,0,0.9)',
                                    lineHeight: '1.1'
                                }}>
                                    {post.title}
                                </h2>
                                
                                {/* Username */}
                                <p style={{
                                    color: '#ffffff',
                                    fontSize: '20px',
                                    fontWeight: '700',
                                    marginBottom: '8px',
                                    textShadow: '3px 3px 6px rgba(0,0,0,0.9)'
                                }}>
                                    @{userNames[post.userId] || post.userId.slice(0, 6)}
                                </p>
                                
                                {/* Description (if exists) - truncated for overlay */}
                                {post.description && (
                                    <p style={{
                                        color: '#ffffff',
                                        fontSize: '16px',
                                        marginBottom: '8px',
                                        opacity: 0.95,
                                        textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {post.description}
                                    </p>
                                )}
                                
                                {/* Category and timestamp */}
                                <div className="flex items-center gap-4">
                                    {post.category && (
                                        <span style={{
                                            color: '#ffffff',
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            backgroundColor: 'rgba(0,0,0,0.8)',
                                            backdropFilter: 'blur(8px)'
                                        }}>
                                            🎭 {post.category}
                                        </span>
                                    )}
                                    <span style={{
                                        color: '#ffffff',
                                        fontSize: '16px',
                                        fontWeight: '500',
                                        textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
                                        opacity: 0.9
                                    }}>
                                        {post.timestamp?.seconds
                                            ? formatDistanceToNow(new Date(post.timestamp.seconds * 1000), { addSuffix: true })
                                            : "just now"}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Fixed positioning for engagement buttons - RIGHT SIDE */}
                            <div 
                                className="absolute bottom-16 right-3 flex flex-col gap-6 z-20"
                                style={{ position: 'absolute', right: '12px', bottom: '64px' }}
                            >
                                {/* Like Button with functionality and animation */}
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={() => handleLike(post)}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                                            post.likes?.includes(currentUser || "") 
                                                ? 'bg-red-500/80 animate-pulse' 
                                                : 'bg-gray-600/80 hover:bg-gray-500/80'
                                        }`}
                                        style={{
                                            transform: post.likes?.includes(currentUser || "") ? 'scale(1.1)' : 'scale(1)',
                                            animation: post.likes?.includes(currentUser || "") ? 'heartbeat 0.6s ease-in-out' : 'none'
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '20px', 
                                            fontWeight: 'bold',
                                            color: '#ffffff'
                                        }}>
                                            {post.likes?.includes(currentUser || "") ? '♥' : '♡'}
                                        </div>
                                    </button>
                                    <span className="text-white text-xs mt-1 font-medium">
                                        {post.likes?.length || 0}
                                    </span>
                                </div>

                                {/* Comment Button with functionality */}
                                <div className="flex flex-col items-center">
                                    <button 
                                        onClick={() => {
                                            // Focus on comment input
                                            const commentInput = document.querySelector(`#comment-input-${post.id}`) as HTMLInputElement;
                                            commentInput?.focus();
                                        }}
                                        className="w-12 h-12 rounded-full bg-gray-600/80 hover:bg-gray-500/80 flex items-center justify-center transition-all duration-200"
                                    >
                                        <div style={{fontSize: '20px', fontWeight: 'bold', color: '#ffffff'}}>💬</div>
                                    </button>
                                    <span className="text-white text-xs mt-1 font-medium">
                                        {comments[post.id]?.length || 0}
                                    </span>
                                </div>

                                {/* Share Button - placeholder functionality */}
                                <div className="flex flex-col items-center">
                                    <button 
                                        onClick={() => {
                                            // Simple share functionality - copy URL
                                            navigator.clipboard.writeText(window.location.href);
                                            alert('Link copied to clipboard!');
                                        }}
                                        className="w-12 h-12 rounded-full bg-gray-600/80 hover:bg-gray-500/80 flex items-center justify-center transition-all duration-200"
                                    >
                                        <div style={{fontSize: '20px', fontWeight: 'bold', color: '#ffffff'}}>↗</div>
                                    </button>
                                    <span className="text-white text-xs mt-1 font-medium">
                                        456
                                    </span>
                                </div>

                                {/* Delete Button (only for post owner) */}
                                {auth.currentUser?.uid === post.userId && (
                                    <div className="flex flex-col items-center">
                                        <button
                                            onClick={() => handleDelete(post)}
                                            className="w-12 h-12 rounded-full bg-gray-600/80 hover:bg-red-500/80 flex items-center justify-center transition-all duration-200"
                                        >
                                            <div style={{fontSize: '20px', fontWeight: 'bold', color: '#ffffff'}}>⋯</div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Comments Section - Clean and readable */}
                        <div className="p-4 bg-zinc-900">
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-300">💬 Comments ({comments[post.id]?.length || 0})</h3>
                                
                                {comments[post.id]?.slice(0, 3).map((comment) => (
                                    <div key={comment.id} className="bg-zinc-800 p-3 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <span className="font-semibold text-gray-200">
                                                    {userNames[comment.userId] || comment.userId.slice(0, 6)}
                                                </span>
                                                <p className="text-gray-300 mt-1">{comment.text}</p>
                                            </div>
                                            {comment.userId === currentUser && (
                                                <button
                                                    onClick={() => handleDeleteComment(post.id, comment.id)}
                                                    className="text-xs text-red-400 hover:text-red-300 ml-2 px-2 py-1 rounded hover:bg-red-900/20"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Comment input - clearly separated */}
                                <div className="flex gap-2 pt-2">
                                    <Input
                                        id={`comment-input-${post.id}`}
                                        className="flex-1 bg-zinc-800 border-zinc-600 text-white placeholder-gray-400"
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
                                        disabled={!newComments[post.id]?.trim()}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
