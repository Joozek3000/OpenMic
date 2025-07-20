"use client"

import { useEffect } from "react"
import { auth } from "./firebase"
import { signInAnonymously, onAuthStateChanged } from "firebase/auth"

/**
 * Custom hook for anonymous authentication
 * 
 * This hook automatically handles user authentication:
 * - Listens for auth state changes
 * - Signs in anonymously if no user is present
 * - Provides seamless background authentication
 * 
 * Anonymous auth allows users to interact with the app
 * without requiring account creation, while still having
 * a unique user ID for likes, comments, etc.
 */
export function useAnonAuth() {
    useEffect(() => {
        // Listen for authentication state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            // If no user is signed in, create an anonymous session
            if (!user) {
                signInAnonymously(auth).catch((error) => {
                    console.error("Anonymous auth failed:", error)
                })
            }
        })

        // Cleanup listener on component unmount
        return () => unsubscribe()
    }, [])
}
