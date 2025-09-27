"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { clsx } from "clsx"
import { CirclePlus, Compass, Home, Search, User } from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { href: "/feed", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/upload", label: "Add", icon: CirclePlus },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/profile", label: "Profile", icon: User },
]

const linkBaseClasses =
  "rounded-xl px-3 py-2 text-xs font-semibold flex flex-col items-center justify-center hover:bg-white/10 transition"

export default function AppNav() {
  const pathname = usePathname()
  const isFeed = pathname === "/" || pathname === "/feed"

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 flex justify-center backdrop-blur lg:hidden",
          isFeed
            ? "border-t border-white/20 bg-black/60 text-white"
            : "border-t border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
        )}
      >
        <div className="flex w-full max-w-xl items-center justify-around px-4 py-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  linkBaseClasses,
                  isActive && "bg-white text-black shadow"
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-[10px]">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Desktop sidebar nav */}
      <nav
        className={clsx(
          "fixed left-0 top-0 z-40 hidden h-full w-20 flex-col items-center py-10 backdrop-blur lg:flex",
          isFeed
            ? "border-r border-white/20 bg-black/60 text-white"
            : "border-r border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]"
        )}
      >
        <div className="flex flex-col items-center gap-6">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  linkBaseClasses,
                  "w-full text-center",
                  isActive && "bg-white text-black shadow"
                )}
              >
                <Icon className="h-6 w-6 mx-auto" />
                <span className="text-[10px]">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
