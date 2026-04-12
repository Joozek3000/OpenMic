import type { GeoLocation } from "@/lib/types"

export function distanceKm(a: GeoLocation, b: GeoLocation) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const earthKm = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const arc = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
  return earthKm * arc
}

export function formatDistance(distance: number) {
  if (!Number.isFinite(distance)) return "Unknown distance"
  if (distance < 1) return `${Math.round(distance * 1000)} m away`
  if (distance < 10) return `${distance.toFixed(1)} km away`
  return `${Math.round(distance)} km away`
}

export function parseLatLngQuery(query: string): GeoLocation | null {
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
