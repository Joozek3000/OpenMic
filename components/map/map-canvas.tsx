"use client"

import { useEffect, useRef } from "react"
import type { Map as MapboxMap, MapLayerMouseEvent } from "mapbox-gl"

import type { GeoLocation } from "@/lib/types"
import { EMPTY_FEATURE_COLLECTION, isGeoJsonSource, type MapFeatureCollection } from "@/components/map/map-types"

const MAP_SOURCE_ID = "openmic-entities"

interface MapCanvasProps {
  mapboxToken?: string
  center: GeoLocation
  zoom: number
  geoJsonData: MapFeatureCollection
  onViewportChange: (next: { center: GeoLocation; zoom: number }) => void
  onSelectEntity: (id: string) => void
  loading: boolean
  error: string | null
}

export function MapCanvas({ mapboxToken, center, zoom, geoJsonData, onViewportChange, onSelectEntity, loading, error }: MapCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  // Ref mirrors keep latest values available to map event handlers without re-creating map instance.
  const centerRef = useRef<GeoLocation>(center)
  const zoomRef = useRef<number>(zoom)
  const geoJsonRef = useRef<MapFeatureCollection>(EMPTY_FEATURE_COLLECTION)

  useEffect(() => {
    centerRef.current = center
  }, [center])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    geoJsonRef.current = geoJsonData
  }, [geoJsonData])

  useEffect(() => {
    // One-time map initialization. Guard clauses prevent duplicate instances.
    if (!mapboxToken || !mapContainerRef.current || mapRef.current) return

    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    const handleWindowResize = () => {
      mapRef.current?.resize()
    }

    void import("mapbox-gl").then((module) => {
      if (cancelled || !mapContainerRef.current) return
      const mapboxgl = module.default
      mapboxgl.accessToken = mapboxToken

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        // Tweak map look without affecting interaction behavior.
        style: "mapbox://styles/mapbox/dark-v11",
        center: [centerRef.current.lng, centerRef.current.lat],
        zoom: zoomRef.current,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right")

      map.on("moveend", () => {
        // Lift viewport back to parent so filters/fetching can respond to map movement.
        const mapCenter = map.getCenter()
        onViewportChange({ center: { lat: mapCenter.lat, lng: mapCenter.lng }, zoom: map.getZoom() })
      })

      map.on("load", () => {
        // Data source ID is shared with layer definitions below; keep in sync if renamed.
        map.addSource(MAP_SOURCE_ID, {
          type: "geojson",
          data: geoJsonRef.current,
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 12,
        })

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            // Cluster density visuals: tweak size/opacity to change map readability at zoomed-out levels.
            "circle-color": "#f8fafc",
            "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 30, 28],
            "circle-opacity": 0.85,
          },
        })

        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: MAP_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
          paint: { "text-color": "#020617" },
        })

        map.addLayer({
          id: "unclustered-points",
          type: "circle",
          source: MAP_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "entityType"],
              "event",
              "#f97316",
              "venue",
              "#10b981",
              "comedian",
              "#3b82f6",
              "video",
              "#f43f5e",
              "#e5e7eb",
            ],
            "circle-radius": ["case", ["boolean", ["get", "isSelected"], false], 12, 8],
            "circle-stroke-width": ["case", ["boolean", ["get", "isSelected"], false], 2, 1],
            "circle-stroke-color": ["case", ["boolean", ["get", "isSelected"], false], "#ffffff", "#020617"],
          },
        })

        map.on("click", "clusters", (event: MapLayerMouseEvent) => {
          // Clicking a cluster zooms in to reveal contained points.
          const feature = event.features?.[0]
          if (!feature || feature.geometry.type !== "Point") return
          const source = map.getSource(MAP_SOURCE_ID)
          if (!source || !("getClusterExpansionZoom" in source)) return
          const clusterId = Number(feature.properties?.cluster_id)
          if (!Number.isFinite(clusterId)) return
          source.getClusterExpansionZoom(clusterId, (err: unknown, expansionZoom?: number | null) => {
            if (err || typeof expansionZoom !== "number") return
            if (feature.geometry.type !== "Point") return
            const [lng, lat] = feature.geometry.coordinates
            if (typeof lng !== "number" || typeof lat !== "number") return
            map.easeTo({ center: [lng, lat], zoom: expansionZoom })
          })
        })

        map.on("click", "unclustered-points", (event: MapLayerMouseEvent) => {
          // Unclustered markers carry entity id in feature properties.
          const feature = event.features?.[0]
          const id = typeof feature?.properties?.id === "string" ? feature.properties.id : undefined
          if (!id) return
          onSelectEntity(id)
        })
      })

      if (typeof ResizeObserver !== "undefined") {
        // Keep map correctly rendered when parent layout changes size.
        resizeObserver = new ResizeObserver(() => map.resize())
        resizeObserver.observe(mapContainerRef.current)
      }
      window.addEventListener("resize", handleWindowResize)

      mapRef.current = map
    })

    return () => {
      cancelled = true
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener("resize", handleWindowResize)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapboxToken, onSelectEntity, onViewportChange])

  useEffect(() => {
    // Push fresh marker data into existing map source without tearing down map.
    const source = mapRef.current?.getSource(MAP_SOURCE_ID)
    if (!isGeoJsonSource(source)) return
    source.setData(geoJsonData)
  }, [geoJsonData])

  useEffect(() => {
    if (!mapRef.current) return
    // Prevent tiny center jitter from triggering unnecessary flyTo animations.
    const mapCenter = mapRef.current.getCenter()
    const latDiff = Math.abs(mapCenter.lat - center.lat)
    const lngDiff = Math.abs(mapCenter.lng - center.lng)
    const zoomDiff = Math.abs(mapRef.current.getZoom() - zoom)
    if (latDiff < 0.0001 && lngDiff < 0.0001 && zoomDiff < 0.01) return
    mapRef.current.flyTo({ center: [center.lng, center.lat], zoom, essential: true })
  }, [center, zoom])

  return (
    <section className="relative min-h-[52vh] flex-1 lg:min-h-0">
      {mapboxToken ? (
        <div ref={mapContainerRef} className="h-full w-full" />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <div>
            <p className="text-lg font-semibold text-white">Map unavailable</p>
            <p className="mt-2 text-sm text-gray-400">Set `NEXT_PUBLIC_MAPBOX_TOKEN` to enable map rendering.</p>
          </div>
        </div>
      )}

      {(loading || error) && (
        <div className="absolute bottom-3 left-3 z-20 rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs text-gray-100 backdrop-blur">
          {loading ? "Loading map entities..." : error}
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 z-20 hidden rounded-lg border border-white/10 bg-black/70 px-3 py-2 text-xs text-gray-300 backdrop-blur lg:block">
        Drag to explore nearby shows
      </div>
    </section>
  )
}
