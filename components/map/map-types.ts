import type { FeatureCollection, Point } from "geojson"
import type { GeoJSONSource } from "mapbox-gl"

import type { MapEntity } from "@/lib/types"

export type MapFeatureProperties = {
  id: string
  entityType: MapEntity["entityType"]
  isSelected: boolean
}

export type MapFeatureCollection = FeatureCollection<Point, MapFeatureProperties>

export const EMPTY_FEATURE_COLLECTION: MapFeatureCollection = {
  type: "FeatureCollection",
  features: [],
}

export function isGeoJsonSource(source: unknown): source is GeoJSONSource {
  return Boolean(source) && typeof (source as GeoJSONSource).setData === "function"
}
