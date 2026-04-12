"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Upload, Play, X, ImageIcon } from "lucide-react"
import Image from "next/image"

import { useAuth } from "@/components/auth-provider"
import { useToast } from "@/components/toast-provider"
import { DEFAULT_CATEGORY_VALUE, STANDUP_CATEGORIES } from "@/lib/constants"
import { createPost, uploadThumbnailFile, uploadVideoFile } from "@/lib/data/posts"
import {
  getErrorMessage,
  getVideoDuration,
  optimizeThumbnail,
  sanitizeAndValidate,
  validateVideoDuration,
  validateVideoFile,
  withRetry,
} from "@/lib/utils"

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY_VALUE)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackTone, setFeedbackTone] = useState<"neutral" | "warning" | "error">("neutral")
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null)
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const setFeedbackState = (
    message: string | null,
    tone: "neutral" | "warning" | "error" = "neutral",
  ) => {
    setFeedback(message)
    setFeedbackTone(tone)
  }

  useEffect(() => {
    // Clean up video preview URLs when the component unmounts or the file changes.
    return () => {
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview)
      }
    }
  }, [videoPreview])

  useEffect(() => {
    // Also release the thumbnail blob preview once it is replaced.
    return () => {
      if (thumbnailPreview) {
        URL.revokeObjectURL(thumbnailPreview)
      }
    }
  }, [thumbnailPreview])

  const extractThumbnail = async (file: File) => {
    setIsGeneratingThumb(true)
    try {
      setFeedbackState("Generating optimized thumbnail…", "warning")

      const video = document.createElement("video")
      const url = URL.createObjectURL(file)
      video.src = url
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve()
        video.onerror = () => reject(new Error("Unable to capture thumbnail."))
      })

      const optimized = await optimizeThumbnail(video, 720, 1280, 0.65)
      URL.revokeObjectURL(url)

      if (optimized) {
        setThumbnailBlob(optimized)
        setThumbnailPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(optimized)
        })
        setFeedbackState(null)
      } else {
        setThumbnailBlob(null)
        setThumbnailPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }
    } catch (error) {
      console.error("Failed to capture thumbnail", error)
      showToast("Unable to generate a cover image. Your clip will still upload.", "info")
      setThumbnailBlob(null)
      setThumbnailPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    } finally {
      setIsGeneratingThumb(false)
    }
  }

  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // This path validates file type/size/duration before we attempt any upload.
    const file = event.target.files?.[0]
    if (!file) return

    const validation = validateVideoFile(file)
    if (!validation.valid) {
      const message = validation.error ?? "Invalid video file."
      showToast(message, "error")
      setFeedbackState(message, "error")
      event.target.value = ""
      return
    }

    setFeedbackState("Validating video…", "warning")

    try {
      const duration = await getVideoDuration(file)
      const durationCheck = validateVideoDuration(duration, 180)
      if (!durationCheck.valid) {
        const message = durationCheck.error ?? "Video exceeds the maximum length."
        showToast(message, "error")
        setFeedbackState(message, "error")
        setVideoDuration(null)
        event.target.value = ""
        return
      }

      removeVideo()
      setVideoDuration(duration)
      setFeedbackState(null)
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoPreview(url)
      void extractThumbnail(file)
    } catch (error) {
      console.error("Failed to validate video", error)
      const message = getErrorMessage(error)
      showToast(message, "error")
      setFeedbackState(message, "error")
      setVideoDuration(null)
      event.target.value = ""
    }
  }

  // Reset both the video and generated cover when the user removes their selection.
  const removeVideo = () => {
    setVideoFile(null)
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview)
      setVideoPreview(null)
    }
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview)
      setThumbnailPreview(null)
    }
    setThumbnailBlob(null)
    setVideoDuration(null)
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setCategory(DEFAULT_CATEGORY_VALUE)
    removeVideo()
  }

  const handleSubmit = async () => {
    // Upload flow order: video -> optional thumbnail -> Firestore post document.
    if (!user) {
      showToast("Please wait for sign-in before uploading.", "error")
      return
    }

    if (!videoFile) {
      const message = "Select a video before uploading."
      setFeedbackState(message, "error")
      showToast(message, "error")
      return
    }

    if (videoDuration === null) {
      const message = "Validating video duration…"
      setFeedbackState(message, "warning")
      showToast(message, "info")
      return
    }

    const durationCheck = validateVideoDuration(videoDuration, 180)
    if (!durationCheck.valid) {
      const message = durationCheck.error ?? "Video exceeds the maximum length."
      setFeedbackState(message, "error")
      showToast(message, "error")
      return
    }

    const titleResult = sanitizeAndValidate(title, { minLength: 1, maxLength: 100, fieldName: "Title" })
    if (!titleResult.valid) {
      const message = titleResult.error ?? "Title is invalid."
      setFeedbackState(message, "error")
      showToast(message, "error")
      return
    }

    const descriptionResult = sanitizeAndValidate(description, {
      minLength: 0,
      maxLength: 500,
      fieldName: "Description",
    })
    if (!descriptionResult.valid) {
      const message = descriptionResult.error ?? "Description is too long."
      setFeedbackState(message, "error")
      showToast(message, "error")
      return
    }

    setIsUploading(true)
    setFeedbackState("Preparing upload…", "warning")

    let attempts = 0
    try {
      const maxAttempts = 3

      const { videoURL, fileId } = await withRetry(
        async () => {
          attempts += 1
          if (attempts > 1) {
            setFeedbackState(`Uploading… (attempt ${attempts}/${maxAttempts})`, "warning")
          }
          return uploadVideoFile(videoFile)
        },
        { maxAttempts, delayMs: 1000, backoff: true },
      )

      let thumbnailFileId: string | undefined
      let thumbnailURL: string | undefined
      if (thumbnailBlob) {
        const { thumbnailURL: uploadedThumb, fileId: thumbId } = await withRetry(
          () => uploadThumbnailFile(thumbnailBlob),
          { maxAttempts, delayMs: 1000, backoff: true },
        )
        thumbnailFileId = thumbId
        thumbnailURL = uploadedThumb
      }

      await createPost({
        title: titleResult.sanitized,
        description: descriptionResult.sanitized,
        category,
        videoURL,
        userId: user.uid,
        fileId,
        thumbnailURL,
        thumbnailFileId,
      })

      showToast("Stand-up clip uploaded!", "success")
      setFeedbackState(null)
      resetForm()
    } catch (error) {
      console.error("Failed to upload post", error)
      const message = getErrorMessage(error)
      setFeedbackState(message, "error")
      const attemptsUsed = attempts > 0 ? attempts : 1
      showToast(`${message}${attemptsUsed > 1 ? ` (after ${attemptsUsed} attempts)` : ""}`, "error")
    } finally {
      setIsUploading(false)
      setFeedback((current) => {
        if (current && current.startsWith("Uploading…")) {
          setFeedbackTone("neutral")
          return null
        }
        return current
      })
    }
  }

  const titleLength = title.trim().length
  const descriptionLength = description.trim().length
  const durationValid = videoDuration !== null && validateVideoDuration(videoDuration, 180).valid
  const feedbackClass =
    feedbackTone === "error" ? "text-red-400" : feedbackTone === "warning" ? "text-amber-300" : "text-gray-300"

  // Disable interactions while auth is loading, uploading, or we lack a selected clip.
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
                <p className="text-sm text-gray-400 mb-4">MP4, MOV or WebM • Max 200MB • Up to 3 min</p>
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
              {videoDuration !== null && (
                <div className="mt-2 text-xs text-gray-400">
                  Duration: {Math.floor(videoDuration / 60)}:{Math.round(videoDuration % 60).toString().padStart(2, "0")}
                </div>
              )}
              {thumbnailPreview && (
                <div className="mt-3 flex items-center gap-3 text-sm text-gray-300">
                  <div className="relative h-14 w-10 overflow-hidden rounded-lg border border-gray-700">
                    <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-gray-500" />
                    <Image src={thumbnailPreview} alt="Thumbnail preview" fill className="object-cover" />
                  </div>
                  {/* Keep the preview minimal; we only need to reassure the user a cover exists. */}
                  <span>Cover image ready</span>
                </div>
              )}
              {isGeneratingThumb && <p className="mt-2 text-xs text-gray-400">Generating thumbnail…</p>}
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
            <div className={`text-right text-xs mt-1 ${titleLength > 95 ? "text-red-400" : "text-gray-400"}`}>
              {titleLength}/100
            </div>
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
            <div
              className={`text-right text-xs mt-1 ${
                descriptionLength > 475 ? "text-red-400" : "text-gray-400"
              }`}
            >
              {descriptionLength}/500
            </div>
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

        {feedback && <p className={`text-sm ${feedbackClass} mt-4`}>{feedback}</p>}

        <div className="mt-8 pb-8">
          <button
            onClick={handleSubmit}
            disabled={
              disableForm ||
              !videoFile ||
              isGeneratingThumb ||
              !durationValid ||
              titleLength === 0
            }
            className="w-full bg-white text-black py-4 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
          >
            {isUploading
              ? "Uploading…"
              : isGeneratingThumb
                ? "Preparing cover…"
                : !videoFile
                  ? "Upload Video First"
                  : !durationValid
                    ? "Video Too Long"
                    : !titleLength
                      ? "Add a Title"
                      : "Post Clip"}
          </button>
        </div>
      </div>
    </div>
  )
}
