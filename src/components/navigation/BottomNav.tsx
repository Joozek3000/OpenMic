"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Compass, Home, Plus, Search, UserRound } from "lucide-react"

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/upload", label: "", icon: Plus, emphasis: true },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="pointer-events-auto w-full">
      <ul className="mx-auto flex w-full max-w-xl items-center justify-between rounded-[28px] bg-black/85 px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 shadow-[0_18px_40px_rgba(0,0,0,0.55)] backdrop-blur">
        {items.map(({ href, label, icon: Icon, emphasis }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href)

          if (emphasis) {
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  className="flex h-14 w-14 -translate-y-5 items-center justify-center rounded-full bg-white text-black shadow-[0_18px_40px_rgba(0,0,0,0.5)] transition hover:bg-white/90"
                  aria-label="Upload"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </li>
            )
          }

          return (
            <li key={href} className="flex flex-1 justify-center">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 transition ${
                  isActive ? "text-white" : "text-white/55 hover:text-white/80"
                }`}
              >
                <Icon className="h-6 w-6" />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
