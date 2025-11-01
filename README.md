# OpenMic

OpenMic is a TikTok-style short-form video app focused on stand-up comedy sets. It is built with Next.js (App Router), Tailwind CSS, and the Firebase Web SDK for anonymous auth, Firestore, and Storage. Users can swipe through a vertical feed of comedy clips, like/share/comment on sets, upload their own routines, search & explore by comedic style, and manage a personal performer profile.

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS with project-specific components
- **Backend:** Firebase (Anonymous Auth, Firestore, Storage)
- **Icons & Utilities:** lucide-react, date-fns

## Features

- 👤 **Anonymous Auth Context:** Automatic sign-in on launch with a shared React context exposing `{ user, loading, error }`.
- 🎬 **Infinite Video Feed:** Firestore-backed posts ordered by timestamp, TikTok-style video cards, optimistic like toggles, share-to-clipboard, and owner delete (removes video + comments + storage asset).
- 💬 **Live Comments Overlay:** Lazy-loaded comments per post, add/delete for current user, relative timestamps.
- 📤 **Upload Flow:** Validates title/video, uploads to `videos/{uuid}` in Storage, creates Firestore post with category metadata, and resets the form on success.
- 🔍 **Search:** Client-side filtering of the live dataset by text and stand-up category; comedian summary rows use cached display names.
- 🌎 **Explore:** Curated grid sourced from the same dataset with category pills.
- 🎭 **Profile:** Editable stage name (persisted in `users/{uid}`), uploaded sets grid, placeholder for liked sets, and aggregate stats.
- 📱 **Bottom Navigation:** Provided TikTok-style nav component for in-app tab switching.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase Environment Variables

Create `.env.local` in the project root with your Firebase Web SDK values:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> Tip: You can copy these from **Project Settings → General → Your Apps → Web** inside the Firebase console.

### Firebase Security Rules Deployment

Protect Firestore before shipping by deploying the included `firestore.rules` file. These rules enforce that only authenticated users (including anonymous accounts) can read data and that write operations are restricted to the resource owner.

#### Option 1 — Firebase Console (Manual)

1. Open **Firebase Console → Firestore Database → Rules**.
2. Replace the editor contents with the contents of the root-level `firestore.rules` file.
3. Click **Publish** and wait for the confirmation banner (usually under two minutes).

#### Option 2 — Firebase CLI (Recommended)

1. Install the CLI if needed: `npm install -g firebase-tools`.
2. Authenticate: `firebase login`.
3. Initialize Firestore (first time only): `firebase init firestore` and pick the project.
4. Deploy rules: `firebase deploy --only firestore:rules`.
5. Confirm the deployment succeeded in the CLI output.

#### Test the Rules

- Anonymous sessions should browse posts and comments without errors.
- Signed-in users can upload and delete their own posts but not others.
- Users can edit only their own profile document.
- Optional: run `firebase emulators:start --only firestore` to exercise rules locally.

#### Troubleshooting

- `permission-denied` errors after deployment usually mean outdated rules—verify the Rules tab reflects the latest version.
- Ensure `.env.local` contains the correct `NEXT_PUBLIC_FIREBASE_PROJECT_ID` for your Firebase project.
- Confirm you are authenticated in the browser when testing restricted write actions.

### Firebase Storage Rules Deployment

Secure uploaded media by deploying the bundled `storage.rules`. These rules limit access to authenticated users, enforce the 200 MB video cap, and ensure thumbnails remain lightweight JPEGs.

#### Option 1 — Firebase Console (Manual)

1. Open **Firebase Console → Storage → Rules**.
2. Replace the editor contents with the root-level `storage.rules` file.
3. Click **Publish** and wait for the success banner (typically under two minutes).

#### Option 2 — Firebase CLI (Recommended)

1. Install the CLI if needed: `npm install -g firebase-tools`.
2. Authenticate (skip if already logged in): `firebase login`.
3. Initialize Storage the first time: `firebase init storage` and choose your project.
4. Deploy the rules: `firebase deploy --only storage`.
5. Optionally deploy Firestore and Storage together: `firebase deploy --only firestore:rules,storage`.

#### Test the Rules

- Authenticated sessions (including anonymous) can upload videos and thumbnails.
- Uploads larger than 200 MB (videos) or 5 MB (thumbnails) are rejected.
- Invalid content types are blocked (`videos/` allows MP4, QuickTime, WebM; `thumbnails/` requires JPEG).
- Unauthenticated requests receive `permission-denied`.
- Optional: run `firebase emulators:start --only storage` to test locally.

#### Troubleshooting

- Upload failures with `permission-denied` usually signal stale rules—confirm the Storage Rules tab shows the latest version.
- Check that the uploading user is authenticated; anonymous auth still counts as signed in.
- Verify file size and MIME type meet the documented limits.

### 3. Run the App

```bash
npm run dev
```

Navigate to http://localhost:3000 to try the app.

## Useful Scripts

| Command          | Description                                   |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Start the Next.js development server (Turbopack). |
| `npm run lint`   | Run ESLint (`next lint`) with the project rules. |
| `npm run build`* | Build the production bundle (if needed).        |

\* `npm run build` relies on the same environment variables defined in `.env.local`.

## Project Structure Highlights

```
app/                 # Next.js App Router entry points
components/          # UI components (feed, overlay, nav, tabs, etc.)
hooks/               # React hooks shared across components
lib/                 # Firebase config, Firestore helpers, utilities
tailwind.config.ts   # Tailwind theme extension and plugins
```

## Manual Smoke Test Checklist

1. Upload a stand-up clip → the post appears at the top of the Home feed.
2. Like/unlike a post → heart count updates optimistically and persists after refresh.
3. Open comments overlay → existing comments load, adding/deleting works for the current user.
4. Share → copies the video URL to the clipboard (shows “Copied”).
5. Delete a post you own → removes the post, its comments, and the video from Storage.
6. Switch tabs (Search / Explore / Profile) → see filtered data and editable stage name.

## Deployment Notes

- Publish both Firestore and Storage rules before launch; refer to the Firebase Security Rules Deployment and Firebase Storage Rules Deployment sections above.
- This project uses Turbopack by default in dev mode; production builds still use Next’s standard SWC pipeline.

Happy comedy sharing! 🎤
