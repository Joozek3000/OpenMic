"use client"

import { useEffect, useMemo, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore"
import { formatDistanceToNow } from "date-fns"

interface Post {
    id: string;
    title: string;
    description?: string;
    category?: string;
    videoURL: string;
    timestamp?: Timestamp;
}

/**
 * Search page
 * - Fetches posts once and filters client-side by keyword & category
 * - Brutalist, light UI inspired by mobile clip browsers
 */
export default function SearchPage() {
    const [posts, setPosts] = useState<Post[]>([])
    const [queryText, setQueryText] = useState("")
    const [activeCategory, setActiveCategory] = useState<string>("All")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const postsQuery = query(collection(db, "posts"), orderBy("timestamp", "desc"))
                const snapshot = await getDocs(postsQuery)
                const fetchedPosts = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as Post),
                }))
                setPosts(fetchedPosts)
            } catch (error) {
                console.error("Failed to load posts for search:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchPosts()
    }, [])

    const categories = useMemo(() => {
        const unique = new Set<string>()
        posts.forEach((post) => {
            if (post.category) unique.add(post.category)
        })
        return ["All", ...Array.from(unique)]
    }, [posts])

    const filteredPosts = useMemo(() => {
        const normalizedQuery = queryText.trim().toLowerCase()

        return posts.filter((post) => {
            const matchesCategory = activeCategory === "All" || post.category === activeCategory
            if (!normalizedQuery) return matchesCategory

            const haystack = `${post.title} ${post.description ?? ""}`.toLowerCase()
            return matchesCategory && haystack.includes(normalizedQuery)
        })
    }, [posts, queryText, activeCategory])

    return (
        <div className="min-h-screen space-y-8">
            <header className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Search</p>
                <h1 className="text-3xl font-black text-[var(--ink)]">Find a clip</h1>
                <p className="max-w-md text-sm font-medium text-[var(--muted)]">
                    Filter by category or punch in a keyword to uncover your next favorite set.
                </p>
            </header>

            <section className="app-card space-y-4 p-5">
                <div className="rounded-[16px] border-2 border-[var(--line)] bg-[var(--accent)]/30 p-4">
                    <input
                        value={queryText}
                        onChange={(e) => setQueryText(e.target.value)}
                        placeholder="Search title or description"
                        className="search-input"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {categories.map((category) => {
                        const isActive = category === activeCategory
                        return (
                            <button
                                key={category}
                                onClick={() => setActiveCategory(category)}
                                className={`tag-pill ${isActive ? "tag-pill--active" : ""}`}
                            >
                                {category}
                            </button>
                        )
                    })}
                </div>
            </section>

            <section className="space-y-4 pb-16">
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="app-card h-32 w-full animate-pulse bg-[var(--paper)]/60" />
                        ))}
                    </div>
                ) : filteredPosts.length === 0 ? (
                    <div className="app-card p-6 text-center text-sm font-semibold text-[var(--muted)]">
                        Nothing yet. Try another keyword or category.
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <article key={post.id} className="app-card flex flex-col gap-4 p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
                                        <span>{post.category ?? "Comedy"}</span>
                                        <span>
                                            {post.timestamp
                                                ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true })
                                                : "Just now"}
                                        </span>
                                    </div>
                                    <h2 className="text-xl font-black text-[var(--ink)]">{post.title}</h2>
                                    {post.description && (
                                        <p className="text-sm font-medium text-[var(--muted)]">
                                            {post.description}
                                        </p>
                                    )}
                                </div>
                                <video
                                    src={post.videoURL}
                                    muted
                                    loop
                                    playsInline
                                    className="h-32 w-24 rounded-[12px] border-2 border-[var(--line)] object-cover"
                                />
                            </div>

                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">
                                <span>{post.category ? `#${post.category.toLowerCase()}` : "#openmic"}</span>
                                <span>{post.videoURL ? "Tap clip in feed" : ""}</span>
                            </div>
                        </article>
                    ))
                )}
            </section>
        </div>
    )
}
