# Uploading a lesson video to Mux

How to get a lesson video from your laptop onto the Ailemy lesson page. No code,
no API — just dashboard work. Roughly 2 minutes per lesson plus encoding time.

This is the manual workflow used until we ship the admin upload UI. The signed
direct-upload API route (`POST /api/mux/upload-url`) and the asset.ready
webhook are deliberately not built yet — they ride with the admin panel in a
later session.

## Prerequisites

- A Mux account (https://dashboard.mux.com).
- The lesson row already exists in Supabase (see `supabase/seed/`). You need
  the lesson's `slug` to find the row again later.
- `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` set in your local `.env.local` and in
  Vercel project settings. (Only needed once you start using the server-side
  Mux client — playback alone doesn't require them.)

## Workflow

1. **Open Mux dashboard → Video → Assets**.
2. Click **New asset** (top right) → **Direct upload**.
3. Drag the lesson video file into the upload area, or click to browse.
4. Mux uploads, then queues the asset for encoding. Wait for the status to
   change to **Ready**. For a 5-minute lesson at 1080p this typically takes
   ~30 seconds; longer lessons proportionally longer.
5. Click into the asset. In the **Playback IDs** section you'll see one
   default ID in UUID format (something like
   `5pXMR01yo1xxYRevsuEexyEpa017lc026Bv...`). Copy it. Make sure the policy
   is **Public** (free Lesson 1 content does not need signed playback).
6. **Open Supabase Studio → Table Editor → `lessons`**.
7. Filter or search for the lesson's `slug` (e.g.
   `definitions-formulae-and-the-mole`).
8. Paste the Playback ID into the `voice_video_mux_id` column. Save.
9. Refresh the lesson page on app.ailemy.com (or `localhost:3000` in dev).
   The `VideoPlaceholder` is replaced by the `MuxLessonPlayer` and the video
   plays. Mux Data starts recording views automatically — no extra wiring.

## Replacing or removing a video

- **Replace**: upload a new asset in Mux, copy the new Playback ID, paste it
  over the old value in Supabase. The old Mux asset is orphaned but harmless;
  delete it in the Mux dashboard if you want to clean up.
- **Remove**: clear the `voice_video_mux_id` cell in Supabase. The lesson
  page falls back to the "Video coming soon" placeholder automatically.

## What's stored where

| Thing                 | Lives in                          |
| --------------------- | --------------------------------- |
| The video file itself | Mux (we don't store originals)    |
| Playback ID (UUID)    | `lessons.voice_video_mux_id`      |
| Thumbnail / poster    | `image.mux.com/<id>/thumbnail.jpg` (generated on demand by the player) |
| View analytics        | Mux Data dashboard                |

The Ailemy database stores only the playback pointer. Mux owns the bytes.

## Future automation

When the admin panel ships:

- `POST /api/mux/upload-url` will return a Mux direct-upload URL so editors
  can drag-and-drop from inside Ailemy.
- A webhook handler at `POST /api/mux/webhook` will listen for
  `video.asset.ready` events and write the playback ID into
  `lessons.voice_video_mux_id` without anyone copy-pasting.

Until then, the manual workflow above is the supported path.
