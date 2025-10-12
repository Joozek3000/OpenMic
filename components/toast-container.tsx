"use client"

import { X, CheckCircle, Info, XCircle } from "lucide-react"

import type { Toast, ToastVariant } from "@/lib/types"

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed top-6 left-1/2 z-[100] w-full max-w-sm -translate-x-1/2 px-4">
      <div className="flex flex-col gap-3">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        ))}
      </div>
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { variant, message } = toast

  const baseStyles = "pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg transition-shadow hover:shadow-xl animate-in slide-in-from-top-5 fade-in duration-300"

  const variantStyles: Record<ToastVariant, string> = {
    success: "bg-emerald-600/95 text-white",
    error: "bg-red-600/95 text-white",
    info: "bg-blue-600/95 text-white",
  }

  const icon: Record<ToastVariant, JSX.Element> = {
    success: <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />,
    error: <XCircle size={18} className="mt-0.5 flex-shrink-0" />,
    info: <Info size={18} className="mt-0.5 flex-shrink-0" />,
  }

  return (
    <div className={`${baseStyles} ${variantStyles[variant]}`} role="status">
      {icon[variant]}
      <p className="flex-1 text-sm leading-snug">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-full p-1 text-white/80 transition-colors hover:text-white"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  )
}
