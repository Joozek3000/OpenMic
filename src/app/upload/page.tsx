"use client"

import { useState } from "react"
import { storage, db, auth } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"

/**
 * Upload page component
 * - Handles video file selection and upload to Firebase Storage
 * - Saves video metadata to Firestore posts collection
 * - Includes form for title, description, and comedy category
 * - Shows video preview before upload
 * - Mobile-optimized upload experience
 */
export default function UploadPage() {
    // Form state management
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("Stand-up") // Default to most common comedy type
    const [uploading, setUploading] = useState(false)



    /**
     * Handle video upload process
     * 1. Validate required fields (video file, title, authenticated user)
     * 2. Upload video file to Firebase Storage
     * 3. Save post metadata to Firestore
     * 4. Reset form on success
     */
    const handleUpload = async () => {
        // Validation - ensure we have required data
        if (!videoFile || !auth.currentUser || !title.trim()) {
            alert("Title is required.")
            return
        }

        setUploading(true)

        try {
            // Generate unique file ID for storage
            const fileId = uuidv4()
            const fileRef = ref(storage, `videos/${fileId}`)

            // Upload video file to Firebase Storage
            await uploadBytes(fileRef, videoFile)
            const url = await getDownloadURL(fileRef)

            // Save post data to Firestore
            await addDoc(collection(db, "posts"), {
                title: title.trim(),
                description: description.trim(),
                videoURL: url,
                userId: auth.currentUser.uid,
                timestamp: serverTimestamp(),
                category,
                fileId, // Store fileId for future deletion capability
            })

            // Success - reset form
            alert("✅ Uploaded!")
            setTitle("")
            setDescription("")
            setVideoFile(null)
        } catch (err) {
            console.error("Upload error:", err)
            alert("❌ Upload failed")
        } finally {
            setUploading(false)
        }
    }


    return (
        <div className="min-h-screen bg-black text-white p-4 flex flex-col gap-4 max-w-md mx-auto">
            {/* Page header */}
            <h1 className="text-2xl font-bold">Upload Video</h1>

            {/* Video file input */}
            <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        setVideoFile(e.target.files[0])
                    }
                }}
                className="text-black"
            />

            {/* Video preview - show selected video before upload */}
            {videoFile && (
                <video
                    src={URL.createObjectURL(videoFile)}
                    controls
                    className="w-full h-64 object-cover rounded-lg"
                />
            )}



            {/* Title input - required field */}
            <input
                type="text"
                placeholder="Title (required)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-black p-2 rounded"
            />

            {/* Description input - optional */}
            <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-black p-2 rounded"
                rows={3}
            />

            {/* Comedy category selector */}
            <div>
                <label className="text-sm text-gray-400 block mb-1">Comedy Category</label>
                <select
                    className="text-black p-2 rounded w-full"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="Stand-up">Stand-up</option>
                    <option value="Impression">Impression</option>
                    <option value="Rant">Rant</option>
                    <option value="Sketch">Sketch</option>
                    <option value="Music">Music</option>
                    <option value="Other">Other</option>
                </select>
            </div>


            {/* Upload button - disabled during upload or if no video selected */}
            <Button 
                onClick={handleUpload} 
                disabled={uploading || !videoFile || !title.trim()}
                className="w-full"
            >
                {uploading ? "Uploading..." : "Upload Video"}
            </Button>
        </div>
    )
}
