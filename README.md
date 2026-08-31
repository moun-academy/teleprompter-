# Promptly Teleprompter

Promptly is an installable, offline-ready teleprompter PWA. The phone runs the prompt and a laptop controls it through a direct WebRTC data connection.

## Included

- Smooth, frame-timed scrolling with adjustable speed, text size, line spacing, and width
- Horizontal and vertical mirror modes for beam-splitter glass
- Laptop remote for play/pause, 5-second moves, restart, position, speed, and font size
- Google Drive Picker for Google Docs and text scripts using per-file access
- Local script library, text/Markdown uploads, auto-save, countdown, fullscreen, and screen wake lock
- PWA manifest and offline app shell

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

## Enable Google Drive

Google requires each deployed web app to use its own Google Cloud browser credentials.

1. In Google Cloud Console, enable **Google Drive API** and **Google Picker API**.
2. Configure the OAuth consent screen.
3. Create an **OAuth 2.0 Client ID** of type **Web application** and add the deployed HTTPS URL to **Authorized JavaScript origins**.
4. Create an API key restricted to the deployed domain and the Drive/Picker APIs.
5. Copy the Google Cloud project number.
6. Add the three values to `.env.local` using `.env.example`, or enter them in Promptly under **Settings**.

Promptly requests the `drive.file` scope. This only grants access to files the user explicitly opens with the app.

## Build

```powershell
npm.cmd run build
npm.cmd run preview
```

Deploy the `dist` output to any HTTPS host. On Android, open the URL in Chrome and choose **Install app** or **Add to Home screen**.

## Remote control

1. Start prompting on the phone and note the six-character code at the top.
2. Open the same deployed Promptly URL on the laptop and choose **Remote**.
3. Enter the code. The connection uses PeerJS for signaling and WebRTC for the live control channel.

For higher-traffic or private infrastructure, point `src/remote-link.js` at a self-hosted PeerServer.
