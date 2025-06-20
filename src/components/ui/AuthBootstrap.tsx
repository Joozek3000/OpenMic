"use client"

import { useAnonAuth } from "@/lib/useAnonAuth"

export default function AuthBootstrap() {
    useAnonAuth()
    return null
}
