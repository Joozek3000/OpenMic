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
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-2xl mx-auto">
                {/* Header section */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold mb-2">Create Video</h1>
                    <p className="text-gray-400 text-lg">Share your creativity with the world</p>
                </div>

                {/* Upload area with dashed border */}
                <div className="mb-8">
                    <div 
                        className={`border-2 border-dashed border-gray-600 rounded-xl p-8 text-center transition-colors hover:border-gray-500 ${
                            videoFile ? 'border-blue-500 bg-blue-500/5' : ''
                        }`}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.add('border-blue-500', 'bg-blue-500/5')
                        }}
                        onDragLeave={(e) => {
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-500/5')
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            e.currentTarget.classList.remove('border-blue-500', 'bg-blue-500/5')
                            const file = e.dataTransfer.files[0]
                            if (file) handleFileSelect(file)
                        }}
                    >
                        {!videoFile ? (
                            <div className="space-y-4">
                                <div className="text-6xl text-gray-400">📹</div>
                                <div>
                                    <p className="text-xl text-gray-300 mb-2">Drop your video here</p>
                                    <p className="text-gray-500 mb-4">or</p>
                                    <label className="inline-block">
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
                                        <div className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg cursor-pointer font-medium transition-colors">
                                            Choose File
                                        </div>
                                    </label>
                                </div>
                                <p className="text-sm text-gray-500">MP4, MOV, AVI up to 100MB</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <video
                                    src={URL.createObjectURL(videoFile)}
                                    controls
                                    className="w-full max-w-md mx-auto rounded-lg"
                                    style={{ maxHeight: '300px' }}
                                />
                                <div className="flex items-center justify-center gap-4">
                                    <span className="text-green-400">✓ {videoFile.name}</span>
                                    <button
                                        onClick={() => setVideoFile(null)}
                                        className="text-red-400 hover:text-red-300 text-sm underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form fields */}
                <div className="space-y-6">
                    {/* Title field with character counter */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-lg font-medium">Title *</label>
                            <span className={`text-sm ${title.length > TITLE_LIMIT ? 'text-red-400' : 'text-gray-400'}`}>
                                {title.length}/{TITLE_LIMIT}
                            </span>
                        </div>
                        <input
                            type="text"
                            placeholder="Enter video title"
                            value={title}
                            onChange={(e) => {
                                if (e.target.value.length <= TITLE_LIMIT) {
                                    setTitle(e.target.value)
                                }
                            }}
                            className="w-full p-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                        />
                    </div>

                    {/* Description field with character counter */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-lg font-medium">Description</label>
                            <span className={`text-sm ${description.length > DESCRIPTION_LIMIT ? 'text-red-400' : 'text-gray-400'}`}>
                                {description.length}/{DESCRIPTION_LIMIT}
                            </span>
                        </div>
                        <textarea
                            placeholder="Tell your audience about your video"
                            value={description}
                            onChange={(e) => {
                                if (e.target.value.length <= DESCRIPTION_LIMIT) {
                                    setDescription(e.target.value)
                                }
                            }}
                            rows={4}
                            className="w-full p-4 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                        />
                    </div>

                    {/* Category selector */}
                    <div>
                        <label className="text-lg font-medium block mb-2">Category</label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-4 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-blue-500 focus:outline-none transition-colors"
                        >
                            <option value="Stand-up">🎤 Stand-up</option>
                            <option value="Impression">🎭 Impression</option>
                            <option value="Rant">💬 Rant</option>
                            <option value="Sketch">🎬 Sketch</option>
                            <option value="Music">🎵 Music</option>
                            <option value="Other">📝 Other</option>
                        </select>
                    </div>

                    {/* Upload button */}
                    <Button
                        onClick={handleUpload}
                        disabled={uploading || !videoFile || !title.trim() || title.length > TITLE_LIMIT || description.length > DESCRIPTION_LIMIT}
                        className="w-full py-4 text-lg font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                        {uploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                                Uploading...
                            </span>
                        ) : (
                            "Publish Video"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
