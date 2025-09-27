"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/**
 * Profile page component
 * - User account management and display name setting
 * - Fetches and saves user profile data to Firestore
 * - Simple form for updating display name
 * - Mobile-optimized layout with max-width constraint
 */
export default function ProfilePage() {
    // Local state for form input and saved display name
    const [displayName, setDisplayName] = useState("")
    const [savedName, setSavedName] = useState("")
    const user = auth.currentUser

    // Fetch user's display name from Firestore on component mount
    useEffect(() => {
        const fetchName = async () => {
            if (!user) return
            
            // Get user document from Firestore
            const ref = doc(db, "users", user.uid)
            const snap = await getDoc(ref)
            
            if (snap.exists()) {
                setSavedName(snap.data().displayName || "")
            }
        }

        fetchName()
    }, [user])

    // Save display name to Firestore
    const saveName = async () => {
        if (!user || !displayName.trim()) return

        const trimmedName = displayName.trim()

        // Save to users collection without wiping existing fields
        const ref = doc(db, "users", user.uid)
        await setDoc(
            ref,
            {
                displayName: trimmedName,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        )

        // Update local state to show saved name immediately
        setSavedName(trimmedName)
    }

    return (
        <div className="mx-auto min-h-screen w-full max-w-md space-y-6">
            <header className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">Profile</p>
                <h1 className="text-3xl font-black text-[var(--ink)]">Your stage name</h1>
                <p className="text-sm font-medium text-[var(--muted)]">
                    Set a display name so other comics can shout you out in the comments.
                </p>
            </header>

            <div className="app-card space-y-4 p-6">
                {savedName ? (
                    <div className="rounded-[14px] border-2 border-[var(--line)] bg-[var(--accent)]/30 px-4 py-3 text-sm font-semibold text-[var(--ink)]">
                        👤 Display Name: {savedName}
                    </div>
                ) : (
                    <p className="text-sm font-semibold text-[var(--muted)]">You don&apos;t have a name set yet.</p>
                )}

                <Input
                    className="border-2 border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--muted)]"
                    placeholder="Enter display name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                />

                <Button
                    className="w-full border-2 border-[var(--line)] bg-[var(--accent)] py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--accent-strong)]"
                    onClick={saveName}
                >
                    Save name
                </Button>
            </div>
        </div>
    )
}
