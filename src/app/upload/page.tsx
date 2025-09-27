"use client"

import { useState } from "react"
import { storage, db, auth } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"

/**
 * Professional upload page component with modern UI
 * - Centered layout with dashed border upload area
 * - Character count indicators for title and description
 * - Video preview with proper sizing
 * - Clean form design matching modern upload interfaces
 */
export default function UploadPage() {
    // Form state management
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("Stand-up")
    const [uploading, setUploading] = useState(false)

    // Character limits
    const TITLE_LIMIT = 100
    const DESCRIPTION_LIMIT = 500

    /**
     * Handle video file selection from file input or drag & drop
     */
    const handleFileSelect = (file: File) => {
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file)
        } else {
            alert('Please select a valid video file')
        }
    }

    /**
     * Handle video upload process with validation and error handling
     */
    const handleUpload = async () => {
        if (!videoFile || !auth.currentUser || !title.trim()) {
            alert("Please select a video file and enter a title")
            return
        }

        setUploading(true)

        try {
            const fileId = uuidv4()
            const fileRef = ref(storage, `videos/${fileId}`)

            await uploadBytes(fileRef, videoFile)
            const url = await getDownloadURL(fileRef)

            await addDoc(collection(db, "posts"), {
                title: title.trim(),
                description: description.trim(),
                videoURL: url,
                userId: auth.currentUser.uid,
                timestamp: serverTimestamp(),
                category,
                fileId,
            })

            alert("✅ Video uploaded successfully!")
            setTitle("")
            setDescription("")
            setVideoFile(null)
        } catch (err) {
            console.error("Upload error:", err)
            alert("❌ Upload failed. Please try again.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="min-h-screen space-y-10">
            <header className="space-y-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Upload</p>
                <h1 className="text-4xl font-black text-[var(--ink)]">Drop a new set</h1>
                <p className="mx-auto max-w-md text-sm font-medium text-[var(--muted)]">
                    Keep it under 100MB, add a title, and hit publish.
                </p>
            </header>

            <section className="app-card mx-auto w-full max-w-2xl space-y-8 p-6">
                <div
                    className={`flex min-h-[260px] flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-[var(--line)] bg-[var(--paper)] text-center transition ${
                        videoFile ? "bg-[var(--accent)]/25" : ""
                    }`}
                    onDragOver={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.add("bg-[var(--accent)]/30")
                    }}
                    onDragLeave={(e) => {
                        e.currentTarget.classList.remove("bg-[var(--accent)]/30")
                    }}
                    onDrop={(e) => {
                        e.preventDefault()
                        e.currentTarget.classList.remove("bg-[var(--accent)]/30")
                        const file = e.dataTransfer.files[0]
                        if (file) handleFileSelect(file)
                    }}
                >
                    {!videoFile ? (
                        <div className="space-y-4">
                            <div className="text-6xl">📹</div>
                            <p className="text-lg font-semibold text-[var(--ink)]">Drag your clip here</p>
                            <p className="text-sm font-medium text-[var(--muted)]">MP4, MOV, AVI up to 100MB</p>
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-[var(--line)] bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-[var(--ink)]">
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            handleFileSelect(e.target.files[0])
                                        }
                                    }}
                                    className="hidden"
                                />
                                Choose file
                            </label>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <video
                                src={URL.createObjectURL(videoFile)}
                                controls
                                className="mx-auto max-h-80 w-full rounded-[14px] border-2 border-[var(--line)] object-cover"
                            />
                            <div className="flex items-center justify-center gap-3 text-sm font-semibold text-[var(--ink)]">
                                <span>✓ {videoFile.name}</span>
                                <button
                                    onClick={() => setVideoFile(null)}
                                    className="text-[var(--accent-strong)] underline"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)]">Title *</label>
                            <span className={`text-xs font-semibold ${title.length > TITLE_LIMIT ? "text-[var(--accent-strong)]" : "text-[var(--muted)]"}`}>
                                {title.length}/{TITLE_LIMIT}
                            </span>
                        </div>
                        <input
                            type="text"
                            placeholder="Name your clip"
                            value={title}
                            onChange={(e) => {
                                if (e.target.value.length <= TITLE_LIMIT) {
                                    setTitle(e.target.value)
                                }
                            }}
                            className="w-full rounded-[14px] border-2 border-[var(--line)] bg-[var(--paper)] p-4 text-base font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)]">Description</label>
                            <span className={`text-xs font-semibold ${description.length > DESCRIPTION_LIMIT ? "text-[var(--accent-strong)]" : "text-[var(--muted)]"}`}>
                                {description.length}/{DESCRIPTION_LIMIT}
                            </span>
                        </div>
                        <textarea
                            placeholder="Give a little setup for your punchline"
                            value={description}
                            onChange={(e) => {
                                if (e.target.value.length <= DESCRIPTION_LIMIT) {
                                    setDescription(e.target.value)
                                }
                            }}
                            rows={4}
                            className="w-full rounded-[14px] border-2 border-[var(--line)] bg-[var(--paper)] p-4 text-base font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--ink)]">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full rounded-[14px] border-2 border-[var(--line)] bg-[var(--paper)] p-4 text-base font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        >
                            <option value="Stand-up">🎤 Stand-up</option>
                            <option value="Impression">🎭 Impression</option>
                            <option value="Rant">💬 Rant</option>
                            <option value="Sketch">🎬 Sketch</option>
                            <option value="Music">🎵 Music</option>
                            <option value="Other">📝 Other</option>
                        </select>
                    </div>

                    <Button
                        onClick={handleUpload}
                        disabled={uploading || !videoFile || !title.trim() || title.length > TITLE_LIMIT || description.length > DESCRIPTION_LIMIT}
                        className="w-full border-2 border-[var(--line)] bg-[var(--accent-strong)] py-4 text-lg font-bold text-[var(--paper)] shadow-[0_6px_0_rgba(31,27,22,0.15)] transition disabled:cursor-not-allowed disabled:border-[var(--muted)] disabled:bg-[var(--paper)] disabled:text-[var(--muted)]"
                    >
                        {uploading ? (
                            <span className="flex items-center justify-center gap-3">
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--paper)] border-t-transparent" />
                                Uploading...
                            </span>
                        ) : (
                            "Publish Clip"
                        )}
                    </Button>
                </div>
            </section>
        </div>
    )
}
