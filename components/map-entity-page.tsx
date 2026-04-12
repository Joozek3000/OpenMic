"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react"
import Link from "next/link"

import { getMapEntityById } from "@/lib/data/map"
import type { MapEntity, MapEntityType } from "@/lib/types"

interface MapEntityPageProps {
  entityType: MapEntityType
  id: string
}

function entityTitle(entity: MapEntity) {
  if (entity.entityType === "event") return entity.title
  if (entity.entityType === "venue") return entity.name
  if (entity.entityType === "comedian") return entity.displayName
  return entity.title ?? `Video ${entity.videoId}`
}

function entityDescription(entity: MapEntity) {
  if (entity.entityType === "event") return entity.description
  if (entity.entityType === "venue") return entity.description
  if (entity.entityType === "comedian") return "Comedian profile preview."
  return "Location-tagged stand-up clip."
}

export function MapEntityPage({ entityType, id }: MapEntityPageProps) {
  const [entity, setEntity] = useState<MapEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void getMapEntityById(entityType, id)
      .then((result) => {
        if (cancelled) return
        if (!result) {
          setError("Item not found.")
          setLoading(false)
          return
        }
        setEntity(result)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error("Failed to load map entity", loadError)
        setError("Unable to load this page.")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [entityType, id])

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm focus-visible-ring">
          <ArrowLeft size={16} />
          Back to map
        </Link>
        {loading ? (
          <p className="text-gray-300">Loading...</p>
        ) : error || !entity ? (
          <p className="text-red-300">{error ?? "Unable to load item."}</p>
        ) : (
          <article className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-wide text-gray-400">{entity.entityType}</p>
            <h1 className="text-3xl font-bold">{entityTitle(entity)}</h1>
            <p className="text-gray-300">{entityDescription(entity)}</p>
            <p className="inline-flex items-center gap-2 text-sm text-gray-300">
              <MapPin size={14} />
              {entity.geoLocation.lat.toFixed(4)}, {entity.geoLocation.lng.toFixed(4)}
            </p>
            {entity.entityType === "event" && entity.startTime && (
              <p className="inline-flex items-center gap-2 text-sm text-gray-300">
                <CalendarDays size={14} />
                {new Date(entity.startTime.toMillis()).toLocaleString()}
              </p>
            )}
          </article>
        )}
      </div>
    </main>
  )
}
