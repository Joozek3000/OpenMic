"use client"

import Image from "next/image"
import { CalendarDays, ExternalLink, MapPin, Mic2, Play, User } from "lucide-react"

import type { MapEntity } from "@/lib/types"

export type BottomSheetState = "collapsed" | "half" | "full"

interface MapBottomSheetProps {
  entity: MapEntity | null
  distanceLabel?: string | null
  infoLine?: string | null
  state: BottomSheetState
  onStateChange: (state: BottomSheetState) => void
  onOpenEntity: (entity: MapEntity) => void
}

const STATE_CLASS: Record<BottomSheetState, string> = {
  collapsed: "translate-y-[84%]",
  half: "translate-y-[38%]",
  full: "translate-y-0",
}

export function MapBottomSheet({ entity, distanceLabel, infoLine, state, onStateChange, onOpenEntity }: MapBottomSheetProps) {
  // Hidden until an entity is selected from map marker or sidebar list.
  if (!entity) return null

  // Normalize varying entity schemas into one UI shape for the mobile sheet.
  const title =
    entity.entityType === "event"
      ? entity.title
      : entity.entityType === "venue"
        ? entity.name
        : entity.entityType === "comedian"
          ? entity.displayName
          : entity.title ?? "Location video"

  const subtitle =
    entity.entityType === "event"
      ? "Live Event"
      : entity.entityType === "venue"
        ? "Venue"
        : entity.entityType === "comedian"
          ? "Comedian"
          : "Video"

  const image =
    entity.entityType === "event"
      ? entity.coverImage
      : entity.entityType === "venue"
        ? entity.image
        : entity.entityType === "video"
          ? entity.thumbnail
          : entity.profileImage

  return (
    <section
      // translateY class controls collapsed/half/full states.
      className={`absolute inset-x-0 bottom-0 z-30 rounded-t-3xl border border-white/10 bg-black/90 p-4 pb-safe shadow-2xl backdrop-blur transition-transform duration-300 ${STATE_CLASS[state]}`}
      aria-label="Map preview"
    >
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/20" />
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStateChange("collapsed")}
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 focus-visible-ring"
        >
          Peek
        </button>
        <button
          type="button"
          onClick={() => onStateChange("half")}
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 focus-visible-ring"
        >
          Half
        </button>
        <button
          type="button"
          onClick={() => onStateChange("full")}
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 focus-visible-ring"
        >
          Full
        </button>
      </div>

      <div className="flex gap-3">
        <div className="relative h-16 w-16 flex-none overflow-hidden rounded-xl bg-gray-800">
          {image ? (
            <Image src={image} alt={title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">
              <MapPin size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-gray-400">{subtitle}</p>
          <h3 className="truncate text-lg font-semibold text-white">{title}</h3>
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-300">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {entity.geoLocation.lat.toFixed(3)}, {entity.geoLocation.lng.toFixed(3)}
            </span>
            {entity.entityType === "event" && entity.startTime && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} />
                {new Date(entity.startTime.toMillis()).toLocaleDateString()}
              </span>
            )}
          </div>
          {infoLine && <p className="mt-1 text-xs text-gray-300">{infoLine}</p>}
          {distanceLabel && <p className="mt-1 text-xs text-gray-400">{distanceLabel}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onOpenEntity(entity)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black focus-visible-ring"
        >
          {entity.entityType === "video" ? <Play size={16} /> : entity.entityType === "comedian" ? <User size={16} /> : <ExternalLink size={16} />}
          Open
        </button>
        {entity.entityType === "event" && entity.ticketUrl ? (
          // Events can expose direct ticket links; other entity types use in-app details.
          <a
            href={entity.ticketUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white focus-visible-ring"
          >
            <ExternalLink size={16} />
            Tickets
          </a>
        ) : (
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white focus-visible-ring"
            onClick={() => onStateChange(state === "full" ? "half" : "full")}
          >
            <Mic2 size={16} />
            Details
          </button>
        )}
      </div>
    </section>
  )
}
