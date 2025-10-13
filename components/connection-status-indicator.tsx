"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, Wifi, WifiOff } from "lucide-react"

import { usePostsContext } from "@/components/posts-provider"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"
import type { ConnectionStatus } from "@/lib/types"

const STATUS_STYLES: Record<ConnectionStatus, { bg: string; defaultMessage: string }> = {
  online: { bg: "bg-emerald-600 text-white", defaultMessage: "Connected" },
  offline: { bg: "bg-red-600 text-white", defaultMessage: "Offline" },
  retrying: { bg: "bg-amber-500 text-black", defaultMessage: "Reconnecting…" },
  error: { bg: "bg-red-600 text-white", defaultMessage: "Connection error" },
  connecting: { bg: "bg-blue-600 text-white", defaultMessage: "Connecting…" },
}

function statusIcon(status: ConnectionStatus) {
  if (status === "offline" || status === "error") {
    return <WifiOff className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
  }

  if (status === "retrying" || status === "connecting") {
    return <RefreshCw className="h-4 w-4 md:h-5 md:w-5 animate-spin" aria-hidden="true" />
  }

  return <Wifi className="h-4 w-4 md:h-5 md:w-5" aria-hidden="true" />
}

export function ConnectionStatusIndicator() {
  const { connectionStatus, connectionInfo } = usePostsContext()
  const { light, success, error: hapticError } = useHapticFeedback()
  const [visible, setVisible] = useState(connectionStatus !== "online")
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousStatusRef = useRef<ConnectionStatus>(connectionStatus)

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (previousStatusRef.current === connectionStatus) {
      return
    }

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    switch (connectionStatus) {
      case "online": {
        setVisible(true)
        success()
        hideTimeoutRef.current = setTimeout(() => setVisible(false), 3000)
        break
      }
      case "retrying": {
        setVisible(true)
        light()
        break
      }
      case "offline":
      case "error": {
        setVisible(true)
        hapticError()
        break
      }
      case "connecting": {
        setVisible(true)
        break
      }
      default:
        break
    }

    previousStatusRef.current = connectionStatus
  }, [connectionStatus, hapticError, light, success])

  if (!visible && connectionStatus === "online") {
    return null
  }

  const style = STATUS_STYLES[connectionStatus]
  const retryCount = connectionInfo?.retryCount ?? 0
  const totalRetries = connectionInfo?.maxRetries ?? retryCount + 1

  let message = connectionInfo?.message ?? style.defaultMessage
  if (connectionStatus === "retrying" && !connectionInfo?.message) {
    message = `Reconnecting… (${Math.min(retryCount + 1, totalRetries)}/${totalRetries})`
  }
  if (connectionStatus === "connecting" && !connectionInfo?.message) {
    message = style.defaultMessage
  }

  const shouldRender = visible || connectionStatus !== "online"
  if (!shouldRender) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-[1000] flex -translate-x-1/2 transition-transform duration-200"
    >
      <div
        className={`${style.bg} shadow-lg backdrop-blur-sm rounded-full px-4 md:px-5 py-2 md:py-2.5 flex items-center gap-2 text-xs md:text-sm font-medium`}
      >
        {statusIcon(connectionStatus)}
        <span>{message}</span>
      </div>
    </div>
  )
}
