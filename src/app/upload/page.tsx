"use client"

import { useState } from "react"
import { storage, db, auth } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"



export default function UploadPage() {
    const [videoFile, setVideoFile] = useState<File | null>(null)
    const [title, setTitle] = useState("")
    const [uploading, setUploading] = useState(false)
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("Stand-up") // default category



    const handleUpload = async () => {
        if (!videoFile || !auth.currentUser || !title.trim()) {
            alert("Title is required.")
            return
        }

        setUploading(true)

        const fileId = uuidv4()
        const fileRef = ref(storage, `videos/${fileId}`)

        try {
            await uploadBytes(fileRef, videoFile)
            const url = await getDownloadURL(fileRef)

            await addDoc(collection(db, "posts"), {
                title: title.trim(),
                description: description.trim(),
                videoURL: url,
                userId: auth.currentUser.uid,
                timestamp: serverTimestamp(),
                category,
                fileId, // ✅ keep this so you can delete from storage later
            })

            alert("✅ Uploaded!")
            setTitle("")
            setVideoFile(null)
        } catch (err) {
            console.error("Upload error:", err)
            alert("❌ Upload failed")
        } finally {
            setUploading(false)
        }
    }


    return (

        <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
            <div className="min-h-screen bg-black text-white p-4 flex flex-col gap-4">
                <h1 className="text-2xl font-bold">Upload Video</h1>

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

                {videoFile && (
                    <div className="w-full max-w-md overflow-hidden rounded border border-zinc-700" style={{ height: "500px", width: "800px" }}>
                        <video
                            src={URL.createObjectURL(videoFile)}
                            controls
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                borderRadius: "0.5rem"
                            }}
                        />
                    </div>
                )}



                <input
                    type="text"
                    placeholder="Title (required)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-black p-2 rounded"
                />

                <textarea
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-black p-2 rounded mt-2"
                />

                <label className="text-sm mt-2">Category</label>
                <select
                    className="text-black p-2 rounded"
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


                <Button onClick={handleUpload} disabled={uploading || !videoFile}>
                    {uploading ? "Uploading..." : "Upload"}
                </Button>
            </div>
        </div>
    )
}
