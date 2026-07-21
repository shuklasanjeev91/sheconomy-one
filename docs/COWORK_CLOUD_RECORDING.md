# Co-Work cloud meeting recordings

Zoom-style recordings use **LiveKit RoomComposite Egress** so one server-side MP4 captures the full room (audio + video) on web, Android, and iOS. Device-local `MediaRecorder` / `expo-audio` are not used for production Co-Work recordings.

Recordings are stored in **Supabase Storage** — the private `meeting-recordings` bucket in the `sheconomy_db` project — not in an external S3 bucket. LiveKit Egress uploads through Supabase's S3-compatible endpoint (`{SUPABASE_URL}/storage/v1/s3`), and playback/download links are short-lived Supabase signed URLs.

## Storage layout

- Bucket: `meeting-recordings` (private; no client RLS policies — access only via Edge Functions)
- Object key: `meetings/{meetingId}/{recordingId}.mp4`
- Playback links: Supabase signed URLs (~30 min); download links (~60 min) with attachment disposition

## Required secrets (Supabase Edge Functions)

Set these in the Supabase project secrets (never commit values):

| Secret | Purpose |
| --- | --- |
| `LIVEKIT_URL` | LiveKit WebSocket / API host |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit auth + webhook verification |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY` | Supabase Storage S3 access keys used by LiveKit Egress to upload into the bucket. Create them in Dashboard → Project Settings → Storage → S3 access keys. |
| `SUPABASE_STORAGE_REGION` | Project region for the S3 protocol (defaults to `ap-south-1`) |
| `MEETING_RECORDINGS_BUCKET` | Optional bucket override (defaults to `meeting-recordings`) |
| `PUBLIC_APP_URL` | Canonical web origin for share links |

Signed playback/download URLs are generated with the service role key (already available to Edge Functions) — no external cloud credentials are involved.

> Note: check the project's global upload file-size limit (Dashboard → Storage settings). Long video recordings produce large MP4s; raise the limit if egress uploads fail near the cap.

## Webhook

In LiveKit Cloud (or self-hosted config), point webhooks at:

`https://<project-ref>.supabase.co/functions/v1/livekit-egress-webhook`

Events used: `egress_started`, `egress_updated`, `egress_ended`.

If a webhook is delayed, the host client calls `livekit-recording` with `action=reconcile` on a short poll while status is `starting` / `recording` / `processing`.

## Deploy functions

```bash
supabase functions deploy livekit-recording
supabase functions deploy livekit-egress-webhook --no-verify-jwt
supabase functions deploy meeting-recording-share --no-verify-jwt
```

## Host UX

1. Host taps **Record** → RoomComposite egress starts.
2. Participants see a **REC** indicator / notice.
3. Host stops recording (or ends the meeting) → status becomes `processing`.
4. When ready, host opens **Meeting recordings** → Share / Copy / Download / Revoke.
5. Shared URL: `/co-work/recording/<token>` (token stored hashed; revoking invalidates the link).
