import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"

import { AppProviders } from "@/components/app-providers"
import { SkipLink } from "@/components/skip-link"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "OpenMic - Share Your Voice",
  description: "A social video-sharing platform for creative expression",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SkipLink />
        <div className="min-h-screen bg-black text-white">
          <main id="main-content" tabIndex={-1}>
            <AppProviders>{children}</AppProviders>
          </main>
        </div>
      </body>
    </html>
  )
}
