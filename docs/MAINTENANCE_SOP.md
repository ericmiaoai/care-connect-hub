# CareSync — Maintenance & Update SOP

This document defines standard operating procedures for maintaining, updating,
and troubleshooting the CareSync application. It is intended for developers
and administrators responsible for keeping the app running reliably.

---

## 1. AI Model Updates (Gemini)

### Why this needs attention
Google periodically deprecates older Gemini model versions and releases
improved ones. When a model is deprecated, the Scan AVS feature will return
a 502 error until the model name is updated.

### How to update — no code change required

The model name is controlled entirely by an environment variable. When Google
releases a new model:

**Local development:**
1. Open `.env` in the project root
2. Update the value: `GEMINI_MODEL=gemini-X.X-flash` (new model name)
3. Restart `netlify dev`

**Production (Netlify):**
1. Log in to [app.netlify.com](https://app.netlify.com)
2. Navigate to: Site → Site Settings → Environment Variables
3. Find `GEMINI_MODEL` and update its value to the new model name
4. Click **Save** — takes effect immediately on the next function invocation

**Fallback default:** If `GEMINI_MODEL` is not set, the app falls back to
`gemini-2.5-flash` (defined in `netlify/functions/process-avs.ts` line ~32).

### How to verify the current model name
Check [Google AI Studio models](https://ai.google.dev/gemini-api/docs/models)
for the current list of supported models. Look for the latest `flash` variant
for the best cost/performance balance.

### Files involved
| File | What it does |
|---|---|
| `netlify/functions/process-avs.ts` | Reads `GEMINI_MODEL` env var, falls back to hardcoded default |
| `.env` | Local development model override |
| Netlify dashboard | Production model override |

---

## 2. Gemini API Key Rotation

### When to rotate
- Suspected key compromise
- Staff/developer offboarding
- Google-recommended rotation schedule (annually as best practice)

### How to rotate

1. Go to [Google AI Studio](https://aistudio.google.com) → API Keys
2. Generate a new key
3. **Before deleting the old key**, update both environments:

**Local:**
- Open `.env`
- Replace `CARESYNC_GEMINI_KEY=` value with the new key

**Production (Netlify):**
- Site Settings → Environment Variables → `CARESYNC_GEMINI_KEY`
- Update value → Save

4. Verify Scan AVS works with the new key
5. Delete the old key in Google AI Studio

> **Why `CARESYNC_GEMINI_KEY` and not `GEMINI_API_KEY`?**
> Netlify automatically injects its own `GEMINI_API_KEY` variable for its
> managed AI service, which would override a standard name. The `CARESYNC_`
> prefix avoids this collision.

---

## 3. npm Package Updates

### Frequency
- Review monthly or before any major feature release
- Always update before a public launch

### Commands
```bash
# Check for outdated packages
npm outdated

# Update all packages within their declared semver range
npm update

# Check for security vulnerabilities
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix
```

### High-priority packages to watch
| Package | Why it matters |
|---|---|
| `@google/generative-ai` | Gemini SDK — new models may require newer SDK versions |
| `@supabase/supabase-js` | Auth and database client — security patches are critical |
| `@netlify/functions` | Serverless function types — update when deploying new functions |

### After updating
Always run `npx tsc --noEmit` to verify no TypeScript errors were introduced,
then test Scan AVS end-to-end before deploying.

---

## 4. Profile Photo Storage (Supabase Storage)

### One-time setup required before this feature works in production
The profile photo upload feature requires an `avatars` bucket in Supabase Storage.
This must be created manually in the Supabase dashboard — it is NOT created
automatically by the app.

**Steps (one-time, per environment):**

**Part A — Create the bucket:**
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New bucket**
4. Name it exactly: `avatars`
5. Toggle **Public bucket** → ON
6. Click **Save**

**Part B — Add policies via SQL Editor:**
> Do NOT use the Storage policy UI — it changes frequently and fields may
> be missing. The SQL Editor is reliable and always works.

1. Left sidebar → **SQL Editor** → **New query**
2. Paste and run the following:

```sql
-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name = (auth.uid()::text || '.jpg')
);

-- Allow authenticated users to overwrite their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND name = (auth.uid()::text || '.jpg')
)
WITH CHECK (
  bucket_id = 'avatars'
  AND name = (auth.uid()::text || '.jpg')
);

-- Allow public read (required for getPublicUrl to work)
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

3. Confirm all three policies appear under **Storage → avatars → Policies**

**File path pattern:** `avatars/{userId}.jpg`
Each user has exactly one file named after their UUID. Uploading a new
photo overwrites the previous one automatically (`upsert: true`).

### Photo upload flow
Users tap their avatar circle in Settings to upload a new photo. The app:
1. Validates the file (rejects HEIC on desktop, rejects files over 15 MB)
2. Compresses and centre-crops to 256×256 JPEG in the browser (no server cost)
3. Shows a confirmation preview dialog — user must tap "Use Photo" to commit
4. Uploads to Supabase Storage, updates the `profiles.avatar_url` column
5. Fires a `caresync:profile-updated` browser event that refreshes avatars
   everywhere in the app simultaneously (sidebar, header, member list, updates)

### HEIC support
- iOS devices auto-convert HEIC to JPEG when selecting from the camera roll
  on a mobile browser — no extra handling needed for the primary use case
- Desktop users with HEIC files receive a friendly error message guiding
  them to convert to JPEG first (via iPhone camera roll or Mac Preview)
- `heic2any` library is intentionally NOT used — untested without an iPhone
  and adds complexity for a rare edge case. Re-evaluate for v2.0.

### Storage limits
- Supabase free tier: 1GB total storage
- Average compressed avatar: ~30–50KB (256×256 JPEG)
- 1GB supports ~20,000+ users before any storage cost
- Each upload overwrites the previous file — no accumulation over time

---

## 5. Supabase Maintenance

### Environment variables (four required)
| Variable | Used by | Where set |
|---|---|---|
| `VITE_SUPABASE_URL` | React app (browser) | `.env` + Netlify |
| `VITE_SUPABASE_ANON_KEY` | React app (browser) | `.env` + Netlify |
| `SUPABASE_URL` | Netlify function (server) | `.env` + Netlify |
| `SUPABASE_ANON_KEY` | Netlify function (server) | `.env` + Netlify |

> The `VITE_` prefix makes a variable accessible in the browser bundle.
> Variables without it are server-only and never exposed to users.

### Supabase project URL/key change
If the Supabase project is migrated or recreated, all four variables above
must be updated in both `.env` and the Netlify dashboard simultaneously.
Also re-run the full `schema.sql` and re-create the `avatars` storage bucket
(Section 4) in the new project.

### Row Level Security (RLS)
RLS policies must be verified any time the database schema changes. A
misconfigured RLS policy could expose one user's care data to another.
Verify policies in: Supabase Dashboard → Authentication → Policies.

**Policies added post-launch (already in schema.sql as of v1.1):**
- `profiles: read circle peers` — allows users to read profiles of care circle
  co-members. Required for member names, avatars, and "completed by" labels to
  display correctly for other users.
- `members: admin can update` — allows admins to change member roles. Without
  this, the role dropdown in Settings silently does nothing.

### Realtime configuration
Four tables must be enrolled in the `supabase_realtime` publication for
live cross-device sync to work. This is handled in `schema.sql` Section 7,
but if you ever need to re-apply it manually:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.care_circle_members;
ALTER TABLE public.care_circle_members REPLICA IDENTITY FULL;
```

> `REPLICA IDENTITY FULL` on `care_circle_members` is required so that
> filtered subscriptions on `user_id` (non-primary-key column) receive
> UPDATE events correctly. Without it, role change notifications don't
> reach the affected user.

> **Supabase dashboard replication UI:** The UI for managing replication
> table enrollment is unreliable and changes between dashboard versions.
> Always use the SQL Editor for this configuration.

> **Supabase Storage policy UI:** Similarly, the Storage policy editor UI
> is unreliable. Always use the SQL Editor (see Section 4).

---

## 6. Deployment Checklist (Netlify)

Before every production deployment, verify:

- [ ] `npm run build` completes without errors locally
- [ ] `npx tsc --noEmit` returns no TypeScript errors
- [ ] Scan AVS works end-to-end in `netlify dev` locally
- [ ] Profile photo upload works and confirmation dialog appears
- [ ] Role change in Settings persists after page reload (both users)
- [ ] All required env vars are set in Netlify dashboard:
  - `CARESYNC_GEMINI_KEY`
  - `GEMINI_MODEL`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `APP_URL` (set to the live Netlify domain to restrict CORS)
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## 7. Local Development Setup (New Developer Onboarding)

```bash
# 1. Clone the repository
git clone https://github.com/ericmiaoai/caresync
cd caresync

# 2. Install dependencies
npm install

# 3. Create .env from this template
# (obtain actual values from the project lead)
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon key]
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[anon key]
CARESYNC_GEMINI_KEY=[gemini api key]
GEMINI_MODEL=gemini-2.5-flash
VITE_VLM_PROVIDER=api

# 4. Install Netlify CLI
npm install -g netlify-cli

# 5. Start the full local dev environment (app + functions)
netlify dev

# 6. Open http://localhost:8888
```

### One-time Supabase setup (new project only)
If setting up against a brand-new Supabase project:
1. Run `supabase/schema.sql` in the SQL Editor
2. Run `supabase/create_care_circle_fn.sql` in the SQL Editor
3. Run `supabase/add_completion_fields.sql` in the SQL Editor
4. Create the `avatars` storage bucket (Section 4 of this document)

---

## 8. Known Maintenance Triggers

| Event | Action required |
|---|---|
| Google deprecates current Gemini model | Update `GEMINI_MODEL` env var (Section 1) |
| `@google/generative-ai` releases new major version | Update package, test Scan AVS |
| Supabase rotates anon key | Update all four Supabase env vars |
| New developer joins team | Follow Section 7 onboarding |
| Netlify free tier limit approached | Review usage or upgrade plan |
| iOS major update | Test Scan AVS camera capture + profile photo upload on iPhone |
| Android major update | Test Scan AVS camera capture + profile photo upload on Android |
| New Supabase project created | Re-run all SQL files, re-create avatars bucket (Section 4) |
| HEIC support needed on desktop | Evaluate `heic2any` library — requires iPhone for testing |
| Member role changes not persisting | Verify `members: admin can update` RLS policy exists (Section 5) |
| Member names/avatars showing as blank | Verify `profiles: read circle peers` RLS policy exists (Section 5) |
| Role change not reflecting without refresh | Verify `care_circle_members` is in realtime publication (Section 5) |
| Realtime sync stops working | Re-run Section 7 realtime configuration SQL |

---

*Last updated: May 2026 — CareSync v1.1*
