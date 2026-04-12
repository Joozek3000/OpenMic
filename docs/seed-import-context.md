# Seed Import Context

Gathered 2026-04-11 from the OpenMic codebase for use when writing a venue/event seed-data import script.

---

## 1. Venue Type/Interface

**Source:** `lib/types.ts:174-182`

```typescript
export interface MapVenue extends MapEntityBase {
  entityType: "venue"
  name: string
  description: string
  address?: string
  image?: string
  tags: string[]
  eventIds: string[]
}
```

**Base type** (`lib/types.ts:154-158`):

```typescript
interface MapEntityBase {
  id: string
  entityType: MapEntityType
  geoLocation: GeoLocation
}
```

**GeoLocation** (`lib/types.ts:147-150`):

```typescript
export interface GeoLocation {
  lat: number
  lng: number
}
```

There is only **one** venue type (`MapVenue`). This is both the in-app shape and the Firestore document shape — the data layer (`lib/data/map.ts:126-142`) reads Firestore docs and maps them directly into `MapVenue`. There is no separate `VenueDoc` or `VenueInput` type.

---

## 2. Event Type/Interface

**Source:** `lib/types.ts:160-172`

```typescript
export interface MapEvent extends MapEntityBase {
  entityType: "event"
  title: string
  description: string
  venueId: string
  startTime?: Timestamp | null
  endTime?: Timestamp | null
  lineup: string[]
  ticketUrl?: string
  isFree?: boolean
  coverImage?: string
  comedyType?: string
}
```

### Recurring events

**There is no recurrence model.** No `recurrence`, `recurringRule`, `dayOfWeek`, `rrule`, or `Frequency` fields exist anywhere in the codebase. Each event document represents a **single occurrence**. To seed a weekly show you would create one event doc per occurrence.

### Related types

There are no related sub-types (no `RecurrencePattern`, no `Frequency` enum).

---

## 3. Comedy Type / Category — The Mismatch

### Event side

`MapEvent.comedyType` is a **free-form `string`** (no enum). Values used in mock data (`lib/data/map-mocks.ts`):

- `"standup"`
- `"crowdwork"`
- `"new-material"`

### Venue side

`MapVenue.tags` is a **`string[]`** (also free-form). Values used in mock data:

- `["standup", "open-mic"]`
- `["crowdwork", "showcase"]`
- `["new-material", "standup"]`

### The mismatch

The filter logic in `lib/data/map.ts:66-75` compares them differently:

```typescript
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
```

- **Venues** use `tags[]` — an array matched via `.some()`.
- **Events** use `comedyType` — a single string matched via direct equality.
- There is **no shared enum or constant** defining the allowed values. Both sides are completely ad-hoc strings.
- A venue can have multiple tags (e.g. `["standup", "open-mic"]`), but an event can only have one `comedyType`.
- The UI has **no hardcoded comedy type filter list** — no dropdown or chips for these values were found in any component file.

---

## 4. Existing Seed Script

**File:** `scripts/createSeedAccounts.ts` (full contents)

```typescript
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import admin from "firebase-admin"

interface SeedAccountInput {
  handle: string
  displayName: string
  officialLabel: string
  cityName?: string
  countryCode?: string
  isVerified?: boolean
}

interface HandleRegistryDoc {
  uid: string
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp
  type: "user" | "editorial"
}

function normalizeHandle(handle: string) {
  return handle
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function assertSeedRow(row: SeedAccountInput, index: number) {
  if (!row.handle || !row.displayName || !row.officialLabel) {
    throw new Error(`Invalid seed row at index ${index}. Required: handle, displayName, officialLabel.`)
  }
}

function loadSeedAccounts() {
  const seedPath = resolve(process.cwd(), "seed/seedAccounts.json")
  const raw = readFileSync(seedPath, "utf8")
  const data = JSON.parse(raw) as SeedAccountInput[]
  data.forEach((row, index) => assertSeedRow(row, index))
  return data
}

function ensureAdminSdk() {
  if (admin.apps.length > 0) return
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  })
}

async function ensureAuthUserByEmail(auth: admin.auth.Auth, email: string, displayName: string) {
  try {
    const existing = await auth.getUserByEmail(email)
    return existing
  } catch (error) {
    const authError = error as { code?: string }
    if (authError.code !== "auth/user-not-found") {
      throw error
    }
  }

  return auth.createUser({
    email,
    emailVerified: true,
    password: `Seed-${Math.random().toString(36).slice(2)}-OpenMic`,
    displayName,
    disabled: false,
  })
}

async function upsertSeedAccount(
  db: FirebaseFirestore.Firestore,
  auth: admin.auth.Auth,
  row: SeedAccountInput,
  createdBy: string,
) {
  const handleLower = normalizeHandle(row.handle)
  if (!handleLower) {
    throw new Error(`Could not normalize handle "${row.handle}".`)
  }

  const email = `${handleLower}@seed.openmic.local`
  const handleRef = db.collection("handles").doc(handleLower)

  const existingHandle = await handleRef.get()
  let uid: string

  if (existingHandle.exists) {
    const payload = existingHandle.data() as Partial<HandleRegistryDoc>
    if (!payload.uid) {
      throw new Error(`Handle doc ${handleLower} exists without uid.`)
    }
    uid = payload.uid
  } else {
    const userRecord = await ensureAuthUserByEmail(auth, email, row.displayName)
    uid = userRecord.uid
  }

  const userRef = db.collection("users").doc(uid)

  await db.runTransaction(async (tx) => {
    const handleSnap = await tx.get(handleRef)
    if (handleSnap.exists) {
      const handleData = handleSnap.data() as Partial<HandleRegistryDoc>
      if (handleData.uid && handleData.uid !== uid) {
        throw new Error(`Handle "${handleLower}" is already claimed by another uid.`)
      }
    } else {
      tx.set(handleRef, {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "editorial",
      } satisfies HandleRegistryDoc)
    }

    tx.set(
      userRef,
      {
        displayName: row.displayName,
        displayNameLower: row.displayName.toLowerCase(),
        accountType: "editorial",
        isSeedAccount: true,
        officialLabel: row.officialLabel,
        isVerified: row.isVerified === true,
        handle: handleLower,
        handleLower,
        cityName: row.cityName ?? null,
        countryCode: row.countryCode ?? null,
        createdBy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        following: [],
      },
      { merge: true },
    )
  })

  return { uid, handleLower, email }
}

async function main() {
  ensureAdminSdk()
  const db = admin.firestore()
  const auth = admin.auth()
  const seedAccounts = loadSeedAccounts()
  const createdBy = process.env.SEED_ADMIN_UID ?? "seed-script"

  console.log(`Seeding ${seedAccounts.length} editorial accounts...`)

  for (const row of seedAccounts) {
    const result = await upsertSeedAccount(db, auth, row, createdBy)
    console.log(`upserted @${result.handleLower} -> uid=${result.uid} email=${result.email}`)
  }

  console.log("Seed account sync complete.")
}

main().catch((error) => {
  console.error("Failed to seed editorial accounts:", error)
  process.exit(1)
})
```

---

## 5. Firestore Collection Names

Found via `collection(` calls across the codebase:

| Collection path | Used in |
|---|---|
| `"venues"` | `lib/data/map.ts` — top-level |
| `"events"` | `lib/data/map.ts` — top-level |
| `"users"` | `lib/data/map.ts`, `lib/data/users.ts`, `scripts/createSeedAccounts.ts` — top-level |
| `"posts"` | `lib/data/posts.ts`, `lib/data/map.ts` — top-level |
| `"posts/{postId}/comments"` | `lib/data/posts.ts` — subcollection |
| `"videos"` | `lib/data/map.ts` — top-level |
| `"handles"` | `scripts/createSeedAccounts.ts` — top-level |

All collections are **top-level** (flat). No nested `cities/{cityId}/venues` pattern.

**Note:** The `firestore.rules` file does **not** include rules for `venues` or `events` collections yet — only `posts`, `users`, `handles`, and `admins` have rules defined. This means venue/event writes from the Admin SDK will work (Admin SDK bypasses rules), but client-side reads/writes to `venues`/`events` are currently **denied by default**.

---

## 6. Geo Field Shape

**Field name:** `geoLocation`
**Type:** Plain object `{ lat: number, lng: number }` (the `GeoLocation` interface)

It is **not** a Firestore `GeoPoint` — it's stored as a plain map with `lat` and `lng` keys.

The data layer (`lib/data/map.ts:29-48`) also tolerates `{ latitude, longitude }` as a fallback for legacy docs:

```typescript
function toGeoLocation(value: unknown): GeoLocation | null {
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
```

No geohash field. No separate `lat`/`lng` top-level fields.

---

## 7. Map Library & Geocoding Service

### Map library

**Mapbox GL JS** (`mapbox-gl@^3.18.1`)

- Imported dynamically in `components/map/map-canvas.tsx`
- Uses `mapbox://styles/mapbox/dark-v11` style
- Token read from `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`

### Geocoding service

**Mapbox Geocoding API v5** — used directly in `components/map-page.tsx:399`:

```
https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&limit=1&types=place,locality,neighborhood,address,postcode,country,region
```

No Google Maps usage found anywhere in the codebase. The import script should use the **Mapbox Geocoding API** if geocoding is needed.

---

## 8. Existing Admin/Import Pattern for Venues or Events

**None found.** The only existing import script is `scripts/createSeedAccounts.ts` (for user accounts). There are no bulk-import scripts, API routes, or admin tools for venues or events.

---

## 9. package.json Scripts Section

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "seed:accounts": "tsx scripts/createSeedAccounts.ts"
}
```

Scripts are run via **`tsx`** (installed as a devDependency at `^4.19.2`).

---

## 10. Firebase Admin SDK Setup

There is **no dedicated `lib/firebase-admin.ts` file**. The Admin SDK is initialized inline in `scripts/createSeedAccounts.ts`:

```typescript
import admin from "firebase-admin"

function ensureAdminSdk() {
  if (admin.apps.length > 0) return
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  })
}
```

Key points:
- Uses `admin.credential.applicationDefault()` — relies on `GOOGLE_APPLICATION_CREDENTIALS` env var or gcloud default credentials
- No service account JSON path is hardcoded
- No project ID is explicitly set (inferred from credentials)
- The pattern is a guard function (`ensureAdminSdk()`) called at the top of `main()`

The new import script should follow the same pattern: `import admin from "firebase-admin"`, call `ensureAdminSdk()`, then use `admin.firestore()`.

---

## Follow-up context

### F1. Full contents of `lib/data/map.ts`

This is the data layer that reads venues, events, comedians, and videos from Firestore and converts them into typed `MapEntity` objects.

```typescript
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
```

---

### F2. Mock data fallback — switch logic and full mock file

#### The switch (`lib/data/map.ts:217-221`)

```typescript
const shouldForceMocks = process.env.NEXT_PUBLIC_INCLUDE_MAP_MOCKS === "true"
// Helpful for demos/local dev when Firestore has little or no map content.
if (entities.length === 0 || shouldForceMocks) {
  entities.push(...MOCK_MAP_ENTITIES)
}
```

**Two triggers cause mock data to load:**

1. **Automatic:** When the real Firestore query returns **zero** entities across all five collections (`entities.length === 0`), mock data is injected as a fallback.
2. **Forced via env var:** When `NEXT_PUBLIC_INCLUDE_MAP_MOCKS=true` is set, mocks are **always** appended — even alongside real data. This is additive, not a replacement.

Note: `getMapEntityById` also falls back to mocks per-entity — if a Firestore doc lookup fails or returns nothing, it tries `getMockMapEntityById(id)` before returning `null`.

#### Full contents of `lib/data/map-mocks.ts`

```typescript
import { Timestamp } from "firebase/firestore"

import type { MapEntity } from "@/lib/types"

const now = Date.now()

function daysFromNow(days: number) {
  return Timestamp.fromMillis(now + days * 24 * 60 * 60 * 1000)
}

export const MOCK_MAP_ENTITIES: MapEntity[] = [
  // Tweak these coordinates/titles when demoing a different city.
  {
    id: "mock-event-camden-friday",
    entityType: "event",
    title: "Friday Night Laughs",
    description: "Fast-paced open mic with pro drop-ins.",
    venueId: "mock-venue-camden-cellar",
    startTime: daysFromNow(1),
    endTime: daysFromNow(1.25),
    lineup: ["mock-comedian-alex-rivera", "mock-comedian-priya-shah"],
    ticketUrl: "https://example.com/tickets/friday-night-laughs",
    isFree: false,
    comedyType: "standup",
    geoLocation: { lat: 51.5416, lng: -0.1432 },
  },
  {
    id: "mock-event-shoreditch-sunday",
    entityType: "event",
    title: "Sunday Roast Comedy",
    description: "Crowd work heavy showcase and new material.",
    venueId: "mock-venue-shoreditch-spot",
    startTime: daysFromNow(3),
    endTime: daysFromNow(3.2),
    lineup: ["mock-comedian-joel-khan", "mock-comedian-priya-shah"],
    ticketUrl: "https://example.com/tickets/sunday-roast-comedy",
    isFree: true,
    comedyType: "crowdwork",
    geoLocation: { lat: 51.5256, lng: -0.0794 },
  },
  {
    id: "mock-event-soho-midweek",
    entityType: "event",
    title: "Midweek Mic Lab",
    description: "Try 5 fresh minutes and workshop tags.",
    venueId: "mock-venue-soho-room",
    startTime: daysFromNow(5),
    lineup: ["mock-comedian-alex-rivera", "mock-comedian-joel-khan"],
    ticketUrl: "https://example.com/tickets/midweek-mic-lab",
    isFree: true,
    comedyType: "new-material",
    geoLocation: { lat: 51.5148, lng: -0.1323 },
  },
  {
    id: "mock-venue-camden-cellar",
    entityType: "venue",
    name: "Camden Cellar",
    description: "Basement club with low ceiling energy.",
    address: "31 Parkway, London NW1",
    tags: ["standup", "open-mic"],
    eventIds: ["mock-event-camden-friday"],
    geoLocation: { lat: 51.5392, lng: -0.1426 },
  },
  {
    id: "mock-venue-shoreditch-spot",
    entityType: "venue",
    name: "Shoreditch Spot",
    description: "Intimate room built for crowd interaction.",
    address: "54 Curtain Rd, London EC2",
    tags: ["crowdwork", "showcase"],
    eventIds: ["mock-event-shoreditch-sunday"],
    geoLocation: { lat: 51.5245, lng: -0.0821 },
  },
  {
    id: "mock-venue-soho-room",
    entityType: "venue",
    name: "Soho Back Room",
    description: "Classic late-night stand-up room.",
    address: "12 Greek St, London W1",
    tags: ["new-material", "standup"],
    eventIds: ["mock-event-soho-midweek"],
    geoLocation: { lat: 51.5136, lng: -0.1329 },
  },
  {
    id: "mock-comedian-alex-rivera",
    entityType: "comedian",
    displayName: "Alex Rivera",
    geoLocation: { lat: 51.5194, lng: -0.1045 },
  },
  {
    id: "mock-comedian-priya-shah",
    entityType: "comedian",
    displayName: "Priya Shah",
    geoLocation: { lat: 51.5333, lng: -0.1215 },
  },
  {
    id: "mock-comedian-joel-khan",
    entityType: "comedian",
    displayName: "Joel Khan",
    geoLocation: { lat: 51.5077, lng: -0.0877 },
  },
  {
    id: "mock-video-camden-set",
    entityType: "video",
    videoId: "mock-video-camden-set",
    comedianId: "mock-comedian-alex-rivera",
    venueId: "mock-venue-camden-cellar",
    title: "Airport security bit",
    timestamp: daysFromNow(-2),
    geoLocation: { lat: 51.5409, lng: -0.1464 },
  },
  {
    id: "mock-video-shoreditch-crowd",
    entityType: "video",
    videoId: "mock-video-shoreditch-crowd",
    comedianId: "mock-comedian-priya-shah",
    venueId: "mock-venue-shoreditch-spot",
    title: "Front row banter",
    timestamp: daysFromNow(-1),
    geoLocation: { lat: 51.5261, lng: -0.0789 },
  },
  {
    id: "mock-video-soho-closer",
    entityType: "video",
    videoId: "mock-video-soho-closer",
    comedianId: "mock-comedian-joel-khan",
    venueId: "mock-venue-soho-room",
    title: "Relationship closer",
    timestamp: daysFromNow(-4),
    geoLocation: { lat: 51.5138, lng: -0.1291 },
  },
]

export function getMockMapEntityById(id: string) {
  return MOCK_MAP_ENTITIES.find((entity) => entity.id === id || (entity.entityType === "video" && entity.videoId === id)) ?? null
}
```

---

### F3. Existing Firestore documents in `venues` and `events` collections

**Could not query Firestore directly.** `node_modules` are not installed in this working copy (`firebase-admin` is listed as a devDependency but not present on disk), and the Firebase CLI (`firebase@15.2.1` is installed globally) does not have a `firestore:get` or document-read command — it only supports `firestore:delete`, `firestore:indexes`, etc.

To check manually, run:

```bash
npm install
tsx -e "
import admin from 'firebase-admin';
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();
async function main() {
  const [v, e] = await Promise.all([
    db.collection('venues').limit(1).get(),
    db.collection('events').limit(1).get(),
  ]);
  console.log('venues:', v.empty ? 'EMPTY' : JSON.stringify(v.docs[0].data(), null, 2));
  console.log('events:', e.empty ? 'EMPTY' : JSON.stringify(e.docs[0].data(), null, 2));
  process.exit(0);
}
main();
"
```

**Best guess based on code evidence:** Both collections are likely empty or near-empty. The mock fallback in `loadMapEntities` is designed to fire when `entities.length === 0`, and the env var `NEXT_PUBLIC_INCLUDE_MAP_MOCKS` exists specifically for the "Firestore has little or no map content" case — suggesting this is the current state.

---

### F4. Map canvas pin layer — GeoJSON source setup and entity rendering

#### GeoJSON feature creation (`components/map-page.tsx:211-229`)

This is where the `MapEntity[]` array (which includes `MapVenue` objects) gets converted into GeoJSON features for the Mapbox source:

```typescript
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
```

**Key observations:**
- Every entity type (venue, event, comedian, video) becomes a simple `Point` feature.
- The only properties passed to the map layer are `id`, `entityType`, and `isSelected` — no name, title, or other display data lives in the GeoJSON. Detail rendering happens via the bottom sheet / entity page, not on the pin itself.
- Coordinates use `[lng, lat]` order (GeoJSON spec).

#### Map source and layer setup (`components/map/map-canvas.tsx:74-129`)

The GeoJSON source is added on map load with clustering enabled:

```typescript
map.addSource(MAP_SOURCE_ID, {
  type: "geojson",
  data: geoJsonRef.current,
  cluster: true,
  clusterRadius: 48,
  clusterMaxZoom: 12,
})
```

Three layers render the pins:

1. **`clusters`** — circle layer for clustered points (white circles, size scaled by `point_count`)
2. **`cluster-count`** — symbol layer showing the cluster count number
3. **`unclustered-points`** — circle layer for individual pins, **color-coded by `entityType`**:

```typescript
"circle-color": [
  "match",
  ["get", "entityType"],
  "event",   "#f97316",  // orange
  "venue",   "#10b981",  // green
  "comedian","#3b82f6",  // blue
  "video",   "#f43f5e",  // rose
  "#e5e7eb",             // fallback gray
],
```

Selected pins get a larger radius (12 vs 8) and a white stroke.

#### Live data updates (`components/map/map-canvas.tsx:176-181`)

When `geoJsonData` changes (new entities loaded, filter applied, selection changed), the source is updated in-place without recreating the map:

```typescript
useEffect(() => {
  const source = mapRef.current?.getSource(MAP_SOURCE_ID)
  if (!isGeoJsonSource(source)) return
  source.setData(geoJsonData)
}, [geoJsonData])
```

#### Feature type definitions (`components/map/map-types.ts`)

```typescript
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
```

---

## Schema verification

Investigation performed 2026-04-11. Two questions: is the stale `events` doc safe to delete, and are `MapVenue`/`MapEvent` the canonical schema?

### TASK 1 — Is the stale "Firefly Open Mic Night" event doc safe to delete?

#### 1a) Hardcoded references to "Firefly"

**No matches found.** Grepped for `Firefly Open Mic Night`, `firefly-open-mic`, and `firefly` (case-insensitive) across the entire repo. Zero hits in source code, mock data, seed data, or config.

#### 1b) Old-schema field names (`venueName`, `geoHash`, `priceType`, `visibility`)

**One irrelevant hit.** The word `visibility` appears once in `components/map/map-sidebar.tsx:145` but only as a code comment:

```typescript
{/* Core entity visibility toggles for map categories. */}
```

This is a UI comment about showing/hiding map layers — it does not read a `visibility` field from Firestore. The other three field names (`venueName`, `geoHash`, `priceType`) appear **nowhere** in the codebase. No code reads these fields.

#### 1c) Code that queries `events` collection outside `lib/data/map.ts`

**None.** The pattern `collection(db, "events")` appears only in `lib/data/map.ts:183`. No other file — no "my events" page, profile section, notification feed, or hook — queries the `events` collection. The only other hit was in `docs/seed-import-context.md` (the verbatim paste from the previous investigation).

#### 1d) Firestore rules for event deletes

The deployed rules are:

```
match /events/{eventId} {
  allow read: if true;
  allow write: if false;
}
```

Client-side deletes are blocked. Deleting via the Firebase Console bypasses rules entirely (it uses Admin access), so the rules won't prevent a console delete.

#### 1e) Cloud Functions / triggers on `events` collection

**None.** There is no `functions/` directory in the project. No files import `firebase-functions`, `onDocumentCreated`, `onDocumentDeleted`, or `onDocumentWritten`. There are zero Cloud Functions deployed for this project — no triggers will fire on any Firestore operation.

#### TASK 1 verdict

**Safe to delete.** The document uses an old schema (`venueName`, flat `lat`/`lng`, string `startTime`, `geoHash`, `priceType`, `visibility`) that no code reads. No hardcoded references exist. Nothing queries `events` outside the map data layer, and `toMapEvent()` would silently skip this doc anyway because it lacks a `geoLocation` map field (the flat `lat`/`lng` fields aren't at `data.geoLocation.lat`). No Cloud Functions will trigger on deletion.

### TASK 2 — Are MapVenue / MapEvent the canonical map schema?

#### 2a) When were MapVenue and MapEvent added?

They exist **only in the uncommitted working tree** — they have never been committed. `git diff lib/types.ts` shows them as new additions (lines 146-212 of the current file). They were added as part of the current map feature work, alongside the new `GeoLocation`, `MapEntityBase`, `MapEntityType`, `MapComedian`, `MapVideo`, `MapFilters`, and `MapEntity` types. All of the map-related files (`lib/data/map.ts`, `lib/data/map-mocks.ts`, `components/map-page.tsx`, `components/map/`, etc.) are also uncommitted/new.

The `lib/types.ts` file was first created in commit `91265c1` (2025-10-05, "complete overhaul of the app") with only `Post`, `CommentDoc`, `UserProfile`, `CreatePostInput`, `CreateCommentInput`, `DisplayPost`, and `PostsContextValue`. The map types were added to the working copy as part of the current branch's uncommitted changes.

#### 2b) Where are MapVenue and MapEvent imported/used?

Files that import map-related types from `lib/types.ts`:

| File | Types used |
|---|---|
| `lib/data/map.ts` | `GeoLocation, MapComedian, MapEntity, MapEvent, MapFilters, MapVenue, MapVideo` |
| `lib/data/map-mocks.ts` | `MapEntity` |
| `lib/map-utils.ts` | `GeoLocation` |
| `components/map-page.tsx` | `GeoLocation, MapEntity, MapFilters` |
| `components/map-bottom-sheet.tsx` | `MapEntity` |
| `components/map-entity-page.tsx` | `MapEntity, MapEntityType` |
| `components/map/map-canvas.tsx` | `GeoLocation` |
| `components/map/map-sidebar.tsx` | `MapEntity, MapFilters` |
| `components/map/map-types.ts` | `MapEntity` |

The types are used broadly across the entire map feature — the data layer, the map canvas, the sidebar, the bottom sheet, and the entity detail page all consume them. They are **not** isolated to one file.

#### 2c) Any other venue/event type definitions?

Grepped for `interface.*Venue`, `type.*Venue`, `interface.*Event`, `type.*Event` across all `.ts`/`.tsx` files. Results:

- `lib/types.ts:160` — `export interface MapEvent extends MapEntityBase` 
- `lib/types.ts:174` — `export interface MapVenue extends MapEntityBase`

**These are the only two.** No `Venue`, `VenueDoc`, `EventDoc`, `OpenMicEvent`, or any other venue/event-like interface exists anywhere in the codebase. `MapVenue` and `MapEvent` are the sole schema definitions.

#### TASK 2 verdict

**Confirmed canonical.** `MapVenue` and `MapEvent` in `lib/types.ts` are the only venue/event type definitions in the codebase. They are used by 9 files spanning the full map feature stack. There are no competing or legacy type definitions. Note: these types are part of uncommitted work — the entire map feature (types, data layer, components) has not been committed yet.
