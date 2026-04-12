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
