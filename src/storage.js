const LIBRARY_KEY = "promptly.library.v1";
const SETTINGS_KEY = "promptly.settings.v1";
const ACTIVE_KEY = "promptly.active-script.v1";

export const sampleScript = {
  id: "welcome-script",
  title: "Welcome to Promptly",
  body: `Take a breath.

Look into the lens, and let the words come to you.

Promptly keeps your script moving at your pace. You can pause from your laptop, move back a few lines, change the speed, or jump to the beginning without touching your phone.

When you are ready, replace this sample with your own script, connect Google Drive, and start speaking with confidence.`,
  source: "sample",
  updatedAt: Date.now()
};

const defaultSettings = {
  speed: 70,
  fontSize: 52,
  lineHeight: 1.5,
  textWidth: 78,
  countdown: 3,
  mirrorX: false,
  mirrorY: false,
  cueLine: true,
  theme: "black",
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || "",
  googleAppId: import.meta.env.VITE_GOOGLE_APP_ID || ""
};

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function getLibrary() {
  const library = read(LIBRARY_KEY, []);
  return Array.isArray(library) && library.length ? library : [sampleScript];
}

export function saveScript(script) {
  const library = getLibrary();
  const next = { ...script, updatedAt: Date.now() };
  const index = library.findIndex((item) => item.id === next.id);
  if (index >= 0) library[index] = next;
  else library.unshift(next);
  write(LIBRARY_KEY, library);
  write(ACTIVE_KEY, next.id);
  return next;
}

export function deleteScript(id) {
  const library = getLibrary().filter((item) => item.id !== id);
  write(LIBRARY_KEY, library.length ? library : [sampleScript]);
}

export function getActiveScript() {
  const library = getLibrary();
  const activeId = read(ACTIVE_KEY, library[0]?.id);
  return library.find((item) => item.id === activeId) || library[0] || sampleScript;
}

export function setActiveScript(id) {
  write(ACTIVE_KEY, id);
}

export function getSettings() {
  return { ...defaultSettings, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  return write(SETTINGS_KEY, { ...getSettings(), ...settings });
}

export function makeId(prefix = "script") {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatRelativeDate(timestamp) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
