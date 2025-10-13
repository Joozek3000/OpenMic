"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react"

import ToastContainer from "@/components/toast-container"
import type { Toast, ToastContextValue, ToastVariant } from "@/lib/types"

type ToastAction =
  | {
      type: "ADD"
      toast: Toast
    }
  | {
      type: "REMOVE"
      id: string
    }

function toastReducer(state: Toast[], action: ToastAction): Toast[] {
  switch (action.type) {
    case "ADD":
      return [...state, action.toast]
    case "REMOVE":
      return state.filter((toast) => toast.id !== action.id)
    default:
      return state
  }
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let externalToastApi: Pick<ToastContextValue, "showToast" | "dismissToast"> | null = null

export function showToastExternal(
  message: string,
  variant: ToastVariant = "info",
  options?: { duration?: number },
) {
  return externalToastApi?.showToast(message, variant, options) ?? ""
}

export function dismissToastExternal(id: string) {
  externalToastApi?.dismissToast(id)
}

function generateToastId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3000,
  info: 3000,
  error: 5000,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearToastTimeout = useCallback((id: string) => {
    const timeouts = timeoutRefs.current
    const existing = timeouts.get(id)
    if (existing) {
      clearTimeout(existing)
      timeouts.delete(id)
    }
  }, [])

  const dismissToast = useCallback<ToastContextValue["dismissToast"]>(
    (id) => {
      clearToastTimeout(id)
      dispatch({ type: "REMOVE", id })
    },
    [clearToastTimeout],
  )

  const showToast = useCallback<ToastContextValue["showToast"]>(
    (message, variant = "info", options) => {
      const id = generateToastId()
      const duration = options?.duration ?? DEFAULT_DURATION[variant]
      const toast: Toast = { id, message, variant, duration }

      dispatch({ type: "ADD", toast })

      if (duration && duration > 0) {
        const timeoutId = setTimeout(() => {
          dismissToast(id)
        }, duration)
        timeoutRefs.current.set(id, timeoutId)
      }

      return id
    },
    [dismissToast],
  )

  useEffect(() => {
    const timeouts = timeoutRefs.current
    return () => {
      timeouts.forEach((timeoutId) => clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast,
      dismissToast,
    }),
    [dismissToast, showToast, toasts],
  )

  useEffect(() => {
    externalToastApi = {
      showToast,
      dismissToast,
    }
    return () => {
      if (externalToastApi?.showToast === showToast) {
        externalToastApi = null
      }
    }
  }, [dismissToast, showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
