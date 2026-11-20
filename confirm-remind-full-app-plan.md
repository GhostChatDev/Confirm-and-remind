# Confirm & Remind — full app plan

**Yes, Bernard. This is a practical web app to build.** My recommendation is a fast notes app that turns messy thoughts into **suggested reminders**, but schedules nothing until the user confirms.

**The promise:**
> **Write it down. Confirm what matters. Get reminded.**

And yes: **only you configure the AI API key.** It stays on your server. Users create an account and use the app without seeing your key or adding their own.

I researched browser notification requirements, reminder products, background processing, account isolation, and secret management. Below is the product and technical plan—not a claim that the app has already been built or tested.

---

## 1. What makes this useful?

The app connects three everyday actions:

**Capture → Confirm → Remember**

Example note:

> “Rent is $650 next Friday. Call the landlord Thursday afternoon. Buy oil for the bike sometime.”

The app saves the original immediately, then suggests:

| Found in the note | What the app suggests |
|---|---|
| Rent, $650, next Friday | A rent task with a proposed due date |
| Call landlord Thursday afternoon | A call task that needs an exact reminder time |
| Buy oil sometime | An undated checklist item—not an invented deadline |

The user reviews the suggestions:

**Confirm reminder · Change time · Keep as task · Dismiss**

**Important distinction:** a task’s **due date** and its **notification time** are separate. Rent might be due Friday, while the reminder arrives Thursday evening.

### Why people would choose it

Not because it has more AI buttons.

Because they can write normally, keep the original context, and avoid manually entering every task into a planner.

Todoist already offers natural-language dates and several reminder types. That means “AI that understands tomorrow” is not enough differentiation. Your stronger angle is **notes first, transparent suggestions, and explicit confirmation**.[13]

---

## 2. Who should it serve first?

Build for **individuals managing everyday responsibilities**, not teams.

Three possible starting audiences:

| Audience | Useful examples | Main weakness |
|---|---|---|
| **Busy workers and parents — recommended** | Bills, calls, appointments, errands | Broad audience; marketing must stay specific |
| Tradespeople and mechanics | Parts to order, customer follow-ups, service notes | Can drift into a full business-management app |
| Students | Assignments, study notes, exam dates | Academic workflows can expand quickly |

**My recommendation:** launch the general product, but test first with workers like you.

A realistic positioning line:

> “For people whose reminders are scattered across notes, messages, and their own head.”

Do not add invoicing, accounting, or a school workspace at launch.

---

## 3. Features ranked by importance

### Essential for the first usable release

| Feature | How it should work |
|---|---|
| **Fast capture** | Open, type, save. AI never blocks saving. |
| **Original notes** | Keep the user’s words unchanged unless they edit them. |
| **AI suggestions** | Extract possible tasks, dates, amounts, and short titles. |
| **Confirmation inbox** | A dedicated place to approve, change, or dismiss suggestions. |
| **Manual reminders** | Users can schedule reminders without AI. |
| **Today and Upcoming** | Show overdue, today, and future tasks. |
| **Web push** | Send confirmed reminders to supported, subscribed devices. |
| **Done, snooze, reschedule** | Always available inside the app; notification buttons are an enhancement. |
| **Search** | Start with reliable text search and filters. |
| **Account and device sync** | Notes and confirmed reminders follow the signed-in user. |
| **Export and deletion** | Download notes and reminders; delete individual data or the account. |
| **Private server-side API** | You control the AI provider and spending limits. |

### Add after the core is reliable

- Simple daily, weekly, and monthly recurrence.
- Optional morning digest.
- Calendar export.
- AI questions answered from the user’s notes, with source links.
- Pinning, tags, and a few note templates.
- Offline editing and conflict recovery.
- Voice recording with transcription.

### Do not build first

- Team workspaces.
- Public note sharing.
- Location-based reminders.
- Full calendar synchronization.
- Autonomous agents that change schedules.
- A general-purpose chatbot.
- Receipt accounting or automatic payments.
- Complicated folder trees and document layouts.

**Useful is better than overloaded.**

---

## 4. App layout: five simple areas

### A. Today

The opening screen.

Show:

- Overdue tasks.
- Today’s reminders.
- A clear **Add note** button.
- A small **Needs confirmation** count.
- Connection and sync problems when relevant.

Avoid a dashboard full of charts.

### B. Notes

- Searchable list.
- Pinned notes.
- Original text.
- Linked tasks and reminders.
- AI suggestions underneath—not mixed into the original.

### C. Review

This is the app’s defining screen.

Each suggestion shows:

> **Suggested task:** Pay rent  
> **Source:** “Rent is $650 next Friday.”  
> **Proposed due date:** Friday, [full date]  
> **Remind me:** Thursday, [full date], 6:00 p.m.  
> **Time zone:** America/Toronto  
>
> **Confirm · Edit · Dismiss**

Never display only “next Friday.” Show the actual date before confirmation.

### D. Upcoming

- Date-grouped agenda.
- Filters for bills, appointments, calls, and errands.
- Completed history.
- A simple list view before building a calendar grid.

### E. Settings

- Account.
- Time zone and date format.
- Notification devices.
- Quiet hours and digest preferences.
- Lock-screen privacy.
- AI processing preference.
- Export and delete account.

**No AI provider settings for ordinary users.**

---

## 5. The full user journey

### First visit

1. Let the person try a sample note without signing up.
2. Make it clear the sample is a demo.
3. Require sign-in for cloud storage and real scheduled reminders.
4. Ask them to write one real note.
5. Save it immediately.
6. Present any useful suggestions.
7. Ask for notification permission only after they choose to enable reminder notifications.

Apple requires the permission request for iPhone/iPad Home Screen web apps to follow direct user interaction. MDN likewise recommends contextual permission requests and useful, user-controlled notifications.[1][26]

### On an iPhone

Show an installation guide when needed:

> **To receive notifications on this iPhone:**  
> Add this app to your Home Screen, open it from its icon, then tap Enable notifications.

Apple documents Web Push support for Home Screen web apps starting with iOS/iPadOS 16.4.[1]

### After confirmation

Only show **Scheduled** after the server has saved the reminder successfully.

If offline:

> “Saved on this device. Reminder is not scheduled yet.”

Do not show a green success message when only the browser has the data.

### When the reminder arrives

Default privacy-friendly message:

> “You have a reminder. Open Confirm & Remind.”

Optionally let users include the task title on the lock screen.

Tapping opens the exact task, where they can:

- Mark done.
- Snooze.
- Reschedule.
- Open the source note.

---

## 6. Make the AI helpful without letting it control the app

### Give AI narrow responsibilities

**AI may:**

- Suggest a title.
- Identify possible tasks.
- Extract explicitly written dates and amounts.
- Flag ambiguity.
- Suggest tags.
- Answer questions from authorized notes.

**AI may not:**

- Schedule anything directly.
- Mark a task complete.
- Delete or rewrite the original.
- Invent a deadline.
- Access another account.
- Call arbitrary URLs or tools from text inside a note.

### Date rules

| User writes | App behavior |
|---|---|
| “Tomorrow at 3” | Show the resolved date; require clarification if a.m./p.m. is unclear |
| “Thursday afternoon” | Suggest the day, ask for time |
| “03/04” | Ask which date unless the meaning is unambiguous in context |
| “After payday” | Keep unscheduled until clarified |
| “I paid rent yesterday” | Do not create a future payment reminder |
| “Don’t remind me about this” | Do not propose a reminder from that instruction |
| “Call next week” | Ask for a day; do not silently choose Monday |

Pass the note’s creation time, locale, and time zone to extraction. Resolve “tomorrow” relative to when the note was written—not when a delayed background job eventually runs.

### Structured results

Have the model return validated structured data, including:

- Task text.
- Exact supporting quote.
- Proposed date/time, if any.
- Ambiguities.
- Whether clarification is required.

The backend verifies that supporting quotes exist in the original note and validates all fields.

**Do not trust an AI-generated confidence percentage as proof of correctness.**

### Safe handling of edits

If the user edits a note:

- Re-analyze only the new version.
- Discard stale suggestions from older versions.
- Do not silently change already confirmed reminders.
- Show: **“This note changed. Review its linked reminders?”**

This protects the user from a background AI job changing a commitment they already approved.

---

## 7. Your private API: the correct architecture

### What “private” means here

There are three separate things:

1. **AI API key:** secret, server-side only.
2. **Your app’s API routes:** visible to the browser, but protected by authentication and authorization.
3. **Users’ notes:** private between accounts, but processed by your infrastructure and selected AI provider when AI is enabled.

**You cannot hide every network endpoint from someone using the app. You can—and must—protect what those endpoints allow.**

OWASP recommends centralized secret storage, least-privilege access, auditing, and lifecycle controls such as rotation and revocation.[31]

### Recommended flow

```text
Phone / tablet / desktop
          │
          │ Authenticated HTTPS request
          ▼
Application backend
   ├── Checks identity and ownership
   ├── Applies quotas and rate limits
   ├── Saves notes and reminders
   └── Calls AI with server-held credentials
          │
          ▼
Chosen AI provider

Separate background worker
   ├── Processes AI extraction jobs
   └── Dispatches confirmed reminder notifications
```

### Where you enter the key

**Best first version:** your hosting provider’s encrypted server-secret settings.

Only you or trusted deployment administrators can change it.

No API-key field inside the user-facing app.

If you later build an owner dashboard, require strong owner authentication and server-side authorization. A hidden `/admin` link alone is not security.

### Example server configuration

```dotenv .env.example
# Server-only configuration.
# Commit placeholders only. Never commit real credentials.

AI_BASE_URL=https://your-approved-provider.example/v1
AI_API_KEY=replace-in-hosting-secret-settings
AI_EXTRACTION_MODEL=your-selected-model
AI_ANSWER_MODEL=your-selected-model

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-secret

WEB_PUSH_VAPID_PUBLIC_KEY=public-subscription-key
WEB_PUSH_VAPID_PRIVATE_KEY=server-only-secret
WEB_PUSH_CONTACT=mailto:support@your-domain.example

APP_ORIGIN=https://your-app.example
AI_MONTHLY_BUDGET_USD=25
```

The VAPID public key is deliberately public. The AI key, service-role key, and VAPID private key are not.

Supabase specifically warns that its service-role credentials bypass row-level security and must remain server-side.[22]

### Spending protection

Because users consume **your** AI account:

- Require authentication for AI requests.
- Enforce per-user and global quotas.
- Limit note size, request frequency, and output tokens.
- Reserve estimated budget before launching concurrent jobs.
- Reconcile against actual usage afterward.
- Stop new AI work when the budget is exhausted.
- Keep manual notes and reminders working.
- Do not let clients choose arbitrary providers, URLs, or expensive models.

**An unexposed key does not prevent abuse of an unprotected AI endpoint.**

---

## 8. Recommended technology stack

For a solo builder, I suggest:

| Layer | Recommendation | Reason |
|---|---|---|
| Web interface | Next.js + TypeScript | One codebase for responsive UI and server routes |
| Styling | Tailwind CSS | Fast, consistent responsive screens |
| Authentication | Supabase Auth | Avoid building account security from scratch |
| Database | Supabase Postgres | Notes, reminders, ownership, and job records together |
| Local drafts | IndexedDB | Recover drafts and queue offline changes |
| Scheduling | Server-side scheduler | Reminders must not depend on an open browser tab |
| Background jobs | Supabase Queues + worker | Durable extraction and dispatch work |
| Push | Standards-based Web Push | Browser subscriptions and service-worker handling |
| Search | Postgres text search first | Avoid unnecessary AI costs and complexity |
| Semantic search later | pgvector or equivalent | Add when testing shows text search is insufficient |

Supabase documents durable Postgres-backed queues and visibility-window delivery behavior.[38] Row-level security provides an additional database-level account boundary when correctly configured and tested.[22]

**Important:** durable queue delivery is not a guarantee that a notification appears on someone’s phone.

### Two alternatives

- **Simpler online-only beta:** the same stack, but postpone full offline editing. Keep draft recovery.
- **Self-hosted setup:** useful if infrastructure control is the priority, but you take on more maintenance, backups, and operations.

**Best path:** managed hosting and database first. Prove the product before taking on extra infrastructure work.

---

## 9. Reminder reliability: the most important engineering work

Do not use a browser timer as the reminder engine.

Use a server-side due-time record and background dispatch.

### Suggested process

1. The user confirms a reminder.
2. The server transaction saves it and its next occurrence.
3. A scheduler regularly selects due occurrences.
4. A worker claims work with a lock or visibility timeout.
5. It rechecks that the reminder is still active and unchanged.
6. It sends to the user’s selected, active device subscriptions.
7. It records the provider response.
8. Temporary failures get bounded retries.
9. Expired subscriptions are disabled.
10. The task remains visible in Today until completed or dismissed.

### Honest status labels

Use:

- Scheduled.
- Queued.
- Accepted by push service.
- Failed.
- Opened.
- Completed.

**Do not label a reminder “Seen” just because a push service accepted it.**

A late retry must also respect an expiry window. An appointment notification arriving hours afterward may be worse than no notification.

### Duplicate protection

Use a unique dispatch identifier based on:

**Reminder + occurrence + device + channel**

Make workers idempotent and use notification tags where supported. Still design for occasional duplicate delivery: retries across distributed systems cannot be treated as perfectly once-only.

### Time zones and recurrence

Store:

- The resolved UTC instant.
- The IANA time-zone name.
- The intended local time for recurring schedules.
- Whether the schedule follows local time or a fixed instant.

“Every day at 8 a.m.” must not accidentally become 7 a.m. after a daylight-saving change.

For monthly reminders, ask what should happen when the requested day does not exist—for example, the 31st in February.

### Quiet hours

- Explicitly chosen reminder times should not be silently moved.
- Warn if a selected time falls within quiet hours.
- Apply quiet hours automatically to optional digests and nonessential suggestions.

### Correction to the earlier advice

I would **not** launch based on notifications arriving only five mornings out of seven.

Also, a calendar export is a **backup option**, not a guaranteed alarm. The user must import it, and the calendar’s own reminder settings matter.

Do not market this as an emergency alarm or guaranteed exact-time alert. Apple’s web notifications participate in system notification controls, including Focus.[1]

---

## 10. Database design

Use separate records for notes, AI suggestions, user-confirmed tasks, and notification attempts.

| Table | Purpose |
|---|---|
| `profiles` | Preferences, locale, time zone |
| `notes` | Original content, ownership, version, timestamps |
| `note_versions` | Recoverable editing history |
| `ai_suggestions` | Proposed actions and source evidence |
| `tasks` | User-approved or manually created actions |
| `reminders` | Notification time, recurrence, enabled state |
| `reminder_occurrences` | Individual scheduled instances |
| `push_subscriptions` | Per-device push endpoints and keys |
| `notification_attempts` | Dispatch results, retries, errors |
| `ai_usage` | Usage and cost metadata, without note content |
| `audit_events` | Sensitive account/admin changes |
| `deletion_jobs` | Tracked cleanup across systems |

Every user-owned record needs account authorization.

**Test actual denial:** User A must not read, update, delete, search, or obtain notification links to User B’s data. Supabase’s RLS guidance explicitly calls for allow-and-deny tests, not just enabling a setting.[22]

---

## 11. Privacy users can understand

A private API key does **not** mean zero-retention AI processing or end-to-end encrypted notes.

For example, OpenAI’s API documentation states that API data is not used for training by default, while abuse-monitoring retention can still apply. Those are different promises.[7]

Your chosen provider’s actual terms must determine the wording.

### Recommended controls

- Let users disable AI processing.
- Explain what content is sent before enabling AI.
- Send only the note or excerpts needed for the requested feature.
- Do not put note bodies in analytics or error logs.
- Default to generic lock-screen messages.
- Protect cached local notes and clear them on sign-out, with a warning about unsynced drafts.
- Define deletion behavior for notes, extracted data, embeddings, jobs, and backups.
- Keep public sharing out of version one.
- Sanitize rendered note content and apply a restrictive content security policy.

Do not advertise “only you can read your notes” if your backend and AI provider process plaintext.

True end-to-end encryption would require a different design and would complicate server-side AI features.

---

## 12. Costs and business model

### AI cost example—not a provider quote

Assume:

- 1,000 monthly active users.
- 100 note extractions per user monthly.
- 20 AI questions per user monthly.
- Extraction: 800 input and 200 output tokens.
- Question: 3,000 input and 400 output tokens.

Calculated totals:

| Item | Monthly total |
|---|---:|
| Input tokens | 140 million |
| Output tokens | 28 million |

At **hypothetical** rates of $0.50/million input and $2/million output:

**140 × $0.50 + 28 × $2 = $126/month**

That is approximately **$0.126 per active user for those text-model calls only**.

It excludes hosting, database, authentication email, embeddings, transcription, retries, monitoring, support, and payment fees. Actual costs depend on the selected model and real note lengths.

### Keep costs controlled

- Analyze after save—not every keystroke.
- Reuse results for unchanged note versions.
- Generate digests from structured tasks without AI where possible.
- Start with text search.
- Limit transcription and document processing separately.
- Use AI only when it adds value.

### Three pricing approaches

| Approach | Assessment |
|---|---|
| **Free manual notes/reminders + paid AI allowance** | **Recommended:** understandable and keeps core records usable |
| One subscription with a clear fair-use allowance | Simpler marketing; requires careful usage monitoring |
| Pay-per-AI-action | Precise, but may make people hesitate before capturing a thought |

Do not promise unlimited AI until you have real usage data.

---

## 13. Build in phases, with acceptance gates

### Phase 1 — dependable notes and manual reminders

Build:

- Accounts.
- Note capture and draft recovery.
- Task creation.
- Today and Upcoming.
- Server-side scheduling.
- Push setup and test notification.
- Done, snooze, reschedule.
- Export and deletion.

**Gate:** manual reminders work without any AI service.

### Phase 2 — confirm-and-remind AI

Add:

- Background extraction.
- Source quotes.
- Date clarification.
- Review screen.
- Explicit confirmation.
- Version handling.
- Quotas and cost monitoring.

**Gate:** AI cannot schedule reminders without an authenticated confirmation action.

### Phase 3 — useful daily habits

Add:

- Simple recurring reminders.
- Optional morning digest.
- Calendar export.
- Better offline synchronization.
- Grounded questions about notes.

**Gate:** these features improve use without making capture slower.

### Phase 4 — expand only from evidence

Possible additions:

- Voice transcription.
- Attachments.
- Mechanic or tradesperson templates.
- Household sharing.

Do not start all four together.

---

## 14. What to test before release

| Area | Must pass |
|---|---|
| Data isolation | Another user’s IDs never reveal or alter their records |
| Secrets | No secret in frontend bundles, source maps, logs, or browser responses |
| AI outage | Notes and manual reminders continue working |
| Wrong dates | Ambiguous dates require review |
| Stale jobs | Old AI results cannot overwrite newer note versions |
| Scheduling | Confirming twice does not create duplicate reminders |
| Cancellation | Cancelled reminders are rechecked before dispatch |
| Recurrence | DST, month-end, and time-zone cases behave as documented |
| Push | iPhone Home Screen, Android, and desktop tested on real devices |
| Offline | Unsynced reminders never appear falsely scheduled |
| Deletion | Notes and derived records follow the published deletion policy |
| Recovery | Backup restoration is actually tested |
| Abuse | Rate limits and global spending controls hold under concurrent requests |

Track dispatch latency separately from visible notification arrival. A server can measure its own work much more reliably than whether the person saw an alert.

---

## 15. Your next three concrete steps

### 1. Create a real test set

Write 30–50 notes from everyday life:

- Rent.
- Calls.
- Family appointments.
- Parts orders.
- French study.
- Grocery errands.
- Completed events.
- Ambiguous dates.
- Notes containing no tasks.

Label the expected tasks and dates yourself.

### 2. Build the non-AI foundation first

Get **save → manual reminder → server dispatch → open → complete** working across your phone and laptop.

If that fails, AI will only make the failure more complicated.

### 3. Add extraction and test with a small group

Have 5–10 people use it for two weeks.

Measure:

- Whether they save a real note.
- Whether they confirm a useful suggestion.
- How often suggestions need correction.
- Whether they return without prompting.
- Whether reminders help them complete something.
- Whether anyone loses a note or receives an unwanted alert.

These are validation targets, not evidence that demand already exists.

---

## Copy-ready build brief

```text Confirm-and-Remind-build-brief.txt
Build a responsive installable notes-and-reminders web app called
Confirm & Remind.

Core promise:
Write it down. Confirm what matters. Get reminded.

Users:
Individuals managing bills, calls, appointments, errands, and everyday notes.

Non-negotiable behavior:
1. Save original notes before any AI processing.
2. AI suggests actions but cannot schedule them.
3. Every AI suggestion shows an exact supporting quote.
4. Require explicit user confirmation for scheduling.
5. Keep task due dates separate from reminder notification times.
6. Preserve manual notes and reminders when AI is unavailable.
7. Never show "Scheduled" before server acknowledgment.
8. Keep all AI provider secrets server-side.
9. Users cannot configure provider URLs, model IDs, or API keys.
10. Enforce authentication, ownership checks, quotas, and spending limits.
11. Keep reminders visible in-app regardless of push status.
12. Do not claim guaranteed notification delivery or end-to-end encryption.

Suggested stack:
Next.js, TypeScript, Tailwind, Supabase Auth and Postgres,
IndexedDB draft recovery, durable background queues,
server-side scheduling, and standards-based Web Push.

Screens:
Today, Notes, Review, Upcoming, Settings.

Build order:
A. Accounts, notes, manual reminders, push, export, deletion.
B. AI extraction, clarification, confirmation, usage limits.
C. Recurrence, digest, calendar export, grounded note questions.

Require automated authorization and scheduling tests,
plus real-device notification tests before public release.
```

### Bottom line

**Build a trustworthy notes app that helps people remember—not a chatbot with a notes tab.**

Your private API setup is straightforward. The harder—and more valuable—work is **saving reliably, interpreting dates carefully, confirming clearly, and scheduling honestly**.

The research supports technical feasibility. What remains unproven is whether people will form the habit and pay for it; the small beta should answer that before you expand.