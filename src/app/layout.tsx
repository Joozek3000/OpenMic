// app/layout.tsx
import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "OpenMic",
  description: "TikTok-style video feed app",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased overflow-x-hidden">
        <div className="relative min-h-screen pb-32">
          {children}
        </div>
      </body>
    </html>
  )
}
