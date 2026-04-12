# OpenMic Project Context

This document gives engineering and product context for the current OpenMic codebase.
It is intended as the single onboarding reference for contributors before they start
editing features, security rules, or Firebase data.

## 1. Product Summary

OpenMic is a short-form stand-up comedy platform with a TikTok-style feed and creator
profile model. The app focuses on:

- quick browsing of comedy clips
- low-friction creator uploads
- social interactions (likes, comments, follows)
- location-aware discovery (map + events/venues/comedians)
- lightweight account model (anonymous by default, optional email account)

## 2. Tech Stack

- Framework: Next.js 15 App Router (TypeScript)
- UI: React + Tailwind CSS
- Auth/Data/Storage: Firebase Auth + Firestore + Cloud Storage
- Maps: Mapbox GL
- PWA: next-pwa (currently disabled in build output)

## 3. Runtime Architecture

### Frontend composition

- `app/page.tsx`: top-level screen orchestration and tab navigation.
- `components/*`: feature pages and reusable UI.
- Provider pattern is heavily used for shared app state:
  - `AuthProvider`
  - `PostsProvider`
  - `FollowProvider`
  - `ToastProvider`
  - `PlaybackSettingsProvider`

### Data access layer

- `lib/data/posts.ts`: post CRUD, likes, comments, views, storage cleanup.
- `lib/data/users.ts`: user profile utilities, display names, follow updates.
- `lib/data/map.ts`: map entity loading and shaping (Firestore + mock fallback).
- `lib/firebase.ts`: Firebase client initialization.

### Route pages

- Main app shell: `/`
- Password reset: `/reset-password`
- Map entity detail routes:
  - `/events/[id]`
  - `/venues/[id]`
  - `/comedians/[id]`
  - `/videos/[id]`

## 4. Core User Flows

### Authentication flow

- App bootstraps anonymous auth if no existing session.
- Upgrading to email/password is supported.
- Password reset flow uses Firebase action links and in-app reset page.

### Content flow

- Upload creates media in Storage and metadata in Firestore `posts`.
- Feed streams posts with optimistic interactions:
  - like/unlike
  - comment count updates
  - view increment tracking
  - owner delete

### Discovery flow

- Search tab: text + category + sort filtering over loaded post dataset.
- Explore tab: curated discovery from the same post source.
- Map tab:
  - geolocation-aware center
  - map entities (events/venues/comedians/videos)
  - search, filters, radius, quick chips
  - distance-aware result ordering
  - fallback mock entities for sparse datasets

## 5. Firestore Data Model (Current)

### `users/{uid}`

Legacy/minimal fields:

- `updatedAt`
- `following: string[]`
- `displayNameLower: string | null`

Common optional profile fields:

- `displayName`
- `bio`
- `geoLocation: { lat, lng }`
- `cityLocation: { lat, lng }` (legacy fallback)

Editorial/seed extensions (optional, backward compatible):

- `accountType: "user" | "editorial"`
- `isSeedAccount: boolean`
- `officialLabel: string`
- `isVerified: boolean`
- `handle`
- `handleLower`
- `cityName`
- `countryCode`
- `createdAt`
- `createdBy`

### `handles/{handleLower}`

Canonical handle registry for case-insensitive uniqueness:

- `uid`
- `createdAt`
- `type: "user" | "editorial"`

### `admins/{uid}`

MVP admin mechanism:

- existence of doc marks user as admin for rules checks.

### `posts/{postId}` (+ nested comments)

Stores clip metadata, owner id, likes, timestamps, and media links.

### `events`, `venues`, `videos`, `users` (map aggregation)

Map layer reads multiple collections and maps docs into a common `MapEntity` shape.

## 6. Security Model (Firestore Rules)

Rules are in `firestore.rules` and include:

- authenticated reads on core collections
- ownership constraints on user-generated content
- profile write validation for normal users
- admin-only control for:
  - editorial profile fields
  - `handles/*` registry writes
- admin detection via `admins/{uid}` existence

Important behavior:

- normal users can still update their standard profile fields (display name, following, geolocation)
- normal users cannot set protected editorial/account-system fields

## 7. Editorial / Seed Account Tooling

Files:

- `seed/seedAccounts.json`
- `scripts/createSeedAccounts.ts`

Behavior:

- idempotent upsert of official OpenMic seed accounts
- creates Auth user with placeholder email if needed
- claims handle in registry transactionally
- merges editorial fields into `users/{uid}`

Runbook:

1. Ensure first admin doc exists in `admins/{uid}`.
2. Configure Application Default Credentials for Firebase Admin SDK.
3. Run:
   - `npm install`
   - `SEED_ADMIN_UID=<uid> npm run seed:accounts`

## 8. Official Account UI Rules

Official badge condition:

- `accountType === "editorial" || isSeedAccount === true`

Current badge surfaces:

- feed author area (`components/video-card.tsx`)
- profile header (`components/profile-page.tsx`)

## 9. Environment and Config

Primary env vars used by the web app:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_APP_URL` (used for canonical reset link generation outside localhost)

Notes:

- in local development, password reset links use active browser origin to avoid stale port mismatches
- map experience degrades gracefully without mapbox token (fallback UI)

## 10. Firebase Configuration Guide

Use this sequence for a clean project setup.

### A. Create and connect Firebase project

1. Create/select project in Firebase Console.
2. Add a Web app in Project Settings.
3. Copy Firebase Web SDK config values.
4. Put values in `.env.local`:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
5. Restart `npm run dev` after env changes.

### B. Configure Authentication

Enable in Firebase Console -> Authentication -> Sign-in method:

- Anonymous (required for default app flow)
- Email/Password (required for account upgrade and password reset)

Also check Authentication -> Settings -> Authorized domains:

- add your dev host (`localhost`)
- add your production/ngrok domain used in reset links

### C. Configure Firestore

1. Create Firestore database (production mode).
2. Keep region aligned with app config and latency goals.
   - Current repo Firebase config targets `europe-west2` in `firebase.json`.
3. Deploy rules:
   - `firebase deploy --only firestore:rules`
4. Deploy indexes if needed:
   - `firebase deploy --only firestore:indexes`

### D. Configure Cloud Storage

1. Enable Cloud Storage bucket for the same Firebase project.
2. Deploy storage rules:
   - `firebase deploy --only storage`

### E. Password reset link configuration

Reset links are built from:

- local dev: active browser origin (`localhost:<port>`)
- non-local: `NEXT_PUBLIC_APP_URL`

Set `NEXT_PUBLIC_APP_URL` to your canonical app origin in deployed environments.

### F. CLI setup (recommended)

1. Install CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Link project: `firebase use <project-id>` (or via `.firebaserc`)
4. Deploy rules:
   - `firebase deploy --only firestore:rules,storage`

### G. Admin SDK setup (for seed scripts)

Used by `scripts/createSeedAccounts.ts`.

1. Create service account key (or use GCP ADC in CI).
2. Export credentials:
   - `export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json`
3. Seed first admin doc manually:
   - Firestore `admins/{yourAuthUid}`
4. Run seed sync:
   - `npm install`
   - `SEED_ADMIN_UID=<yourAuthUid> npm run seed:accounts`

### H. Quick verification checklist

- Anonymous user auto-signs in on app load.
- Email/password sign-in works.
- Password reset email arrives and opens `/reset-password`.
- Upload succeeds and writes Storage + Firestore post metadata.
- Firestore writes fail correctly when violating ownership/rules.

## 11. Quality and Operational Commands

Local validation:

- `npm run lint`
- `npm run build`

Firestore/Storage rules:

- `firebase deploy --only firestore:rules`
- `firebase deploy --only storage`

## 12. Known Product Priorities (MVP-Oriented)

High priority:

- improve map information density and confidence
- improve moderation/safety baseline
- ensure clean onboarding/auth flows
- preserve performance on mobile scroll and map interactions

## 13. Suggested Contributor Workflow

1. Read this file and `README.md`.
2. Run app and smoke test core flows.
3. Make focused changes by layer:
   - UI component
   - data helper
   - rules (if access changes)
4. Validate with lint/build before handing off.
5. If changing data semantics, update this document.
