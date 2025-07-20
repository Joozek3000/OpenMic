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
        
        // Save to users collection with current timestamp
        const ref = doc(db, "users", user.uid)
        await setDoc(ref, {
            displayName: displayName.trim(),
            createdAt: serverTimestamp(),
        })
        
        // Update local state to show saved name
        setSavedName(displayName.trim())
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
            {/* Page header */}
            <h1 className="text-2xl font-bold mb-4">Your Profile</h1>

            {/* Display current saved name or prompt to set one */}
            {savedName ? (
                <p className="text-green-400 mb-4">👤 Display Name: {savedName}</p>
            ) : (
                <p className="text-gray-400 mb-4">You don't have a name set yet.</p>
            )}

            {/* Display name input form */}
            <Input
                className="text-black"
                placeholder="Enter display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
            />

            {/* Save button */}
            <Button className="mt-2" onClick={saveName}>
                Save
            </Button>
        </div>
    )
}
