"use client"

import { useEffect } from "react"
import { auth } from "./firebase"
import { signInAnonymously, onAuthStateChanged } from "firebase/auth"

export function useAnonAuth() {
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) signInAnonymously(auth)
        })

        return () => unsub()
    }, [])
}
