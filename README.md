# Promptly Teleprompter

Promptly is an installable, offline-ready teleprompter PWA. The phone runs the prompt and a laptop controls it through a Supabase Realtime cloud relay.

## Included

- Smooth, frame-timed scrolling with adjustable speed, text size, line spacing, and width
- Horizontal and vertical mirror modes for beam-splitter glass
- Laptop remote for play/pause, 5-second moves, restart, position, speed, and font size
- Simple Word (`.docx`), text, and Markdown import from Google Drive, OneDrive, or local storage
- Local script library, auto-save, countdown, fullscreen, and screen wake lock
- PWA manifest and offline app shell

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

## Import a script

Choose **Word, Drive or OneDrive**. The normal device file picker opens:

- On a phone, choose Google Drive, OneDrive, or Files from the picker. Install the relevant Drive/OneDrive phone app if it is not listed.
- On a laptop, choose a synced OneDrive/Google Drive folder or a local file.
- Modern Word `.docx`, `.txt`, `.md`, and `.rtf` files are accepted. Older binary `.doc` files must first be saved as `.docx` in Word.

The selected document is read locally in the browser. There is no Google OAuth setup and the file is not uploaded to Promptly.

## Build

```powershell
npm.cmd run build
npm.cmd run preview
```

Deploy the `dist` output to any HTTPS host. On Android, open the URL in Chrome and choose **Install app** or **Add to Home screen**.

## Remote control

1. On the phone, open a script and tap **Start prompting**. The phone creates and shows a six-character code.
2. On the laptop, open the same Promptly URL and choose **Remote**.
3. Enter the phone's code on the laptop. Do not open the code-entry screen on both devices.
4. The laptop now controls the phone through the shared Promptly cloud room. Both devices need internet, but they do not need the same Wi-Fi.

The laptop is only marked connected after the phone answers. Heartbeats detect interruptions, and important control messages retry safely until the phone confirms them.

## Remote availability and recovery

Supabase's free projects can pause after a week of low database activity, even
when the frontend still loads. Resume the existing project in Supabase Dashboard
if it is already paused. Retrying in the app cannot resume a paused server.

This project now deploys a daily Vercel Cron to `/api/remote-health`. It uses the
server-only `RELAY_POSTGRES_URL` (or existing `POSTGRES_URL`) to execute three `SELECT 1` queries. It reads no
scripts or user records. A failed check returns HTTP 503 without leaking database
details. The service worker never caches API requests. Regular database activity
reduces inactivity pauses; the free plan still has no uptime guarantee.

When replacing an unavailable relay, connect the replacement through Vercel with
the `RELAY_` prefix. The build prioritizes `RELAY_SUPABASE_URL` and
`RELAY_SUPABASE_PUBLISHABLE_KEY` / `RELAY_SUPABASE_ANON_KEY`. The previous integration
can remain connected without overwriting its variables. Database passwords and
service-role keys are never included in the browser bundle.

The phone keeps the same code while retrying, and retries on a restored network
or when returning to the app. The laptop disables controls during an interruption
and receives a fresh state snapshot when the phone answers again. Controls sent
while disconnected are rejected rather than replayed unexpectedly later.

The separate MOUN app previously on GitHub main is preserved at
`legacy/moun-teleprompter.html`; Promptly remains the primary app.
