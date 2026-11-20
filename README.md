# Confirm & Remind — local preview

Write it down. Confirm what matters. Get reminded.

**This is an unfinished Phase 1 preview, not a dependable reminder service.** It saves notes, tasks and preferences only in the current browser. It does not schedule or send reminders. Do not use it for anything time-sensitive or store sensitive information in it.

## What is available

- Today, Notes, Upcoming, Review and Settings screens with a responsive layout.
- Create, edit, pin, search and delete local notes; create local tasks and mark them done or snooze them. Due dates and reminder times are separate fields.
- New-note drafts use IndexedDB when available; saved notes and tasks use localStorage. Export local notes and tasks to JSON or Markdown.
- The web manifest and service worker are present, but installation and offline operation have not been verified.

## Run the preview

Requires Node.js 22 and npm. From the repository root:

```sh
npm install
npm test
npm run build
npm start
```

Open the address printed by the server. For development, use `npm run dev`. Browser storage may be cleared by the user, browser settings, or the operating system; this is not a backup.

## Not implemented — do not deploy as a production service

- No sign-up, sign-in, cross-device sync, API rate limits or server-side ownership checks.
- No scheduler, occurrence claiming, retries, cancellation checks, push delivery, device registration or test notification. The Enable notifications control explains that it is unavailable; it does not request permission.
- No actual account deletion, note version history, server search, reminder rescheduling screen, quiet-hour enforcement or title-visibility preference.
- Time inputs use the browser's local time, not the time zone entered in Settings. The time zone is used for display only. Recurring reminders are not implemented in the interface or scheduler.
- The migration is an **unverified schema draft**, not a deployable security boundary. In particular, related records can reference another user's IDs without same-owner foreign key enforcement, and some server-owned status tables permit user writes. Do not apply it to a real project until ownership, RLS and privileges have been reviewed and tested with multiple users.
- The current tests do not establish authorization, notification delivery, durable draft recovery or account deletion. End-to-end delivery and the requested security tests remain outstanding.

## Supabase, push and scheduler setup

These steps are **not sufficient to enable reminders** until the missing backend is built and the schema is secured:

1. Create a Supabase project and review/test the migration in `supabase/migrations` before applying it. Never run the unverified migration against production data.
2. Copy `.env.example` to `.env.local` and fill in the Supabase values and app origin. The service-role key must remain server-side.
3. Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Store the private key and contact address only in server environment variables. Never commit secrets.
4. Implement and deploy an authenticated scheduler and dispatch worker before configuring a scheduled job. There is no scheduler endpoint to configure yet.
5. After push and device registration are implemented, test on an iPhone by adding the site to the Home Screen, opening it from the icon and enabling notifications there; also test on Android and desktop browsers. These real-device tests have not been performed.

## Known limits

Web Push delivery is not guaranteed and should not be treated as an exact-time alarm. This preview is not end-to-end encrypted. Local data is accessible to other users of the same browser profile. Clearing local data in Settings removes the visible notes and tasks, but may leave an IndexedDB draft or saved preferences; clear this site's browser storage to remove all preview data.

## What's coming in Phase 2

AI suggestions are reserved for a later phase and are not implemented. Any suggestions should require explicit confirmation; they must not schedule reminders automatically.
