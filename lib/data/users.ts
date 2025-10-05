import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"

import { db } from "@/lib/firebase"
import type { UserProfile } from "@/lib/types"

const displayNameCache = new Map<string, string | null>()

export async function ensureUserProfile(userId: string) {
  const userRef = doc(db, "users", userId)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      updatedAt: serverTimestamp(),
    })
  }
}

export async function getDisplayName(userId: string) {
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId) ?? undefined
  }

  const userRef = doc(db, "users", userId)
  const snapshot = await getDoc(userRef)

  if (snapshot.exists()) {
    const data = snapshot.data() as UserProfile
    displayNameCache.set(userId, data.displayName ?? null)
    return data.displayName
  }

  displayNameCache.set(userId, null)
  return undefined
}

export async function updateDisplayName(userId: string, displayName: string) {
  const userRef = doc(db, "users", userId)
  await setDoc(
    userRef,
    {
      displayName,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
  displayNameCache.set(userId, displayName)
}

export async function getUserProfile(userId: string) {
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
  } satisfies UserProfile
}
