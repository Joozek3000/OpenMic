"use client"

import { useAnonAuth } from "@/lib/useAnonAuth"

/**
 * AuthBootstrap component
 * - Initializes Firebase anonymous authentication on app startup
 * - Runs authentication logic via custom hook
 * - Renders nothing (null component) - purely for side effects
 * - Must be included in app layout to ensure auth is available globally
 */
export default function AuthBootstrap() {
    // Initialize anonymous authentication
    useAnonAuth()
    
    // This component has no UI - it only handles authentication setup
    return null
}
