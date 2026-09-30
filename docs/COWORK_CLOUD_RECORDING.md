# Co-Work cloud meeting recordings

Zoom-style recordings are produced on the **mediasoup server** (EC2): a recorder on the SFU host composes the room (audio + video) and encodes one MP4 with ffmpeg, so the result is identical on web, Android, and iOS. Device-local `MediaRecorder` / `expo-audio` are not used for production Co-Work recordings.

Recordings are stored in **Supabase Storage** — the private `meeting-recordings` bucket in the `sheconomy_db` project. The recorder uploads the finished MP4 through a short-lived signed upload URL issued by the `mediasoup-recording` function; playback/download links are short-lived Supabase signed URLs.

## Storage layout

- Bucket: `meeting-recordings` (private; no client RLS policies — access only via Edge Functions)
- Object key: `meetings/{meetingId}/{uuid}.mp4` (stored on the `meeting_recordings` row)
- Playback links: Supabase signed URLs (~30 min); download links (~60 min) with attachment disposition

## Flow

1. Host taps **Record** → client calls `mediasoup-recording` `{ action: 'start', meetingId, roomName }`.
2. The function inserts a `meeting_recordings` row (`starting`) and calls the server admin API `record/start` `{ room: 'sc_<roomName>', recordingId }` → row becomes `recording`.
3. Host stops (or the room closes) → `record/stop` `{ recordingId }` → row becomes `processing`.
4. When the MP4 is encoded the recorder calls back `server-event`:
   - `upload-url` → `{ uploadUrl }` (PUT the file, `Content-Type: video/mp4`)
   - `ready` with `durationSeconds`, `sizeBytes` → row becomes `ready`
   - `failed` with `error` → row becomes `failed`
5. While a row is `starting` / `recording` / `processing`, the host client polls `action: 'reconcile'`, which asks `record/status` and fails rows the recorder no longer knows about.

## Server admin API (mediasoup host)

All calls are `POST https://<mediasoup host>/admin/<path>` with `Authorization: Bearer <JWT>`, where the JWT is HS256 with `MEDIASOUP_JWT_SECRET` and claims `{ adm: true, path, iat, exp: iat + 60 }`. Responses are JSON; `404` means the room / recording is already gone.

| Path | Body | Purpose |
| --- | --- | --- |
| `kick` | `{ room, user }` | Close every peer of a removed participant |
| `close` | `{ room }` | Close the room when the host ends the meeting |
| `record/start` | `{ room, recordingId }` | Start the composite recorder |
| `record/stop` | `{ recordingId }` | Stop and finalize (encode + upload) |
| `record/status` | `{ recordingId }` | `{ state: 'recording' \| 'processing' \| 'uploading' \| 'ready' \| 'failed', error? }` |

Recorder callbacks go to `https://<project-ref>.supabase.co/functions/v1/mediasoup-recording` with body `{ action: 'server-event', event, recordingId, token, ... }`, where `token` is an HS256 JWT `{ adm: true, rec: recordingId, iat, exp: iat + 60 }` signed with the same secret.

## Required secrets (Supabase Edge Functions)

Set these in the Supabase project secrets (never commit values):

| Secret | Purpose |
| --- | --- |
| `MEDIASOUP_URL` | Signalling URL (`wss://host:port`); the admin API uses the same host over `https` |
| `MEDIASOUP_JWT_SECRET` | Shared with the mediasoup server (join tokens, admin API, recorder callbacks) |
| `MEDIASOUP_RECORDING_ENABLED` | Optional; `false` hides cloud recording |
| `MEETING_RECORDINGS_BUCKET` | Optional bucket override (defaults to `meeting-recordings`) |
| `PUBLIC_APP_URL` | Canonical web origin for share links |

> Note: check the project's global upload file-size limit (Dashboard → Storage settings). Long video recordings produce large MP4s; raise the limit if uploads fail near the cap.

## Deploy functions

```bash
supabase functions deploy mediasoup-token
supabase functions deploy mediasoup-recording --no-verify-jwt
supabase functions deploy meeting-recording-share --no-verify-jwt
```

The legacy `livekit-*` functions stay deployed for store builds on runtime 6.0.x; they are no longer in the repo.

## Host UX

1. Host taps **Record** → the server recorder starts.
2. Participants see a **REC** indicator / notice.
3. Host stops recording (or ends the meeting) → status becomes `processing`.
4. When ready, host opens **Meeting recordings** → Share / Copy / Download / Revoke.
5. Shared URL: `/co-work/recording/<token>` (token stored hashed; revoking invalidates the link).
