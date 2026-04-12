import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  query,
  type DocumentData,
  type Timestamp,
} from "firebase/firestore"

import { db } from "@/lib/firebase"
import { getMockMapEntityById, MOCK_MAP_ENTITIES } from "@/lib/data/map-mocks"
import { distanceKm } from "@/lib/map-utils"
import type { GeoLocation, MapComedian, MapEntity, MapEvent, MapFilters, MapVenue, MapVideo } from "@/lib/types"

interface LoadMapEntitiesOptions {
  center: GeoLocation
  filters: MapFilters
}

const DEFAULT_FETCH_LIMIT = 120
const CACHE_TTL_MS = 60_000

// Global cache keeps panning/filtering snappy. Tweak TTL for fresher data vs fewer reads.
let entitiesCache: { at: number; entities: MapEntity[] } | null = null

function toGeoLocation(value: unknown): GeoLocation | null {
  // Accept multiple location shapes because legacy docs are not fully normalized yet.
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>

  const lat =
    typeof source.lat === "number"
      ? source.lat
      : typeof source.latitude === "number"
        ? source.latitude
        : null
  const lng =
    typeof source.lng === "number"
      ? source.lng
      : typeof source.longitude === "number"
        ? source.longitude
        : null

  if (lat === null || lng === null) return null
  return { lat, lng }
}

function readTimestamp(value: unknown): Timestamp | null {
  if (!value || typeof value !== "object") return null
  if (typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return value as Timestamp
  }
  return null
}

function withinDateRange(event: MapEvent, dateFrom?: Date, dateTo?: Date) {
  if (!event.startTime) return true
  const millis = event.startTime.toMillis()
  if (dateFrom && millis < dateFrom.getTime()) return false
  if (dateTo && millis > dateTo.getTime()) return false
  return true
}

function passesComedyType(entity: MapEntity, comedyType?: string) {
  if (!comedyType || comedyType === "all") return true
  if (entity.entityType === "venue") {
    return entity.tags.some((tag) => tag.toLowerCase() === comedyType.toLowerCase())
  }
  if (entity.entityType === "event") {
    return (entity.comedyType ?? "").toLowerCase() === comedyType.toLowerCase()
  }
  return true
}

function filterEntities(entities: MapEntity[], center: GeoLocation, filters: MapFilters) {
  return entities.filter((entity) => {
    if (entity.entityType === "event" && !filters.showEvents) return false
    if (entity.entityType === "venue" && !filters.showVenues) return false
    if (entity.entityType === "comedian" && !filters.showComedians) return false
    if (entity.entityType === "video" && !filters.showVideos) return false

    if (distanceKm(center, entity.geoLocation) > filters.radiusKm) return false
    if (!passesComedyType(entity, filters.comedyType)) return false

    if (entity.entityType === "event") {
      return withinDateRange(entity, filters.dateFrom, filters.dateTo)
    }
    return true
  })
}

type MapDoc = { id: string; data: () => DocumentData }

function toMapEvent(docSnap: MapDoc): MapEvent | null {
  const data = docSnap.data()
  const geoLocation = toGeoLocation(data.geoLocation)
  if (!geoLocation) return null
  const isFree =
    typeof data.isFree === "boolean"
      ? data.isFree
      : typeof data.ticketPrice === "number"
        ? data.ticketPrice <= 0
        : typeof data.price === "number"
          ? data.price <= 0
          : undefined

  return {
    id: docSnap.id,
    entityType: "event",
    title: String(data.title ?? "Comedy event"),
    description: String(data.description ?? ""),
    venueId: String(data.venueId ?? ""),
    startTime: readTimestamp(data.startTime),
    endTime: readTimestamp(data.endTime),
    lineup: Array.isArray(data.lineup) ? data.lineup.filter((v): v is string => typeof v === "string") : [],
    ticketUrl: typeof data.ticketUrl === "string" ? data.ticketUrl : undefined,
    isFree,
    coverImage: typeof data.coverImage === "string" ? data.coverImage : undefined,
    comedyType: typeof data.comedyType === "string" ? data.comedyType : undefined,
    geoLocation,
  }
}

function toMapVenue(docSnap: MapDoc): MapVenue | null {
  const data = docSnap.data()
  const geoLocation = toGeoLocation(data.geoLocation)
  if (!geoLocation) return null

  return {
    id: docSnap.id,
    entityType: "venue",
    name: String(data.name ?? "Comedy venue"),
    description: String(data.description ?? ""),
    address: typeof data.address === "string" ? data.address : undefined,
    image: typeof data.image === "string" ? data.image : undefined,
    tags: Array.isArray(data.tags) ? data.tags.filter((v): v is string => typeof v === "string") : [],
    eventIds: Array.isArray(data.eventIds) ? data.eventIds.filter((v): v is string => typeof v === "string") : [],
    geoLocation,
  }
}

function toMapComedian(docSnap: MapDoc): MapComedian | null {
  const data = docSnap.data()
  const geoLocation = toGeoLocation(data.geoLocation ?? data.cityLocation)
  if (!geoLocation) return null

  return {
    id: docSnap.id,
    entityType: "comedian",
    displayName: String(data.displayName ?? "Comedian"),
    profileImage: typeof data.profileImage === "string" ? data.profileImage : undefined,
    geoLocation,
  }
}

function toMapVideo(docSnap: MapDoc): MapVideo | null {
  const data = docSnap.data()
  const geoLocation = toGeoLocation(data.geoLocation)
  if (!geoLocation) return null

  return {
    id: docSnap.id,
    entityType: "video",
    videoId: String(data.videoId ?? docSnap.id),
    thumbnail: typeof data.thumbnail === "string" ? data.thumbnail : typeof data.thumbnailURL === "string" ? data.thumbnailURL : undefined,
    comedianId: String(data.comedianId ?? data.userId ?? ""),
    venueId: typeof data.venueId === "string" ? data.venueId : undefined,
    timestamp: readTimestamp(data.timestamp),
    title: typeof data.title === "string" ? data.title : undefined,
    geoLocation,
  }
}

export async function loadMapEntities({ center, filters }: LoadMapEntitiesOptions): Promise<MapEntity[]> {
  // Fast path: reuse cached entity pool, then apply local filters for current viewport.
  if (entitiesCache && Date.now() - entitiesCache.at < CACHE_TTL_MS) {
    return filterEntities(entitiesCache.entities, center, filters)
  }

  const [eventsSnap, venuesSnap, usersSnap, videosSnap, postsSnap] = await Promise.all([
    getDocs(query(collection(db, "events"), limit(DEFAULT_FETCH_LIMIT))).catch(() => null),
    getDocs(query(collection(db, "venues"), limit(DEFAULT_FETCH_LIMIT))).catch(() => null),
    getDocs(query(collection(db, "users"), limit(DEFAULT_FETCH_LIMIT))).catch(() => null),
    getDocs(query(collection(db, "videos"), limit(DEFAULT_FETCH_LIMIT))).catch(() => null),
    getDocs(query(collection(db, "posts"), limit(DEFAULT_FETCH_LIMIT))).catch(() => null),
  ])

  const entities: MapEntity[] = []

  eventsSnap?.docs.forEach((docSnap) => {
    const mapped = toMapEvent(docSnap)
    if (mapped) entities.push(mapped)
  })

  venuesSnap?.docs.forEach((docSnap) => {
    const mapped = toMapVenue(docSnap)
    if (mapped) entities.push(mapped)
  })

  usersSnap?.docs.forEach((docSnap) => {
    const mapped = toMapComedian(docSnap)
    if (mapped) entities.push(mapped)
  })

  videosSnap?.docs.forEach((docSnap) => {
    const mapped = toMapVideo(docSnap)
    if (mapped) entities.push(mapped)
  })

  postsSnap?.docs.forEach((docSnap) => {
    const mapped = toMapVideo(docSnap)
    if (mapped) entities.push(mapped)
  })

  const shouldForceMocks = process.env.NEXT_PUBLIC_INCLUDE_MAP_MOCKS === "true"
  // Helpful for demos/local dev when Firestore has little or no map content.
  if (entities.length === 0 || shouldForceMocks) {
    entities.push(...MOCK_MAP_ENTITIES)
  }

  entitiesCache = { at: Date.now(), entities }
  return filterEntities(entities, center, filters)
}

export async function getMapEntityById(entityType: "event" | "venue" | "comedian" | "video", id: string): Promise<MapEntity | null> {
  if (entityType === "event") {
    const snap = await getDoc(doc(db, "events", id)).catch(() => null)
    if (snap?.exists()) return toMapEvent(snap)
    return getMockMapEntityById(id)
  }
  if (entityType === "venue") {
    const snap = await getDoc(doc(db, "venues", id)).catch(() => null)
    if (snap?.exists()) return toMapVenue(snap)
    return getMockMapEntityById(id)
  }
  if (entityType === "comedian") {
    const snap = await getDoc(doc(db, "users", id)).catch(() => null)
    if (snap?.exists()) return toMapComedian(snap)
    return getMockMapEntityById(id)
  }

  const videoSnap = await getDoc(doc(db, "videos", id)).catch(() => null)
  if (videoSnap?.exists()) {
    return toMapVideo(videoSnap)
  }
  const postSnap = await getDoc(doc(db, "posts", id)).catch(() => null)
  if (postSnap?.exists()) return toMapVideo(postSnap)
  return getMockMapEntityById(id)
}
