"use client"

import { LocateFixed, Search } from "lucide-react"

import type { MapEntity, MapFilters } from "@/lib/types"

interface MapSidebarProps {
  searchQuery: string
  setSearchQuery: (value: string) => void
  onSearchSubmit: () => void
  searchingLocation: boolean
  locating: boolean
  onRequestLocation: () => void
  quickTimeFilter: "all" | "tonight" | "week"
  onToggleTonight: () => void
  onToggleWeek: () => void
  onlyFreeEvents: boolean
  onToggleFreeEvents: () => void
  onlyNearby: boolean
  onToggleNearby: () => void
  filters: MapFilters
  onToggleFilter: (key: keyof Pick<MapFilters, "showEvents" | "showVenues" | "showComedians" | "showVideos">) => void
  onRadiusChange: (radiusKm: number) => void
  searchResults: MapEntity[]
  selectedEntityId: string | null
  onSelectEntity: (entity: MapEntity) => void
  selectedEntity: MapEntity | null
  selectedEntityTitle: string | null
  selectedEntitySubtitle: string | null
  selectedEntityInfoLine: string | null
  selectedEntityDistance: string | null
  onOpenSelected: () => void
  getEntityTitle: (entity: MapEntity) => string
  getEntityInfoLine: (entity: MapEntity) => string
  getEntityDistance: (entity: MapEntity) => string
}

export function MapSidebar({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  searchingLocation,
  locating,
  onRequestLocation,
  quickTimeFilter,
  onToggleTonight,
  onToggleWeek,
  onlyFreeEvents,
  onToggleFreeEvents,
  onlyNearby,
  onToggleNearby,
  filters,
  onToggleFilter,
  onRadiusChange,
  searchResults,
  selectedEntityId,
  onSelectEntity,
  selectedEntity,
  selectedEntityTitle,
  selectedEntitySubtitle,
  selectedEntityInfoLine,
  selectedEntityDistance,
  onOpenSelected,
  getEntityTitle,
  getEntityInfoLine,
  getEntityDistance,
}: MapSidebarProps) {
  return (
    // Desktop: pinned left column. Mobile: top controls stacked above map canvas.
    <aside className="z-20 w-full border-b border-white/10 bg-black/95 p-3 shadow-xl lg:h-full lg:w-[380px] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4">
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
          {/* Search input is shared for both text filtering and geocode submit. */}
          <div className="mb-2 flex items-center gap-2">
            <Search size={16} className="text-gray-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Prevent form-like submit behavior and route Enter into map search.
                  event.preventDefault()
                  onSearchSubmit()
                }
              }}
              placeholder="Search city, venue, event, comedian..."
              className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestLocation}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-gray-200 focus-visible-ring"
            >
              <LocateFixed size={14} />
              {locating ? "Locating..." : "Use my location"}
            </button>
            <button
              type="button"
              onClick={onSearchSubmit}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 focus-visible-ring"
            >
              {searchingLocation ? "Searching..." : "Go"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
          {/* Quick filters are intended as high-level UX levers.
              Add/remove chips here without touching backend query code. */}
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={onToggleTonight}
              className={`rounded-full border px-3 py-1 focus-visible-ring ${quickTimeFilter === "tonight" ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-gray-200"}`}
            >
              Tonight
            </button>
            <button
              type="button"
              onClick={onToggleWeek}
              className={`rounded-full border px-3 py-1 focus-visible-ring ${quickTimeFilter === "week" ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-gray-200"}`}
            >
              This week
            </button>
            <button
              type="button"
              onClick={onToggleFreeEvents}
              className={`rounded-full border px-3 py-1 focus-visible-ring ${onlyFreeEvents ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-gray-200"}`}
            >
              Free events
            </button>
            <button
              type="button"
              onClick={onToggleNearby}
              className={`rounded-full border px-3 py-1 focus-visible-ring ${onlyNearby ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-gray-200"}`}
            >
              Under 5km
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            {/* Core entity visibility toggles for map categories. */}
            {[
              ["showEvents", "Events"],
              ["showVenues", "Venues"],
              ["showComedians", "Comedians"],
              ["showVideos", "Videos"],
            ].map(([key, label]) => {
              const typedKey = key as keyof Pick<MapFilters, "showEvents" | "showVenues" | "showComedians" | "showVideos">
              const enabled = filters[typedKey]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onToggleFilter(typedKey)}
                  className={`rounded-full border px-3 py-1 focus-visible-ring ${enabled ? "border-white bg-white text-black" : "border-white/20 bg-white/5 text-gray-200"}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-300">
            Radius
            <select
              value={filters.radiusKm}
              // Radius update controls server-side "nearby" query scope.
              onChange={(event) => onRadiusChange(Number(event.target.value))}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs text-white"
            >
              {[5, 10, 25, 50, 100].map((value) => (
                <option key={value} value={value}>
                  {value}km
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Results</p>
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {searchResults.length === 0 ? (
              <div className="space-y-2 px-2 py-2 text-sm text-gray-400">
                <p>No map matches in this area.</p>
                <p className="text-xs text-gray-500">Try a broader radius, another city, or use your location.</p>
              </div>
            ) : (
              // Results are capped upstream; this list is for quick jumps, not full pagination.
              searchResults.map((entity) => (
                <button
                  key={entity.id}
                  type="button"
                  className={`block w-full rounded-lg border px-2 py-2 text-left text-sm focus-visible-ring ${
                    selectedEntityId === entity.id
                      ? "border-white/20 bg-white/15"
                      : "border-transparent hover:border-white/10 hover:bg-white/10"
                  }`}
                  onClick={() => onSelectEntity(entity)}
                >
                  <p className="font-semibold text-white">{getEntityTitle(entity)}</p>
                  <p className="text-xs uppercase text-gray-400">{entity.entityType}</p>
                  <p className="mt-1 text-xs text-gray-300">{getEntityInfoLine(entity)}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{getEntityDistance(entity)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Selected</p>
          {selectedEntity && selectedEntityTitle ? (
            <div className="mt-2 space-y-2">
              <p className="text-base font-semibold text-white">{selectedEntityTitle}</p>
              <p className="text-sm text-gray-300">{selectedEntitySubtitle}</p>
              {selectedEntityInfoLine && <p className="text-xs text-gray-300">{selectedEntityInfoLine}</p>}
              {selectedEntityDistance && <p className="text-xs text-gray-400">{selectedEntityDistance}</p>}
              <p className="text-xs text-gray-400">
                {selectedEntity.geoLocation.lat.toFixed(4)}, {selectedEntity.geoLocation.lng.toFixed(4)}
              </p>
              <button
                type="button"
                onClick={onOpenSelected}
                className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-gray-200 focus-visible-ring"
              >
                Open details
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Tap a map marker or search result to preview details.</p>
          )}
        </div>
      </div>
    </aside>
  )
}
