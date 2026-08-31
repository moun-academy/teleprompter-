# Promptly Teleprompter

Promptly is an installable, offline-ready teleprompter PWA. The phone runs the prompt and a laptop controls it through a direct WebRTC data connection.

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
4. The laptop now controls the phone. The connection uses PeerJS for signaling and WebRTC for the live control channel.

For higher-traffic or private infrastructure, point `src/remote-link.js` at a self-hosted PeerServer.
