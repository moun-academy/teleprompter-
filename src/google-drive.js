const GOOGLE_DOC = "application/vnd.google-apps.document";
const TEXT_TYPES = [
  GOOGLE_DOC,
  "text/plain",
  "text/markdown",
  "application/rtf"
];

let pickerPromise;
let gisPromise;

function loadScript(src, id) {
  const existing = document.getElementById(id);
  if (existing) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadPicker() {
  if (!pickerPromise) {
    pickerPromise = loadScript("https://apis.google.com/js/api.js", "google-api-loader").then(
      () => new Promise((resolve) => window.gapi.load("picker", { callback: resolve }))
    );
  }
  return pickerPromise;
}

async function loadIdentity() {
  if (!gisPromise) {
    gisPromise = loadScript("https://accounts.google.com/gsi/client", "google-identity-loader");
  }
  return gisPromise;
}

async function getAccessToken(clientId) {
  await loadIdentity();
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      prompt: "",
      callback: (response) => {
        if (response.error) reject(new Error(response.error_description || response.error));
        else resolve(response.access_token);
      },
      error_callback: (error) => reject(new Error(error.message || error.type || "Google sign-in was cancelled"))
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

function showPicker({ apiKey, appId, accessToken }) {
  return new Promise((resolve, reject) => {
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
      .setMimeTypes(TEXT_TYPES.join(","))
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const picker = new window.google.picker.PickerBuilder()
      .setDeveloperKey(apiKey)
      .setOAuthToken(accessToken)
      .setAppId(appId)
      .setTitle("Choose a script from Google Drive")
      .addView(view)
      .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
      .setCallback((data) => {
        const action = data[window.google.picker.Response.ACTION];
        if (action === window.google.picker.Action.PICKED) resolve(data[window.google.picker.Response.DOCUMENTS][0]);
        if (action === window.google.picker.Action.CANCEL) reject(new DOMException("Picker closed", "AbortError"));
      })
      .build();
    picker.setVisible(true);
  });
}

async function downloadFile(document, accessToken) {
  const id = document[window.google.picker.Document.ID];
  const name = document[window.google.picker.Document.NAME] || "Google Drive script";
  const mimeType = document[window.google.picker.Document.MIME_TYPE];
  const encodedId = encodeURIComponent(id);
  const endpoint = mimeType === GOOGLE_DOC
    ? `https://www.googleapis.com/drive/v3/files/${encodedId}/export?mimeType=text%2Fplain`
    : `https://www.googleapis.com/drive/v3/files/${encodedId}?alt=media`;

  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google Drive returned ${response.status}: ${details.slice(0, 140)}`);
  }

  return { id, name, mimeType, text: await response.text() };
}

export async function pickGoogleDriveScript(config) {
  const { googleClientId: clientId, googleApiKey: apiKey, googleAppId: appId } = config;
  if (!clientId || !apiKey || !appId) {
    throw new Error("Google Drive setup is incomplete. Add the Client ID, API key, and project number in Settings.");
  }

  await Promise.all([loadPicker(), loadIdentity()]);
  const accessToken = await getAccessToken(clientId);
  const document = await showPicker({ apiKey, appId, accessToken });
  return downloadFile(document, accessToken);
}
