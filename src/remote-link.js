import { Peer } from "peerjs";

const PREFIX = "promptly-stage-";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
}

function normalizeCode(code) {
  return code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

function peerId(code) {
  return `${PREFIX}${normalizeCode(code).toLowerCase()}`;
}

function connectionWrapper() {
  const listeners = new Map();
  return {
    on(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
      return () => listeners.get(type)?.delete(callback);
    },
    emit(type, payload) {
      listeners.get(type)?.forEach((callback) => callback(payload));
    }
  };
}

export function createStageSession(preferredCode) {
  const events = connectionWrapper();
  let code = normalizeCode(preferredCode || randomCode());
  let peer;
  let connection;
  let manuallyClosed = false;

  const openPeer = () => {
    peer = new Peer(peerId(code), { debug: 1 });
    peer.on("open", () => events.emit("ready", { code }));
    peer.on("connection", (incoming) => {
      if (connection?.open) connection.close();
      connection = incoming;
      connection.on("open", () => events.emit("connected", { code }));
      connection.on("data", (data) => events.emit("message", data));
      connection.on("close", () => events.emit("disconnected"));
      connection.on("error", (error) => events.emit("error", error));
    });
    peer.on("error", (error) => {
      if (error.type === "unavailable-id" && !preferredCode && !manuallyClosed) {
        peer.destroy();
        code = randomCode();
        openPeer();
        return;
      }
      events.emit("error", error);
    });
    peer.on("disconnected", () => events.emit("disconnected"));
  };

  openPeer();

  return {
    get code() { return code; },
    on: events.on,
    send(payload) {
      if (connection?.open) connection.send(payload);
    },
    close() {
      manuallyClosed = true;
      connection?.close();
      peer?.destroy();
    }
  };
}

export function connectRemote(rawCode) {
  const code = normalizeCode(rawCode);
  const events = connectionWrapper();
  const peer = new Peer(undefined, { debug: 1 });
  let connection;
  let stopped = false;

  peer.on("open", () => {
    if (stopped) return;
    events.emit("connecting", { code });
    connection = peer.connect(peerId(code), { reliable: true, metadata: { role: "remote" } });
    connection.on("open", () => {
      events.emit("connected", { code });
      connection.send({ type: "hello", role: "remote" });
    });
    connection.on("data", (data) => events.emit("message", data));
    connection.on("close", () => events.emit("disconnected"));
    connection.on("error", (error) => events.emit("error", error));
  });
  peer.on("error", (error) => events.emit("error", error));
  peer.on("disconnected", () => events.emit("disconnected"));

  return {
    code,
    on: events.on,
    send(payload) {
      if (connection?.open) connection.send(payload);
    },
    close() {
      stopped = true;
      connection?.close();
      peer.destroy();
    }
  };
}

export function cleanSessionCode(value) {
  return normalizeCode(value);
}
