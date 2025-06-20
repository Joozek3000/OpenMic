"use client"

import { useEffect, useState } from "react"
import { db, auth } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function ProfilePage() {
    const [displayName, setDisplayName] = useState("")
    const [savedName, setSavedName] = useState("")
    const user = auth.currentUser

    useEffect(() => {
        const fetchName = async () => {
            if (!user) return
            const ref = doc(db, "users", user.uid)
            const snap = await getDoc(ref)
            if (snap.exists()) {
                setSavedName(snap.data().displayName || "")
            }
        }

        fetchName()
    }, [user])

    const saveName = async () => {
        if (!user || !displayName.trim()) return
        const ref = doc(db, "users", user.uid)
        await setDoc(ref, {
            displayName: displayName.trim(),
            createdAt: serverTimestamp(),
        })
        setSavedName(displayName.trim())
    }

    return (
        <div className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-4">Your Profile</h1>

            {savedName ? (
                <p className="text-green-400 mb-4">👤 Display Name: {savedName}</p>
            ) : (
                <p className="text-gray-400 mb-4">You don't have a name set yet.</p>
            )}

            <Input
                className="text-black"
                placeholder="Enter display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
            />

            <Button className="mt-2" onClick={saveName}>
                Save
            </Button>
        </div>
    )
}
