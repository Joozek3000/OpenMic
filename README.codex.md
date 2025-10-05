# Internal Notes (Codex)

These notes are for the AI assistant maintaining OpenMic. Do not publish this file publicly.

## Key Commands

- Install deps: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`

## Firebase Setup

Expect a `.env.local` file with the following keys:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Anonymous auth must be enabled in Firebase Authentication. Firestore + Storage rules should allow anonymous users (with appropriate write constraints).

## Project Structure

- `app/`: Next.js App Router pages.
- `components/`: UI building blocks from the design source (must preserve layout).
- `hooks/`: Custom React hooks (`use-display-name`).
- `lib/`: Firebase init, Firestore helpers, constants, and utilities.
- `tailwind.config.ts`: Tailwind theme values mapped to CSS variables.

## Styling

- Use supplied layout & design exactly—avoid introducing additional layout wrappers or legacy styles.
- Tailwind CSS with custom classes already provided.
- `globals.css` contains CSS variables and utility layers. Keep `@apply` utilities compatible with tailwind theme extensions.

## Feature Reminders

- Feed: listen to Firestore posts, optimistic likes, share-to-clipboard, delete removes comments + storage asset.
- Comments: lazy load, add/delete, show relative timestamps via `date-fns`.
- Upload: validates title + file, uploads to `videos/{uuid}`, writes Firestore doc with `fileId`.
- Search/Explore/Profile: reuse live dataset, client filtering.
- Profile: Stage-name editing stored in `users/{uid}`.

## Testing Checklist

- run `npm run lint` (must be clean).
- Manual smoke tests (upload, like, comment, share, delete, tab navigation).

Keep this file for AI-only guidance.
