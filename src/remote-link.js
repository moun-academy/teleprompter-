import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = __SUPABASE_URL__;
const SUPABASE_KEY = __SUPABASE_PUBLISHABLE_KEY__;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const HEARTBEAT_MS = 2000;
const CONNECTION_TIMEOUT_MS = 10000;
const RETRY_MS = 700;
const MAX_RETRIES = 5;

let realtimeClient;

function randomCode(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
}

function normalizeCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
}

function clientId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getRealtimeClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Remote service is not configured.");
  if (!realtimeClient) {
    realtimeClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } }
    });
  }
  return realtimeClient;
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

function broadcast(channel, event, payload) {
  if (!channel) return;
  channel.send({ type: "broadcast", event, payload }).then((status) => {
    if (status !== "ok") console.warn("Promptly realtime delivery:", status);
  }).catch((error) => console.warn("Promptly realtime delivery:", error));
}

function cloudSession(role, rawCode) {
  const code = normalizeCode(rawCode || randomCode());
  const events = connectionWrapper();
  const id = clientId();
  const inboundEvent = role === "stage" ? "remote-message" : "stage-message";
  const outboundEvent = role === "stage" ? "stage-message" : "remote-message";
  const seenMessages = new Set();
  const pending = new Map();
  let channel;
  let subscribed = false;
  let connected = false;
  let manuallyClosed = false;
  let lastPeerActivity = 0;
  let heartbeatTimer;
  let retryTimer;
  let serviceTimer;
  let serviceUnavailable = false;
  let subscriptionAttempt = 0;

  const sendRaw = (payload) => subscribed && !manuallyClosed && broadcast(channel, outboundEvent, {
    ...payload,
    code,
    senderId: id,
    sentAt: Date.now()
  });

  const markConnected = () => {
    lastPeerActivity = Date.now();
    if (connected) return;
    connected = true;
    pending.clear();
    events.emit("connected", { code });
  };

  const acknowledge = (message) => {
    if (!message.messageId) return;
    sendRaw({ type: "applied", messageId: message.messageId, targetId: message.senderId });
  };

  const receive = (message) => {
    if (!message || message.code !== code || message.senderId === id) return;
    if (message.targetId && message.targetId !== id) return;
    lastPeerActivity = Date.now();

    if (role === "stage") {
      if (message.type === "hello" || message.type === "heartbeat") {
        markConnected();
        if (message.type === "hello") {
          sendRaw({ type: "hello-ack", targetId: message.senderId });
          events.emit("message", { type: "hello" });
        }
        return;
      }
      if (message.type === "command" || message.type === "settings") {
        markConnected();
        if (message.messageId && seenMessages.has(message.messageId)) {
          acknowledge(message);
          return;
        }
        if (message.messageId) {
          seenMessages.add(message.messageId);
          if (seenMessages.size > 200) seenMessages.delete(seenMessages.values().next().value);
        }
        events.emit("message", message);
        acknowledge(message);
      }
      return;
    }

    if (message.type === "hello-ack") {
      markConnected();
      return;
    }
    if (message.type === "applied") {
      pending.delete(message.messageId);
      return;
    }
    if (message.type === "heartbeat") {
      if (connected) lastPeerActivity = Date.now();
      return;
    }
    if (message.type === "state") {
      markConnected();
      events.emit("message", message);
    }
  };

  const startTimers = () => {
    clearInterval(heartbeatTimer);
    clearInterval(retryTimer);
    heartbeatTimer = setInterval(() => {
      if (!subscribed || manuallyClosed) return;
      sendRaw({ type: role === "remote" && !connected ? "hello" : "heartbeat" });
      if (connected && Date.now() - lastPeerActivity > CONNECTION_TIMEOUT_MS) {
        connected = false;
        pending.clear();
        events.emit("disconnected");
      }
    }, HEARTBEAT_MS);

    retryTimer = setInterval(() => {
      if (role !== "remote" || !subscribed || manuallyClosed) return;
      for (const [messageId, item] of pending) {
        if (Date.now() - item.lastAttempt < RETRY_MS) continue;
        if (item.attempts >= MAX_RETRIES) {
          pending.delete(messageId);
          events.emit("error", new Error("The phone did not confirm that control. Please try again."));
          continue;
        }
        item.attempts += 1;
        item.lastAttempt = Date.now();
        sendRaw(item.payload);
      }
    }, 250);
  };

  const waitForService = () => {
    clearTimeout(serviceTimer);
    serviceTimer = setTimeout(() => {
      serviceTimer = undefined;
      if (manuallyClosed || subscribed || serviceUnavailable) return;
      serviceUnavailable = true;
      events.emit("unavailable", new Error("The connection service is unavailable. It may be temporarily offline. Your script still works; retry the remote shortly."));
    }, CONNECTION_TIMEOUT_MS);
  };

  const subscribe = async () => {
    const attempt = ++subscriptionAttempt;
    if (manuallyClosed) return;
    subscribed = false;
    connected = false;
    pending.clear();
    waitForService();
    let client;
    try {
      client = getRealtimeClient();
    } catch (error) {
      events.emit("error", error);
      return;
    }

    if (channel) await client.removeChannel(channel);
    if (manuallyClosed || attempt !== subscriptionAttempt) return;
    channel = client.channel(`promptly:${code.toLowerCase()}`, {
      config: { broadcast: { ack: true, self: false } }
    });
    channel.on("broadcast", { event: inboundEvent }, ({ payload }) => receive(payload));
    channel.subscribe((status) => {
      if (manuallyClosed || attempt !== subscriptionAttempt) return;
      if (status === "SUBSCRIBED") {
        subscribed = true;
        serviceUnavailable = false;
        clearTimeout(serviceTimer);
        serviceTimer = undefined;
        if (role === "stage") events.emit("ready", { code });
        if (role === "remote") {
          events.emit("connecting", { code });
          sendRaw({ type: "hello" });
        }
        startTimers();
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        subscribed = false;
        connected = false;
        pending.clear();
        events.emit("reconnecting", { code });
        if (!serviceTimer) waitForService();
      }
      if (status === "CLOSED") subscribed = false;
    });
  };

  const retry = () => {
    if (manuallyClosed || subscribed) return;
    serviceUnavailable = false;
    events.emit("reconnecting", { code });
    subscribe().catch((error) => events.emit("error", error));
  };
  const resume = () => {
    if (typeof document === "undefined" || document.visibilityState === "visible") retry();
  };
  globalThis.addEventListener?.("online", retry);
  globalThis.document?.addEventListener("visibilitychange", resume);
  queueMicrotask(retry);

  return {
    code,
    on: events.on,
    retry,
    send(payload) {
      if (!payload || manuallyClosed) return;
      if (role === "remote" && (payload.type === "command" || payload.type === "settings")) {
        if (!subscribed || !connected) {
          events.emit("error", new Error("Waiting for the phone to reconnect. Try the control again once connected."));
          return;
        }
        const messageId = clientId();
        const reliablePayload = { ...payload, messageId };
        pending.set(messageId, { payload: reliablePayload, attempts: 1, lastAttempt: Date.now() });
        sendRaw(reliablePayload);
        return;
      }
      sendRaw(payload);
    },
    close() {
      manuallyClosed = true;
      subscribed = false;
      connected = false;
      clearInterval(heartbeatTimer);
      clearInterval(retryTimer);
      clearTimeout(serviceTimer);
      globalThis.removeEventListener?.("online", retry);
      globalThis.document?.removeEventListener("visibilitychange", resume);
      pending.clear();
      if (channel) getRealtimeClient().removeChannel(channel);
    }
  };
}

export function createStageSession(preferredCode) {
  return cloudSession("stage", preferredCode);
}

export function connectRemote(rawCode) {
  return cloudSession("remote", rawCode);
}

export function cleanSessionCode(value) {
  return normalizeCode(value);
}
