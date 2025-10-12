import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"

import { auth, db } from "@/lib/firebase"
import type { UserProfile } from "@/lib/types"
import { FirestoreError } from "@/lib/types"
import { getErrorMessage, isNetworkError } from "@/lib/utils"

const displayNameCache = new Map<string, string | null>()

export class DisplayNameUnavailableError extends Error {
  constructor(name: string) {
    super(`The name "${name}" is already in use.`)
    this.name = "DisplayNameUnavailableError"
  }
}

/**
 * Ensures a Firestore user profile document exists for the authenticated user.
 */
export async function ensureUserProfile(userId: string) {
  if (auth.currentUser?.uid !== userId) {
    return
  }

  try {
    const userRef = doc(db, "users", userId)
    const snapshot = await getDoc(userRef)

    if (!snapshot.exists()) {
      if (auth.currentUser?.uid !== userId) {
        return
      }

      await setDoc(userRef, {
        updatedAt: serverTimestamp(),
        following: [],
        displayNameLower: null,
      })
    }
  } catch (error) {
    const retryable = isNetworkError(error)
    throw new FirestoreError("Unable to sync your profile. Please try again.", {
      code: "app/ensure-user-profile",
      retryable,
      originalError: error,
    })
  }
}

export async function getDisplayName(userId: string) {
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId) ?? undefined
  }

  try {
    const userRef = doc(db, "users", userId)
    const snapshot = await getDoc(userRef)

    if (snapshot.exists()) {
      const data = snapshot.data() as UserProfile
      displayNameCache.set(userId, data.displayName ?? null)
      return data.displayName
    }

    displayNameCache.set(userId, null)
  } catch (error) {
    console.warn("Failed to fetch display name", error)
  }

  return undefined
}

export async function updateDisplayName(userId: string, displayName: string) {
  const trimmed = displayName.trim()
  if (!trimmed) {
    throw new Error("Display name cannot be empty")
  }

  const normalized = trimmed.toLowerCase()

  try {
    const matches = await getDocs(
      query(collection(db, "users"), where("displayNameLower", "==", normalized), limit(1)),
    )

    if (!matches.empty) {
      const existing = matches.docs[0]
      if (existing.id !== userId) {
        throw new DisplayNameUnavailableError(trimmed)
      }
    }

    const userRef = doc(db, "users", userId)
    await setDoc(
      userRef,
      {
        displayName: trimmed,
        displayNameLower: normalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    displayNameCache.set(userId, trimmed)
  } catch (error) {
    if (error instanceof DisplayNameUnavailableError) {
      throw error
    }

    const retryable = isNetworkError(error)
    const message = retryable ? "Network issue while saving stage name." : getErrorMessage(error)

    throw new FirestoreError(message, {
      code: "app/update-display-name",
      retryable,
      originalError: error,
    })
  }
}

export async function getUserProfile(userId: string) {
  try {
    const userRef = doc(db, "users", userId)
    const snapshot = await getDoc(userRef)
    if (!snapshot.exists()) {
      return undefined
    }

    const data = snapshot.data()
    return {
      uid: userId,
      displayName: data.displayName,
      updatedAt: data.updatedAt,
      following: data.following ?? [],
    } satisfies UserProfile
  } catch (error) {
    console.warn("Failed to fetch user profile", error)
    return undefined
  }
}

export async function toggleFollow(userId: string, targetId: string, shouldFollow: boolean) {
  const userRef = doc(db, "users", userId)
  try {
    await updateDoc(userRef, {
      following: shouldFollow ? arrayUnion(targetId) : arrayRemove(targetId),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    const retryable = isNetworkError(error)
    const message = retryable
      ? "Connection issue while updating follow status."
      : getErrorMessage(error)

    throw new FirestoreError(message, {
      code: "app/toggle-follow",
      retryable,
      originalError: error,
    })
  }
}
