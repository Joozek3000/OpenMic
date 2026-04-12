"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"

import { MapBottomSheet, type BottomSheetState } from "@/components/map-bottom-sheet"
import { MapCanvas } from "@/components/map/map-canvas"
import { MapSidebar } from "@/components/map/map-sidebar"
import type { MapFeatureCollection } from "@/components/map/map-types"
import { loadMapEntities } from "@/lib/data/map"
import { distanceKm, formatDistance, parseLatLngQuery } from "@/lib/map-utils"
import type { GeoLocation, MapEntity, MapFilters } from "@/lib/types"
import { useToast } from "@/components/toast-provider"
import { useHapticFeedback } from "@/hooks/use-haptic-feedback"

const FALLBACK_BY_TIMEZONE: Array<{ match: string; location: GeoLocation }> = [
  { match: "Europe/London", location: { lat: 51.5072, lng: -0.1276 } },
  { match: "Europe", location: { lat: 50.1109, lng: 8.6821 } },
  { match: "America/New_York", location: { lat: 40.7128, lng: -74.006 } },
  { match: "America/Chicago", location: { lat: 41.8781, lng: -87.6298 } },
  { match: "America/Denver", location: { lat: 39.7392, lng: -104.9903 } },
  { match: "America/Los_Angeles", location: { lat: 34.0522, lng: -118.2437 } },
]
const DEFAULT_FALLBACK_CITY: GeoLocation = { lat: 51.5072, lng: -0.1276 }
const LAST_KNOWN_LOCATION_KEY = "openmic:last-location"
const SEARCH_LOCATION_HINTS: Record<string, GeoLocation> = {
  london: { lat: 51.5072, lng: -0.1276 },
  "new york": { lat: 40.7128, lng: -74.006 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  birmingham: { lat: 52.4862, lng: -1.8904 },
  liverpool: { lat: 53.4084, lng: -2.9916 },
  bristol: { lat: 51.4545, lng: -2.5879 },
  leeds: { lat: 53.8008, lng: -1.5491 },
  glasgow: { lat: 55.8642, lng: -4.2518 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
}

type QuickTimeFilter = "all" | "tonight" | "week"

// Tweak these defaults to adjust behavior without rewriting map logic.
const MAP_DEFAULTS = {
  zoom: 10,
  searchZoom: 12,
  focusZoom: 13,
  locationZoom: 11,
  panDebounceMs: 300,
  defaultRadiusKm: 30,
  nearbyRadiusKm: 5,
}

function resolveInitialCenter() {
  if (typeof window === "undefined") return DEFAULT_FALLBACK_CITY
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
  const match = FALLBACK_BY_TIMEZONE.find((entry) => timezone.includes(entry.match))
  return match?.location ?? DEFAULT_FALLBACK_CITY
}

function getEntityTitle(entity: MapEntity) {
  if (entity.entityType === "event") return entity.title
  if (entity.entityType === "venue") return entity.name
  if (entity.entityType === "comedian") return entity.displayName
  return entity.title ?? "Video"
}

function getEntitySubtitle(entity: MapEntity) {
  if (entity.entityType === "event") return entity.description
  if (entity.entityType === "venue") return entity.description
  if (entity.entityType === "comedian") return "Comedian"
  return "Tagged video clip"
}

function getEntityInfoLine(entity: MapEntity) {
  if (entity.entityType === "event") {
    const dateLabel = entity.startTime
      ? new Date(entity.startTime.toMillis()).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Time TBA"
    const priceLabel = entity.isFree === true ? "Free" : entity.isFree === false ? "Paid" : null
    return priceLabel ? `${dateLabel} · ${priceLabel}` : dateLabel
  }
  if (entity.entityType === "venue") {
    return entity.address ?? "Venue details"
  }
  if (entity.entityType === "comedian") {
    return "Comedian profile"
  }
  if (entity.timestamp) {
    return new Date(entity.timestamp.toMillis()).toLocaleDateString()
  }
  return "Stand-up clip"
}

function resolveSearchLocation(query: string): GeoLocation | null {
  const parsed = parseLatLngQuery(query)
  if (parsed) return parsed

  const normalized = query.trim().toLowerCase()
  if (!normalized) return null
  const direct = SEARCH_LOCATION_HINTS[normalized]
  if (direct) return direct

  const partial = Object.entries(SEARCH_LOCATION_HINTS).find(([key]) => normalized.includes(key))
  return partial?.[1] ?? null
}

function matchesEntityQuery(entity: MapEntity, q: string) {
  if (entity.entityType === "event") {
    return entity.title.toLowerCase().includes(q) || entity.description.toLowerCase().includes(q)
  }
  if (entity.entityType === "venue") {
    return (
      entity.name.toLowerCase().includes(q) ||
      entity.description.toLowerCase().includes(q) ||
      (entity.address ?? "").toLowerCase().includes(q)
    )
  }
  if (entity.entityType === "comedian") {
    return entity.displayName.toLowerCase().includes(q)
  }
  return (entity.title ?? "").toLowerCase().includes(q) || entity.videoId.toLowerCase().includes(q)
}

interface MapPageProps {
  onSelectPost: (postId: string) => void
}

export default function MapPage({ onSelectPost }: MapPageProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const haptic = useHapticFeedback()
  // Ref mirror avoids stale closures in callbacks passed deep into the map canvas.
  const entityByIdRef = useRef<Map<string, MapEntity>>(new Map())

  // Viewport state used by map rendering and data-query center.
  const [center, setCenter] = useState<GeoLocation>(resolveInitialCenter)
  const [zoom, setZoom] = useState(MAP_DEFAULTS.zoom)
  const [queryCenter, setQueryCenter] = useState<GeoLocation>(resolveInitialCenter)
  // Async/loading state for map entity fetches.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [entities, setEntities] = useState<MapEntity[]>([])
  // Selected entity drives both marker highlight and details panel/sheet.
  const [selectedEntity, setSelectedEntity] = useState<MapEntity | null>(null)
  const [sheetState, setSheetState] = useState<BottomSheetState>("half")
  // Search/filter controls shown in sidebar.
  const [searchQuery, setSearchQuery] = useState("")
  const [locating, setLocating] = useState(false)
  const [searchingLocation, setSearchingLocation] = useState(false)
  const [quickTimeFilter, setQuickTimeFilter] = useState<QuickTimeFilter>("all")
  const [onlyFreeEvents, setOnlyFreeEvents] = useState(false)
  const [onlyNearby, setOnlyNearby] = useState(false)

  const [filters, setFilters] = useState<MapFilters>({
    showEvents: true,
    showVenues: true,
    showComedians: true,
    showVideos: true,
    radiusKm: MAP_DEFAULTS.defaultRadiusKm,
  })

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const selectedEntityId = selectedEntity?.id ?? null

  const quickFilteredEntities = useMemo(() => {
    // These date cutoffs power "Tonight" / "This week" chips for events only.
    const now = new Date()
    const tonightEnd = new Date(now)
    tonightEnd.setHours(23, 59, 59, 999)

    const weekEnd = new Date(now)
    weekEnd.setDate(weekEnd.getDate() + 7)
    weekEnd.setHours(23, 59, 59, 999)

    return entities.filter((entity) => {
      if (entity.entityType !== "event") return true
      if (onlyFreeEvents && entity.isFree !== true) return false
      if (quickTimeFilter === "all") return true
      if (!entity.startTime) return false

      const start = new Date(entity.startTime.toMillis())
      if (quickTimeFilter === "tonight") return start >= now && start <= tonightEnd
      return start >= now && start <= weekEnd
    })
  }, [entities, onlyFreeEvents, quickTimeFilter])

  const filteredBySearch = useMemo(() => {
    // Text query applies after quick filters so chips and search combine naturally.
    const q = searchQuery.trim().toLowerCase()
    if (!q) return quickFilteredEntities
    return quickFilteredEntities.filter((entity) => matchesEntityQuery(entity, q))
  }, [quickFilteredEntities, searchQuery])

  const entityById = useMemo(() => {
    // O(1) lookup for "marker clicked" -> entity object.
    const index = new Map<string, MapEntity>()
    filteredBySearch.forEach((entity) => index.set(entity.id, entity))
    return index
  }, [filteredBySearch])

  useEffect(() => {
    // Keep ref synchronized for callback consumers that should not re-render.
    entityByIdRef.current = entityById
  }, [entityById])

  const geoJsonData = useMemo<MapFeatureCollection>(
    () => ({
      // Convert app entities into map-friendly GeoJSON features.
      type: "FeatureCollection",
      features: filteredBySearch.map((entity) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [entity.geoLocation.lng, entity.geoLocation.lat],
        },
        properties: {
          id: entity.id,
          entityType: entity.entityType,
          isSelected: selectedEntityId === entity.id,
        },
      })),
    }),
    [filteredBySearch, selectedEntityId],
  )

  const centerMap = useCallback((target: GeoLocation, targetZoom = MAP_DEFAULTS.zoom) => {
    // Keep visual map center and query center aligned for intentional jumps (search/select/geolocation).
    setCenter(target)
    setQueryCenter(target)
    setZoom(targetZoom)
  }, [])

  // Marker/list selection behavior lives here so side panel and map clicks stay consistent.
  const focusEntity = useCallback(
    (entity: MapEntity, targetZoom = MAP_DEFAULTS.focusZoom) => {
      centerMap(entity.geoLocation, targetZoom)
      setSelectedEntity(entity)
      setSheetState("half")
      haptic.light()
    },
    [centerMap, haptic],
  )

  const handleOpenEntity = useCallback(
    (entity: MapEntity) => {
      // One entrypoint for navigation preserves consistent behavior across sidebar/sheet actions.
      haptic.light()
      if (entity.entityType === "video") {
        onSelectPost(entity.videoId)
        return
      }
      if (entity.entityType === "event") {
        router.push(`/events/${entity.id}` as Route)
        return
      }
      if (entity.entityType === "venue") {
        router.push(`/venues/${entity.id}` as Route)
        return
      }
      router.push(`/comedians/${entity.id}` as Route)
    },
    [haptic, onSelectPost, router],
  )

  const requestLocation = useCallback(
    (options?: { silent?: boolean }) => {
      if (!navigator.geolocation) {
        if (!options?.silent) showToast("Location is not supported in this browser.", "info")
        return
      }

      setLocating(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocating(false)
          const target = { lat: position.coords.latitude, lng: position.coords.longitude }
          // Persist last successful location so returning users get a better initial view.
          localStorage.setItem(LAST_KNOWN_LOCATION_KEY, JSON.stringify(target))
          centerMap(target, MAP_DEFAULTS.locationZoom)
        },
        () => {
          setLocating(false)
          if (!options?.silent) showToast("Location permission denied. Using fallback city.", "info")
        },
        { enableHighAccuracy: true, timeout: 7000 },
      )
    },
    [centerMap, showToast],
  )

  useEffect(() => {
    // Boot flow: restore prior center, then try precise geolocation in background.
    const stored = localStorage.getItem(LAST_KNOWN_LOCATION_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<GeoLocation>
        if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number") {
          centerMap({ lat: parsed.lat, lng: parsed.lng }, MAP_DEFAULTS.locationZoom)
        }
      } catch {
        localStorage.removeItem(LAST_KNOWN_LOCATION_KEY)
      }
    }

    requestLocation({ silent: true })
  }, [centerMap, requestLocation])

  useEffect(() => {
    // Debounce map drags to avoid re-querying entities on every pixel movement.
    const timeout = window.setTimeout(() => setQueryCenter(center), MAP_DEFAULTS.panDebounceMs)
    return () => window.clearTimeout(timeout)
  }, [center])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    // Data fetches are tied to debounced queryCenter, not raw pan position, to keep map interactions smooth.
    void loadMapEntities({ center: queryCenter, filters })
      .then((next) => {
        if (cancelled) return
        setEntities(next)
        setLoading(false)
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error("Failed to load map entities", loadError)
        setError("Unable to load map data.")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [queryCenter, filters])

  useEffect(() => {
    // Clear stale selection if it no longer matches active filters/search results.
    if (!selectedEntityId) return
    if (!filteredBySearch.some((entity) => entity.id === selectedEntityId)) {
      setSelectedEntity(null)
    }
  }, [filteredBySearch, selectedEntityId])

  const entitiesByDistance = useMemo(
    () =>
      filteredBySearch
        .map((entity) => ({ entity, distance: distanceKm(center, entity.geoLocation) }))
        .sort((a, b) => a.distance - b.distance),
    [center, filteredBySearch],
  )
  const searchResults = useMemo(() => entitiesByDistance.slice(0, 8).map((entry) => entry.entity), [entitiesByDistance])
  const distanceLabelByEntityId = useMemo(() => {
    const labels = new Map<string, string>()
    entitiesByDistance.forEach(({ entity, distance }) => labels.set(entity.id, formatDistance(distance)))
    return labels
  }, [entitiesByDistance])
  const selectedEntityTitle = selectedEntity ? getEntityTitle(selectedEntity) : null
  const selectedEntitySubtitle = selectedEntity ? getEntitySubtitle(selectedEntity) : null
  const selectedEntityInfoLine = selectedEntity ? getEntityInfoLine(selectedEntity) : null
  const selectedEntityDistance = selectedEntity ? distanceLabelByEntityId.get(selectedEntity.id) ?? null : null

  const handleSearchSubmit = useCallback(async () => {
    // Search order: exact local entity match -> geocode location -> fallback local result.
    const query = searchQuery.trim()
    if (!query) return

    const normalizedQuery = query.toLowerCase()
    const exactEntity = filteredBySearch.find((entity) => getEntityTitle(entity).toLowerCase() === normalizedQuery)
    if (exactEntity) {
      focusEntity(exactEntity)
      return
    }

    const hintedLocation = resolveSearchLocation(query)
    if (hintedLocation) {
      centerMap(hintedLocation, MAP_DEFAULTS.searchZoom)
      setSelectedEntity(null)
      return
    }

    if (!mapboxToken) {
      if (searchResults.length > 0) {
        focusEntity(searchResults[0], MAP_DEFAULTS.searchZoom)
      } else {
        showToast("No matches in this area. Try a city name, coordinates, or Use my location.", "info")
      }
      return
    }

    setSearchingLocation(true)
    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=1&types=place,locality,neighborhood,address,postcode,country,region`
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(`Geocoding failed with status ${response.status}`)
      const payload = (await response.json()) as { features?: Array<{ center?: [number, number] }> }
      const coords = payload.features?.[0]?.center
      if (coords && coords.length === 2) {
        // Geocoder center format is [lng, lat].
        centerMap({ lat: coords[1], lng: coords[0] }, MAP_DEFAULTS.searchZoom)
        setSelectedEntity(null)
        return
      }

      if (searchResults.length > 0) {
        focusEntity(searchResults[0], MAP_DEFAULTS.searchZoom)
      } else {
        showToast("No matches in this area. Try a broader query or Use my location.", "info")
      }
    } catch (geocodeError) {
      console.error("Failed to geocode search query", geocodeError)
      if (searchResults.length > 0) {
        focusEntity(searchResults[0], MAP_DEFAULTS.searchZoom)
      } else {
        showToast("Search service unavailable. Try another location name or coordinates (lat,lng).", "error")
      }
    } finally {
      setSearchingLocation(false)
    }
  }, [centerMap, filteredBySearch, focusEntity, mapboxToken, searchQuery, searchResults, showToast])

  const handleSelectEntityById = useCallback(
    (id: string) => {
      // Canvas passes marker ids only; resolve to full entity data through ref index.
      const entity = entityByIdRef.current.get(id)
      if (!entity) return
      focusEntity(entity)
    },
    [focusEntity],
  )

  // Keep callback stable so MapCanvas doesn't reinitialize the map instance.
  const handleViewportChange = useCallback((next: { center: GeoLocation; zoom: number }) => {
    setCenter(next.center)
    setZoom(next.zoom)
  }, [])

  return (
    <div className="h-full w-full bg-black text-white lg:flex">
      <MapSidebar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={() => {
          void handleSearchSubmit()
        }}
        searchingLocation={searchingLocation}
        locating={locating}
        onRequestLocation={() => requestLocation()}
        quickTimeFilter={quickTimeFilter}
        onToggleTonight={() => setQuickTimeFilter((current) => (current === "tonight" ? "all" : "tonight"))}
        onToggleWeek={() => setQuickTimeFilter((current) => (current === "week" ? "all" : "week"))}
        onlyFreeEvents={onlyFreeEvents}
        onToggleFreeEvents={() => setOnlyFreeEvents((value) => !value)}
        onlyNearby={onlyNearby}
        onToggleNearby={() => {
          const next = !onlyNearby
          setOnlyNearby(next)
          // "Nearby" is implemented as a preset radius shortcut.
          setFilters((current) => ({
            ...current,
            radiusKm: next ? MAP_DEFAULTS.nearbyRadiusKm : MAP_DEFAULTS.defaultRadiusKm,
          }))
        }}
        filters={filters}
        onToggleFilter={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
        onRadiusChange={(nextRadius) => {
          setFilters((current) => ({ ...current, radiusKm: nextRadius }))
          setOnlyNearby(nextRadius === MAP_DEFAULTS.nearbyRadiusKm)
        }}
        searchResults={searchResults}
        selectedEntityId={selectedEntityId}
        onSelectEntity={focusEntity}
        selectedEntity={selectedEntity}
        selectedEntityTitle={selectedEntityTitle}
        selectedEntitySubtitle={selectedEntitySubtitle}
        selectedEntityInfoLine={selectedEntityInfoLine}
        selectedEntityDistance={selectedEntityDistance}
        onOpenSelected={() => {
          if (selectedEntity) handleOpenEntity(selectedEntity)
        }}
        getEntityTitle={getEntityTitle}
        getEntityInfoLine={getEntityInfoLine}
        getEntityDistance={(entity) => distanceLabelByEntityId.get(entity.id) ?? formatDistance(distanceKm(center, entity.geoLocation))}
      />

      <MapCanvas
        mapboxToken={mapboxToken}
        center={center}
        zoom={zoom}
        geoJsonData={geoJsonData}
        onViewportChange={handleViewportChange}
        onSelectEntity={handleSelectEntityById}
        loading={loading}
        error={error}
      />

      <div className="lg:hidden">
        <MapBottomSheet
          entity={selectedEntity}
          distanceLabel={selectedEntityDistance}
          infoLine={selectedEntityInfoLine}
          state={sheetState}
          onStateChange={setSheetState}
          onOpenEntity={handleOpenEntity}
        />
      </div>
    </div>
  )
}
