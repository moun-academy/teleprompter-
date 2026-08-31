import "./styles.css";
import {
  deleteScript,
  formatRelativeDate,
  getActiveScript,
  getLibrary,
  getSettings,
  makeId,
  saveScript,
  saveSettings,
  setActiveScript
} from "./storage.js";
import { cleanSessionCode, connectRemote, createStageSession } from "./remote-link.js";
import { pickGoogleDriveScript } from "./google-drive.js";

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");

let activeScript = getActiveScript();
let settings = getSettings();
let installPrompt = null;
let stageController = null;
let sessionController = null;
let saveTimer = null;

const icons = {
  logo: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="8" fill="currentColor" opacity=".12"/><path d="M9 10h14M9 15h10M9 20h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="22" cy="24" r="2.6" fill="#ff6b45"/></svg>`,
  drive: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0F9D58" d="m8.5 3 3.2 5.5L6.2 18H2.9l-1.6-2.8L8.5 3Z"/><path fill="#F4B400" d="M8.5 3h6.4l3.2 5.5h-6.4L8.5 3Z"/><path fill="#4285F4" d="m18.1 8.5 3.7 6.4-1.7 3.1H6.2l3.2-5.5h6.9l1.8-4Z"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" fill="currentColor"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zm5 0h3v14h-3z" fill="currentColor"/></svg>`,
  remote: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 21h8m-4-3v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11" r="1.5" fill="currentColor"/><path d="M12 9.5h5M12 12.5h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.56V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fullscreen: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  rewind: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 8-5 4 5 4V8Zm7 0-5 4 5 4V8Z" fill="currentColor"/></svg>`,
  forward: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 8 5 4-5 4V8ZM6 8l5 4-5 4V8Z" fill="currentColor"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8V4m0 0h4M5 4l3 3a7 7 0 1 1-2 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[character]);
}

function toast(message, type = "default") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  toastRegion.appendChild(item);
  requestAnimationFrame(() => item.classList.add("visible"));
  setTimeout(() => {
    item.classList.remove("visible");
    setTimeout(() => item.remove(), 250);
  }, 3200);
}

function setButtonBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span>${label}`;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;
  }
}

function shell(content, active = "scripts") {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <button class="brand" data-action="home" aria-label="Promptly home">${icons.logo}<span>promptly</span></button>
        <nav class="side-nav" aria-label="Main navigation">
          <button class="nav-item ${active === "scripts" ? "active" : ""}" data-action="home">${icons.logo}<span>Scripts</span></button>
          <button class="nav-item ${active === "remote" ? "active" : ""}" data-action="open-remote-page">${icons.remote}<span>Remote</span></button>
          <button class="nav-item" data-action="open-settings">${icons.settings}<span>Settings</span></button>
        </nav>
        <div class="sidebar-bottom">
          <div class="shortcut-hint"><kbd>Space</kbd><span>Play / pause</span></div>
          <button class="nav-item install-nav ${installPrompt ? "" : "hidden"}" data-action="install-app">${icons.upload}<span>Install app</span></button>
        </div>
      </aside>
      <div class="mobile-header">
        <button class="brand" data-action="home">${icons.logo}<span>promptly</span></button>
        <button class="icon-button" data-action="open-settings" aria-label="Settings">${icons.settings}</button>
      </div>
      <main class="main-content">${content}</main>
    </div>`;
}

function scriptCard(script) {
  const selected = script.id === activeScript.id;
  const sourceLabel = script.source === "google-drive" ? "Drive" : script.source === "upload" ? "Upload" : "Local";
  return `<button class="script-card ${selected ? "selected" : ""}" data-script-id="${escapeHtml(script.id)}">
    <span class="script-card-copy"><strong>${escapeHtml(script.title)}</strong><small>${sourceLabel} · ${formatRelativeDate(script.updatedAt)}</small></span>
    ${icons.chevron}
  </button>`;
}

function renderWorkspace() {
  const library = getLibrary();
  app.innerHTML = shell(`
    <header class="page-header">
      <div>
        <p class="eyebrow">Your studio</p>
        <h1>Ready when you are.</h1>
      </div>
      <div class="header-actions">
        <input id="script-upload" type="file" accept=".txt,.md,.rtf,text/plain,text/markdown,application/rtf" hidden />
        <button class="button ghost" data-action="upload-script">${icons.upload}<span>Upload</span></button>
        <button class="button drive" data-action="drive-import">${icons.drive}<span>Google Drive</span></button>
      </div>
    </header>

    <section class="workspace-grid">
      <aside class="library-panel panel">
        <div class="panel-heading">
          <div><span class="section-kicker">Library</span><h2>Your scripts</h2></div>
          <button class="icon-button light" data-action="new-script" aria-label="New script">${icons.plus}</button>
        </div>
        <div class="script-list">${library.map(scriptCard).join("")}</div>
        <button class="text-button" data-action="drive-import">${icons.drive} Open from Google Drive</button>
      </aside>

      <section class="editor-panel panel">
        <div class="editor-toolbar">
          <div class="save-status"><span class="status-dot"></span><span id="save-label">Saved on this device</span></div>
          <div class="editor-actions">
            <button class="text-button danger-text" data-action="delete-script">Delete</button>
            <button class="icon-button light" data-action="open-stage-settings" aria-label="Teleprompter settings">${icons.settings}</button>
          </div>
        </div>
        <input class="title-input" id="script-title" value="${escapeHtml(activeScript.title)}" aria-label="Script title" />
        <textarea class="script-editor" id="script-body" spellcheck="true" aria-label="Script text" placeholder="Paste or write your script here…">${escapeHtml(activeScript.body)}</textarea>
        <div class="editor-footer">
          <div class="script-stats"><span id="word-count">${countWords(activeScript.body)} words</span><span id="read-time">${readTime(activeScript.body)}</span></div>
          <button class="button primary launch-button" data-action="launch-stage">${icons.play}<span>Start prompting</span></button>
        </div>
      </section>

      <aside class="setup-panel">
        <div class="remote-card">
          <div class="remote-visual"><span class="signal signal-one"></span><span class="signal signal-two"></span>${icons.remote}</div>
          <span class="section-kicker coral">Hands-free control</span>
          <h2>Control it from your laptop.</h2>
          <p>Your phone and laptop connect directly. No account, cable, or shared Wi-Fi required.</p>
          <button class="button dark wide" data-action="open-remote-page">${icons.remote}<span>Open remote control</span></button>
        </div>
        <div class="quick-settings panel">
          <div class="panel-heading compact"><div><span class="section-kicker">Prompt settings</span><h3>Fine tune</h3></div></div>
          ${rangeField("speed", "Scroll speed", settings.speed, 20, 180, 5, `${settings.speed} px/s`)}
          ${rangeField("fontSize", "Text size", settings.fontSize, 30, 96, 2, `${settings.fontSize} px`)}
          <label class="toggle-row"><span><strong>Mirror text</strong><small>For beam-splitter glass</small></span><input type="checkbox" id="mirror-toggle" ${settings.mirrorX ? "checked" : ""}/><span class="toggle"></span></label>
        </div>
      </aside>
    </section>
  `);
  bindGlobalActions();
  bindWorkspace();
}

function rangeField(id, label, value, min, max, step, display) {
  return `<label class="range-field">
    <span><strong>${label}</strong><output id="${id}-output">${display}</output></span>
    <input type="range" id="${id}-range" min="${min}" max="${max}" step="${step}" value="${value}" />
  </label>`;
}

function countWords(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function readTime(text) {
  const seconds = Math.max(1, Math.round((countWords(text) / 145) * 60));
  if (seconds < 60) return `~${seconds}s read`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `~${minutes}:${String(remainder).padStart(2, "0")} read`;
}

function bindWorkspace() {
  const title = document.querySelector("#script-title");
  const body = document.querySelector("#script-body");
  const saveCurrent = () => {
    activeScript = saveScript({ ...activeScript, title: title.value.trim() || "Untitled script", body: body.value });
    const label = document.querySelector("#save-label");
    if (label) label.textContent = "Saved on this device";
  };
  const scheduleSave = () => {
    const label = document.querySelector("#save-label");
    if (label) label.textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 450);
    document.querySelector("#word-count").textContent = `${countWords(body.value)} words`;
    document.querySelector("#read-time").textContent = readTime(body.value);
  };
  title.addEventListener("input", scheduleSave);
  body.addEventListener("input", scheduleSave);

  document.querySelectorAll("[data-script-id]").forEach((card) => card.addEventListener("click", () => {
    saveCurrent();
    setActiveScript(card.dataset.scriptId);
    activeScript = getActiveScript();
    renderWorkspace();
  }));

  const speedRange = document.querySelector("#speed-range");
  const sizeRange = document.querySelector("#fontSize-range");
  speedRange.addEventListener("input", () => {
    settings = saveSettings({ speed: Number(speedRange.value) });
    document.querySelector("#speed-output").textContent = `${speedRange.value} px/s`;
  });
  sizeRange.addEventListener("input", () => {
    settings = saveSettings({ fontSize: Number(sizeRange.value) });
    document.querySelector("#fontSize-output").textContent = `${sizeRange.value} px`;
  });
  document.querySelector("#mirror-toggle").addEventListener("change", (event) => {
    settings = saveSettings({ mirrorX: event.target.checked });
  });
  document.querySelector("#script-upload").addEventListener("change", importLocalFile);
}

function bindGlobalActions() {
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", handleAction));
}

async function handleAction(event) {
  const action = event.currentTarget.dataset.action;
  if (action === "home") renderWorkspace();
  if (action === "new-script") createNewScript();
  if (action === "upload-script") document.querySelector("#script-upload")?.click();
  if (action === "drive-import") await importFromDrive(event.currentTarget);
  if (action === "delete-script") removeActiveScript();
  if (action === "launch-stage") launchStage();
  if (action === "open-stage-settings") openPromptSettings();
  if (action === "open-settings") openAppSettings();
  if (action === "open-remote-page") renderRemoteLanding();
  if (action === "install-app") await installApp();
}

function createNewScript() {
  activeScript = saveScript({ id: makeId(), title: "Untitled script", body: "", source: "local", updatedAt: Date.now() });
  renderWorkspace();
  requestAnimationFrame(() => document.querySelector("#script-title")?.select());
}

function removeActiveScript() {
  if (activeScript.id === "welcome-script" && getLibrary().length === 1) {
    toast("Add another script before removing the welcome script.");
    return;
  }
  deleteScript(activeScript.id);
  activeScript = getLibrary()[0];
  setActiveScript(activeScript.id);
  renderWorkspace();
  toast("Script removed from this device.");
}

async function importLocalFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) {
    toast("That file is too large. Please choose a script under 2 MB.", "error");
    return;
  }
  const body = await file.text();
  activeScript = saveScript({
    id: makeId("upload"),
    title: file.name.replace(/\.[^.]+$/, ""),
    body,
    source: "upload",
    updatedAt: Date.now()
  });
  renderWorkspace();
  toast("Script imported.", "success");
}

async function importFromDrive(button) {
  setButtonBusy(button, true, "Connecting…");
  try {
    const imported = await pickGoogleDriveScript(settings);
    activeScript = saveScript({
      id: `drive-${imported.id}`,
      driveFileId: imported.id,
      driveMimeType: imported.mimeType,
      title: imported.name.replace(/\.[^.]+$/, ""),
      body: imported.text,
      source: "google-drive",
      updatedAt: Date.now()
    });
    renderWorkspace();
    toast("Google Drive script is ready.", "success");
  } catch (error) {
    if (error.name !== "AbortError") {
      if (error.message.includes("setup is incomplete")) openAppSettings(true);
      toast(error.message, "error");
    }
  } finally {
    setButtonBusy(button, false);
  }
}

function modal(content, className = "") {
  const wrap = document.createElement("div");
  wrap.className = `modal-backdrop ${className}`;
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${content}</div>`;
  wrap.addEventListener("click", (event) => {
    if (event.target === wrap || event.target.closest("[data-close-modal]")) wrap.remove();
  });
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("visible"));
  return wrap;
}

function openAppSettings(focusGoogle = false) {
  const wrap = modal(`
    <div class="modal-header"><div><span class="section-kicker">App settings</span><h2>Connect your tools</h2></div><button class="icon-button light" data-close-modal aria-label="Close">×</button></div>
    <div class="settings-section">
      <div class="settings-intro">${icons.drive}<div><strong>Google Drive</strong><p>Use read-only, per-file access to open Google Docs and text scripts.</p></div></div>
      <label class="input-field"><span>OAuth client ID</span><input id="google-client-id" autocomplete="off" value="${escapeHtml(settings.googleClientId)}" placeholder="…apps.googleusercontent.com" /></label>
      <label class="input-field"><span>API key</span><input id="google-api-key" autocomplete="off" value="${escapeHtml(settings.googleApiKey)}" placeholder="AIza…" /></label>
      <label class="input-field"><span>Google Cloud project number</span><input id="google-app-id" inputmode="numeric" autocomplete="off" value="${escapeHtml(settings.googleAppId)}" placeholder="123456789012" /></label>
      <p class="privacy-note">These public browser credentials stay on this device. Your script is only downloaded after you choose it.</p>
    </div>
    <div class="modal-footer"><button class="button ghost" data-close-modal>Cancel</button><button class="button primary" id="save-app-settings">Save settings</button></div>
  `, "settings-modal");

  wrap.querySelector("#save-app-settings").addEventListener("click", () => {
    settings = saveSettings({
      googleClientId: wrap.querySelector("#google-client-id").value.trim(),
      googleApiKey: wrap.querySelector("#google-api-key").value.trim(),
      googleAppId: wrap.querySelector("#google-app-id").value.trim()
    });
    wrap.remove();
    toast("Settings saved.", "success");
  });
  if (focusGoogle) setTimeout(() => wrap.querySelector("#google-client-id")?.focus(), 80);
}

function openPromptSettings() {
  const wrap = modal(`
    <div class="modal-header"><div><span class="section-kicker">Prompt settings</span><h2>Make it comfortable</h2></div><button class="icon-button light" data-close-modal aria-label="Close">×</button></div>
    <div class="prompt-settings-grid">
      ${rangeField("modal-speed", "Scroll speed", settings.speed, 20, 180, 5, `${settings.speed} px/s`)}
      ${rangeField("modal-size", "Text size", settings.fontSize, 30, 96, 2, `${settings.fontSize} px`)}
      ${rangeField("modal-width", "Text width", settings.textWidth, 45, 96, 1, `${settings.textWidth}%`)}
      ${rangeField("modal-line", "Line spacing", settings.lineHeight, 1.2, 2, 0.05, settings.lineHeight)}
      <label class="select-field"><span>Countdown</span><select id="modal-countdown"><option value="0">None</option><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label>
      <label class="select-field"><span>Screen theme</span><select id="modal-theme"><option value="black">Black</option><option value="warm">Warm paper</option><option value="contrast">High contrast</option></select></label>
      <label class="toggle-row"><span><strong>Horizontal mirror</strong><small>For teleprompter glass</small></span><input id="modal-mirror-x" type="checkbox" ${settings.mirrorX ? "checked" : ""}/><span class="toggle"></span></label>
      <label class="toggle-row"><span><strong>Vertical mirror</strong><small>For unusual rigs</small></span><input id="modal-mirror-y" type="checkbox" ${settings.mirrorY ? "checked" : ""}/><span class="toggle"></span></label>
      <label class="toggle-row"><span><strong>Reading guide</strong><small>Keep your eyes near the lens</small></span><input id="modal-cue" type="checkbox" ${settings.cueLine ? "checked" : ""}/><span class="toggle"></span></label>
    </div>
    <div class="modal-footer"><button class="button ghost" data-close-modal>Cancel</button><button class="button primary" id="save-prompt-settings">Save settings</button></div>
  `, "settings-modal");
  wrap.querySelector("#modal-countdown").value = String(settings.countdown);
  wrap.querySelector("#modal-theme").value = settings.theme;
  wrap.querySelectorAll("input[type=range]").forEach((input) => input.addEventListener("input", () => {
    const output = wrap.querySelector(`#${input.id.replace(/-range$/, "")}-output`);
    const suffix = input.id.includes("speed") ? " px/s" : input.id.includes("size") ? " px" : input.id.includes("width") ? "%" : "";
    output.textContent = `${input.value}${suffix}`;
  }));
  wrap.querySelector("#save-prompt-settings").addEventListener("click", () => {
    settings = saveSettings({
      speed: Number(wrap.querySelector("#modal-speed-range").value),
      fontSize: Number(wrap.querySelector("#modal-size-range").value),
      textWidth: Number(wrap.querySelector("#modal-width-range").value),
      lineHeight: Number(wrap.querySelector("#modal-line-range").value),
      countdown: Number(wrap.querySelector("#modal-countdown").value),
      theme: wrap.querySelector("#modal-theme").value,
      mirrorX: wrap.querySelector("#modal-mirror-x").checked,
      mirrorY: wrap.querySelector("#modal-mirror-y").checked,
      cueLine: wrap.querySelector("#modal-cue").checked
    });
    wrap.remove();
    renderWorkspace();
    toast("Prompt settings saved.", "success");
  });
}

async function installApp() {
  if (!installPrompt) {
    toast("Use your browser menu and choose “Add to Home screen”.");
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.querySelectorAll(".install-nav").forEach((item) => item.classList.add("hidden"));
}

function launchStage() {
  const currentTitle = document.querySelector("#script-title");
  const currentBody = document.querySelector("#script-body");
  if (currentTitle && currentBody) {
    activeScript = saveScript({ ...activeScript, title: currentTitle.value.trim() || "Untitled script", body: currentBody.value });
  }
  if (!activeScript.body.trim()) {
    toast("Add some words before starting the teleprompter.", "error");
    return;
  }
  stageController?.destroy();
  stageController = createTeleprompterStage(activeScript, settings);
}

function createTeleprompterStage(script, promptSettings) {
  const stage = document.createElement("section");
  stage.className = `teleprompter-stage theme-${promptSettings.theme}`;
  stage.innerHTML = `
    <div class="stage-topbar">
      <button class="stage-icon-button" data-stage="close" aria-label="Close teleprompter">${icons.back}</button>
      <div class="stage-title"><span>${escapeHtml(script.title)}</span><small id="stage-status">Ready</small></div>
      <div class="stage-session"><span class="connection-dot" id="connection-dot"></span><span id="stage-session-label">Creating remote…</span></div>
      <button class="stage-icon-button" data-stage="fullscreen" aria-label="Full screen">${icons.fullscreen}</button>
    </div>
    <div class="reading-guide ${promptSettings.cueLine ? "" : "hidden"}"><span></span></div>
    <div class="stage-viewport" id="stage-viewport">
      <article class="prompt-copy" id="prompt-copy">${escapeHtml(script.body).replace(/\n/g, "<br>")}</article>
      <div class="stage-end"><span>End of script</span><button class="button stage-restart" data-stage="reset">${icons.reset} Start again</button></div>
    </div>
    <div class="countdown" id="stage-countdown" hidden></div>
    <div class="stage-controls">
      <button class="stage-control" data-stage="rewind">${icons.rewind}<span>Back</span></button>
      <button class="stage-play" data-stage="toggle" aria-label="Play">${icons.play}</button>
      <button class="stage-control" data-stage="forward">${icons.forward}<span>Forward</span></button>
      <label class="stage-range speed-control"><span>Speed</span><input id="stage-speed" type="range" min="20" max="180" step="5" value="${promptSettings.speed}"/><output id="stage-speed-output">${promptSettings.speed}</output></label>
      <label class="stage-range"><span>Size</span><input id="stage-size" type="range" min="30" max="96" step="2" value="${promptSettings.fontSize}"/><output id="stage-size-output">${promptSettings.fontSize}</output></label>
    </div>`;
  document.body.appendChild(stage);

  const viewport = stage.querySelector("#stage-viewport");
  const copy = stage.querySelector("#prompt-copy");
  const playButton = stage.querySelector(".stage-play");
  const status = stage.querySelector("#stage-status");
  const speedInput = stage.querySelector("#stage-speed");
  const sizeInput = stage.querySelector("#stage-size");
  const sessionLabel = stage.querySelector("#stage-session-label");
  const connectionDot = stage.querySelector("#connection-dot");
  let running = false;
  let speed = promptSettings.speed;
  let fontSize = promptSettings.fontSize;
  let animationFrame = 0;
  let previousTime = 0;
  let destroyed = false;
  let wakeLock = null;
  let countdownRunning = false;
  let lastSync = 0;

  const transforms = [];
  if (promptSettings.mirrorX) transforms.push("scaleX(-1)");
  if (promptSettings.mirrorY) transforms.push("scaleY(-1)");
  copy.style.transform = transforms.join(" ") || "none";
  copy.style.fontSize = `${fontSize}px`;
  copy.style.lineHeight = String(promptSettings.lineHeight);
  copy.style.maxWidth = `${promptSettings.textWidth}%`;

  const stateSnapshot = () => {
    const max = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
    return {
      running,
      progress: Math.min(100, (viewport.scrollTop / max) * 100),
      speed,
      fontSize,
      title: script.title,
      sessionCode: sessionController?.code || ""
    };
  };

  const syncRemote = () => sessionController?.send({ type: "state", state: stateSnapshot() });

  const frame = (time) => {
    if (destroyed) return;
    if (running) {
      if (previousTime) viewport.scrollTop += speed * ((time - previousTime) / 1000);
      const maxScroll = viewport.scrollHeight - viewport.clientHeight;
      if (viewport.scrollTop >= maxScroll - 2) setRunning(false);
      if (time - lastSync > 300) {
        syncRemote();
        lastSync = time;
      }
    }
    previousTime = time;
    animationFrame = requestAnimationFrame(frame);
  };

  const requestWakeLock = async () => {
    try { wakeLock = await navigator.wakeLock?.request("screen"); } catch { /* Optional enhancement. */ }
  };

  const setRunning = (value) => {
    running = value;
    status.textContent = running ? "Prompting" : viewport.scrollTop > 0 ? "Paused" : "Ready";
    playButton.innerHTML = running ? icons.pause : icons.play;
    playButton.setAttribute("aria-label", running ? "Pause" : "Play");
    stage.classList.toggle("is-running", running);
    if (running) requestWakeLock();
    syncRemote();
  };

  const moveBy = (seconds) => {
    viewport.scrollTop = Math.max(0, viewport.scrollTop + speed * seconds);
    syncRemote();
  };

  const reset = () => {
    setRunning(false);
    viewport.scrollTo({ top: 0, behavior: "smooth" });
    syncRemote();
  };

  const jumpTo = (progress) => {
    const max = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTop = max * (Math.max(0, Math.min(100, progress)) / 100);
    syncRemote();
  };

  const applyPatch = (patch) => {
    if (Number.isFinite(patch.speed)) {
      speed = Math.max(20, Math.min(180, patch.speed));
      speedInput.value = speed;
      stage.querySelector("#stage-speed-output").textContent = String(speed);
    }
    if (Number.isFinite(patch.fontSize)) {
      fontSize = Math.max(30, Math.min(96, patch.fontSize));
      sizeInput.value = fontSize;
      copy.style.fontSize = `${fontSize}px`;
      stage.querySelector("#stage-size-output").textContent = String(fontSize);
    }
    settings = saveSettings({ speed, fontSize });
    syncRemote();
  };

  const handleRemoteMessage = (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "hello") syncRemote();
    if (message.type === "settings") applyPatch(message.patch || {});
    if (message.type === "command") {
      if (message.action === "toggle") setRunning(!running);
      if (message.action === "play") setRunning(true);
      if (message.action === "pause") setRunning(false);
      if (message.action === "rewind") moveBy(-Number(message.seconds || 5));
      if (message.action === "forward") moveBy(Number(message.seconds || 5));
      if (message.action === "reset") reset();
      if (message.action === "jump") jumpTo(Number(message.progress || 0));
    }
  };

  sessionController?.close();
  sessionController = createStageSession();
  sessionController.on("ready", ({ code }) => {
    sessionLabel.innerHTML = `Remote code <strong>${code}</strong>`;
    connectionDot.classList.add("ready");
  });
  sessionController.on("connected", () => {
    sessionLabel.textContent = "Laptop connected";
    connectionDot.classList.add("connected");
    toast("Remote connected.", "success");
    syncRemote();
  });
  sessionController.on("disconnected", () => {
    sessionLabel.innerHTML = `Remote code <strong>${sessionController.code}</strong>`;
    connectionDot.classList.remove("connected");
  });
  sessionController.on("message", handleRemoteMessage);
  sessionController.on("error", (error) => {
    sessionLabel.textContent = "Remote unavailable";
    toast(`Remote: ${error.message}`, "error");
  });

  const startWithCountdown = async () => {
    if (!promptSettings.countdown || viewport.scrollTop > 0) {
      setRunning(!running);
      return;
    }
    if (countdownRunning) return;
    countdownRunning = true;
    const count = stage.querySelector("#stage-countdown");
    count.hidden = false;
    for (let number = promptSettings.countdown; number > 0; number -= 1) {
      count.textContent = number;
      await new Promise((resolve) => setTimeout(resolve, 850));
    }
    count.textContent = "Go";
    await new Promise((resolve) => setTimeout(resolve, 450));
    count.hidden = true;
    countdownRunning = false;
    setRunning(true);
  };

  const keyboard = (event) => {
    if (event.code === "Space") { event.preventDefault(); startWithCountdown(); }
    if (event.code === "ArrowUp") { event.preventDefault(); moveBy(-5); }
    if (event.code === "ArrowDown") { event.preventDefault(); moveBy(5); }
    if (event.code === "Home") { event.preventDefault(); reset(); }
    if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.();
    if (event.key === "Escape" && !document.fullscreenElement) destroy();
  };

  const destroy = () => {
    destroyed = true;
    setRunning(false);
    cancelAnimationFrame(animationFrame);
    sessionController?.close();
    sessionController = null;
    wakeLock?.release();
    document.removeEventListener("keydown", keyboard);
    if (document.fullscreenElement) document.exitFullscreen?.();
    stage.remove();
    stageController = null;
  };

  stage.querySelectorAll("[data-stage]").forEach((button) => button.addEventListener("click", () => {
    const action = button.dataset.stage;
    if (action === "close") destroy();
    if (action === "fullscreen") document.documentElement.requestFullscreen?.();
    if (action === "toggle") startWithCountdown();
    if (action === "rewind") moveBy(-5);
    if (action === "forward") moveBy(5);
    if (action === "reset") reset();
  }));
  speedInput.addEventListener("input", () => applyPatch({ speed: Number(speedInput.value) }));
  sizeInput.addEventListener("input", () => applyPatch({ fontSize: Number(sizeInput.value) }));
  viewport.addEventListener("scroll", () => { if (!running) syncRemote(); }, { passive: true });
  document.addEventListener("keydown", keyboard);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running) requestWakeLock();
  });
  animationFrame = requestAnimationFrame(frame);

  return { destroy, setRunning, reset, stateSnapshot };
}

function renderRemoteLanding() {
  stageController?.destroy();
  const params = new URLSearchParams(location.search);
  const initialCode = cleanSessionCode(params.get("code") || "");
  app.innerHTML = shell(`
    <section class="remote-page">
      <div class="remote-page-copy">
        <span class="section-kicker coral">Laptop remote</span>
        <h1>Stay in your flow.</h1>
        <p>Enter the six-character code shown on the phone. Your commands travel directly between the two devices.</p>
        <div class="connection-form">
          <label for="session-code">Session code</label>
          <div class="code-entry">
            <input id="session-code" maxlength="6" autocomplete="one-time-code" spellcheck="false" value="${escapeHtml(initialCode)}" placeholder="ABC123" />
            <button class="button primary" id="connect-remote">Connect</button>
          </div>
          <small>Keep the teleprompter screen open on your phone.</small>
        </div>
        <button class="text-button back-home" data-action="home">${icons.back} Back to scripts</button>
      </div>
      <div class="remote-demo" aria-hidden="true">
        <div class="demo-phone"><span class="phone-speaker"></span><div class="demo-lines"><i></i><i></i><i></i><i></i><i></i></div></div>
        <span class="demo-signal one"></span><span class="demo-signal two"></span><span class="demo-signal three"></span>
        <div class="demo-laptop"><div><span>${icons.play}</span><i></i><i></i></div></div>
      </div>
    </section>
  `, "remote");
  bindGlobalActions();
  const codeInput = document.querySelector("#session-code");
  codeInput.addEventListener("input", () => { codeInput.value = cleanSessionCode(codeInput.value); });
  codeInput.addEventListener("keydown", (event) => { if (event.key === "Enter") connectToStage(); });
  document.querySelector("#connect-remote").addEventListener("click", connectToStage);
  if (initialCode.length === 6) setTimeout(connectToStage, 150);
}

function connectToStage() {
  const input = document.querySelector("#session-code");
  const code = cleanSessionCode(input.value);
  if (code.length !== 6) {
    toast("Enter the complete six-character code.", "error");
    input.focus();
    return;
  }
  const button = document.querySelector("#connect-remote");
  setButtonBusy(button, true, "Connecting…");
  const remote = connectRemote(code);
  let settled = false;
  const timeout = setTimeout(() => {
    if (!settled) {
      remote.close();
      setButtonBusy(button, false);
      toast("Could not find that phone. Check the code and try again.", "error");
    }
  }, 12000);
  remote.on("connected", () => {
    settled = true;
    clearTimeout(timeout);
    renderRemoteControls(remote, code);
  });
  remote.on("error", (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    remote.close();
    setButtonBusy(button, false);
    toast(error.type === "peer-unavailable" ? "No phone found with that code." : error.message, "error");
  });
}

function renderRemoteControls(remote, code) {
  app.innerHTML = shell(`
    <section class="control-room">
      <header class="control-header">
        <div><span class="live-pill"><i></i> Connected</span><h1 id="remote-title">Teleprompter</h1><p>Session <strong>${escapeHtml(code)}</strong></p></div>
        <button class="button ghost" id="disconnect-remote">Disconnect</button>
      </header>
      <div class="control-grid">
        <section class="transport-card panel">
          <div class="position-readout"><span id="remote-progress-label">0%</span><small>through script</small></div>
          <input class="position-slider" id="remote-progress" type="range" min="0" max="100" step="0.1" value="0" aria-label="Script position" />
          <div class="transport-controls">
            <button class="remote-skip" data-command="rewind">${icons.rewind}<span>5 sec</span></button>
            <button class="remote-play" id="remote-play">${icons.play}<span>Start</span></button>
            <button class="remote-skip" data-command="forward">${icons.forward}<span>5 sec</span></button>
          </div>
          <button class="reset-button" data-command="reset">${icons.reset} Back to beginning</button>
        </section>
        <aside class="remote-adjustments panel">
          <div class="panel-heading compact"><div><span class="section-kicker">Live adjustments</span><h2>Fine tune</h2></div></div>
          ${rangeField("remote-speed", "Scroll speed", settings.speed, 20, 180, 5, `${settings.speed} px/s`)}
          ${rangeField("remote-size", "Text size", settings.fontSize, 30, 96, 2, `${settings.fontSize} px`)}
          <div class="remote-tip"><strong>Keyboard controls</strong><span><kbd>Space</kbd> play / pause</span><span><kbd>↑</kbd><kbd>↓</kbd> move back / forward</span><span><kbd>Home</kbd> restart</span></div>
        </aside>
      </div>
    </section>
  `, "remote");
  bindGlobalActions();

  let remoteState = { running: false, progress: 0, speed: settings.speed, fontSize: settings.fontSize, title: "Teleprompter" };
  const play = document.querySelector("#remote-play");
  const progress = document.querySelector("#remote-progress");
  const speed = document.querySelector("#remote-speed-range");
  const size = document.querySelector("#remote-size-range");

  const update = (state) => {
    remoteState = { ...remoteState, ...state };
    document.querySelector("#remote-title").textContent = remoteState.title;
    document.querySelector("#remote-progress-label").textContent = `${Math.round(remoteState.progress)}%`;
    if (document.activeElement !== progress) progress.value = remoteState.progress;
    if (document.activeElement !== speed) speed.value = remoteState.speed;
    if (document.activeElement !== size) size.value = remoteState.fontSize;
    document.querySelector("#remote-speed-output").textContent = `${remoteState.speed} px/s`;
    document.querySelector("#remote-size-output").textContent = `${remoteState.fontSize} px`;
    play.innerHTML = remoteState.running ? `${icons.pause}<span>Pause</span>` : `${icons.play}<span>Start</span>`;
    play.classList.toggle("playing", remoteState.running);
  };

  remote.on("message", (message) => { if (message?.type === "state") update(message.state); });
  remote.on("disconnected", () => {
    toast("Phone disconnected.", "error");
    renderRemoteLanding();
  });
  play.addEventListener("click", () => remote.send({ type: "command", action: "toggle" }));
  document.querySelectorAll("[data-command]").forEach((button) => button.addEventListener("click", () => remote.send({
    type: "command", action: button.dataset.command, seconds: 5
  })));
  progress.addEventListener("input", () => {
    document.querySelector("#remote-progress-label").textContent = `${Math.round(progress.value)}%`;
  });
  progress.addEventListener("change", () => remote.send({ type: "command", action: "jump", progress: Number(progress.value) }));
  speed.addEventListener("input", () => {
    document.querySelector("#remote-speed-output").textContent = `${speed.value} px/s`;
    remote.send({ type: "settings", patch: { speed: Number(speed.value) } });
  });
  size.addEventListener("input", () => {
    document.querySelector("#remote-size-output").textContent = `${size.value} px`;
    remote.send({ type: "settings", patch: { fontSize: Number(size.value) } });
  });
  document.querySelector("#disconnect-remote").addEventListener("click", () => {
    remote.close();
    renderRemoteLanding();
  });
  const keyboard = (event) => {
    if (!document.querySelector(".control-room")) { document.removeEventListener("keydown", keyboard); return; }
    if (event.code === "Space") { event.preventDefault(); remote.send({ type: "command", action: "toggle" }); }
    if (event.code === "ArrowUp") { event.preventDefault(); remote.send({ type: "command", action: "rewind", seconds: 5 }); }
    if (event.code === "ArrowDown") { event.preventDefault(); remote.send({ type: "command", action: "forward", seconds: 5 }); }
    if (event.code === "Home") { event.preventDefault(); remote.send({ type: "command", action: "reset" }); }
  };
  document.addEventListener("keydown", keyboard);
  update(remoteState);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  document.querySelectorAll(".install-nav").forEach((item) => item.classList.remove("hidden"));
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  toast("Promptly is installed.", "success");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

const routeParams = new URLSearchParams(location.search);
if (routeParams.get("remote") === "1") renderRemoteLanding();
else renderWorkspace();
