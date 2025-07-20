import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Home/Landing page component
 * - Simple welcome screen with app branding
 * - Quick action buttons to main features (Upload & Feed)
 * - Mobile-first centered layout
 */
export default function Home() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-4 bg-black text-white" style={{backgroundColor: '#000000', color: '#ffffff'}}>
      {/* App title and branding */}
      <h1 className="text-2xl">Welcome to OpenMic</h1>
      
      {/* Quick navigation to key features */}
      <Link href="/upload">
        <Button>Upload a Video</Button>
      </Link>
      <Link href="/feed">
        <Button variant="secondary">View Feed</Button>
      </Link>
    </main>
  )
}
