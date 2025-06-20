import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center gap-4 bg-black text-white">
      <h1 className="text-2xl">Welcome to OpenMic</h1>
      <Link href="/upload">
        <Button>Upload a Video</Button>
      </Link>
      <Link href="/feed">
        <Button variant="secondary">View Feed</Button>
      </Link>
    </main>
  )
}
