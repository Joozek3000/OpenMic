"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Upload, Play, X } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DEFAULT_CATEGORY_VALUE, STANDUP_CATEGORIES } from "@/lib/constants"
import { createPost, uploadVideoFile } from "@/lib/data/posts"

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(DEFAULT_CATEGORY_VALUE)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview)
      }
    }
  }, [videoPreview])

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoPreview(url)
    }
  }

  const removeVideo = () => {
    setVideoFile(null)
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview)
      setVideoPreview(null)
    }
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setCategory(DEFAULT_CATEGORY_VALUE)
    removeVideo()
  }

  const handleSubmit = async () => {
    if (!user) {
      alert("Please wait for sign-in before uploading.")
      return
    }

    if (!videoFile || !title.trim()) {
      setFeedback("Title and video are required.")
      return
    }

    setIsUploading(true)
    setFeedback(null)

    try {
      const { videoURL, fileId } = await uploadVideoFile(videoFile)
      await createPost({
        title: title.trim(),
        description: description.trim(),
        category,
        videoURL,
        userId: user.uid,
        fileId,
      })

      alert("Stand-up clip uploaded!")
      resetForm()
    } catch (error) {
      console.error("Failed to upload post", error)
      alert("Upload failed. Please try again.")
      setFeedback("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  const disableForm = authLoading || !user || isUploading

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="max-w-md mx-auto p-4">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-2xl font-bold mb-2">Upload Set</h1>
          <p className="text-gray-400">Share your sharpest punchlines with the community.</p>
        </div>

        <div className="mb-6">
          {!videoPreview ? (
            <label className="block">
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors cursor-pointer">
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">Upload Video</p>
                <p className="text-sm text-gray-400 mb-4">MP4, MOV or WebM up to 200MB</p>
                <div className="bg-white text-black px-6 py-2 rounded-full inline-block font-semibold">Choose File</div>
              </div>
              <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
            </label>
          ) : (
            <div className="relative">
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="aspect-[9/16] bg-gray-700 flex items-center justify-center relative">
                  <video src={videoPreview} className="h-full w-full object-cover" controls playsInline />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play size={48} className="text-white/80" />
                  </div>
                </div>
              </div>
              <button
                onClick={removeVideo}
                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this set..."
              disabled={disableForm}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent disabled:opacity-60"
              maxLength={100}
            />
            <div className="text-right text-xs text-gray-400 mt-1">{title.length}/100</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Set the scene, tease a punchline..."
              rows={4}
              disabled={disableForm}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none disabled:opacity-60"
              maxLength={500}
            />
            <div className="text-right text-xs text-gray-400 mt-1">{description.length}/500</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={disableForm}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent disabled:opacity-60"
            >
              {STANDUP_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {feedback && <p className="text-sm text-amber-300 mt-4">{feedback}</p>}

        <div className="mt-8 pb-8">
          <button
            onClick={handleSubmit}
            disabled={disableForm || !videoFile || !title.trim()}
            className="w-full bg-white text-black py-4 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            {isUploading ? "Uploading…" : videoFile ? "Post Clip" : "Upload Video First"}
          </button>
        </div>
      </div>
    </div>
  )
}
