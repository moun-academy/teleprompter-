import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const source = await readFile(new URL("../src/remote-link.js", import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };

async function harness(online = true) {
  let now = 0, timerId = 0;
  const timers = new Map(), channels = [], listeners = new Map();
  const setTimer = (callback, delay, interval = false) => {
    const id = ++timerId;
    timers.set(id, { callback, at: now + delay, delay, interval });
    return id;
  };
  const client = {
    channel(name) {
      const channel = {
        name, active: true, subscribed: false,
        on(_type, filter, receive) { this.event = filter.event; this.receive = receive; return this; },
        subscribe(status) {
          this.status = (value) => { this.subscribed = value === "SUBSCRIBED"; status(value); };
          if (online) this.status("SUBSCRIBED");
        },
        async send({ event, payload }) {
          for (const peer of channels) {
            if (peer !== this && peer.active && peer.subscribed && peer.name === name && peer.event === event) {
              peer.receive({ payload });
            }
          }
          return "ok";
        }
      };
      channels.push(channel);
      return channel;
    },
    async removeChannel(channel) { channel.active = false; channel.status("CLOSED"); }
  };
  const context = vm.createContext({
    __SUPABASE_URL__: "https://example.supabase.co", __SUPABASE_PUBLISHABLE_KEY__: "public-key",
    crypto: webcrypto, console, queueMicrotask,
    Date: class extends Date { static now() { return now; } },
    setInterval: (fn, ms) => setTimer(fn, ms, true), clearInterval: (id) => timers.delete(id),
    setTimeout: (fn, ms) => setTimer(fn, ms), clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name)
  });
  const dependency = new vm.SyntheticModule(["createClient"], function () {
    this.setExport("createClient", () => client);
  }, { context });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => dependency);
  await module.evaluate();
  return {
    ...module.namespace, channels, listeners, timers,
    setOnline(value) { online = value; },
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const entry = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, timer] = entry;
        now = timer.at;
        if (timer.interval) timer.at += timer.delay;
        else timers.delete(id);
        timer.callback();
        await flush();
      }
      now = end;
    }
  };
}

test("pairing supplies the current paused state, not just an acknowledgement", async () => {
  const h = await harness();
  const stage = h.createStageSession("ABC234");
  stage.on("message", (message) => {
    if (message.type === "hello") stage.send({ type: "state", state: { running: false, speed: 65 } });
  });
  await flush();
  const remote = h.connectRemote(stage.code);
  let state;
  remote.on("message", (message) => { state = message.state; });
  await flush();
  assert.equal(state.speed, 65);
  assert.equal(state.running, false);
  stage.close(); remote.close();
});

test("an unreachable relay emits a service error and retry preserves the code", async () => {
  const h = await harness(false);
  const stage = h.createStageSession("ABC234");
  let outage = 0, ready;
  stage.on("unavailable", () => outage++);
  stage.on("ready", (value) => { ready = value.code; });
  await flush();
  await h.advance(10001);
  assert.equal(outage, 1);
  h.setOnline(true);
  stage.retry();
  await flush();
  assert.equal(ready, "ABC234");
  stage.close();
});

test("network recovery re-handshakes and does not replay disconnected toggles", async () => {
  const h = await harness();
  const stage = h.createStageSession("ABC234");
  let controls = 0, connections = 0, errors = 0;
  stage.on("message", (message) => { if (message.type === "command") controls++; });
  await flush();
  const remote = h.connectRemote(stage.code);
  remote.on("connected", () => connections++);
  remote.on("error", () => errors++);
  await flush();
  assert.equal(connections, 1);
  h.channels[1].status("CHANNEL_ERROR");
  remote.send({ type: "command", action: "toggle" });
  assert.equal(errors, 1);
  assert.equal(controls, 0);
  h.channels[1].status("SUBSCRIBED");
  await flush();
  assert.equal(connections, 2);
  remote.send({ type: "command", action: "pause" });
  await flush();
  assert.equal(controls, 1);
  await h.advance(4000);
  assert.equal(controls, 1);
  stage.close(); remote.close();
});

test("a later outage is detected after a successful subscription", async () => {
  const h = await harness();
  const stage = h.createStageSession("ABC234");
  let outages = 0;
  stage.on("unavailable", () => outages++);
  await flush();
  h.channels[0].status("CHANNEL_ERROR");
  await h.advance(10001);
  assert.equal(outages, 1);
  stage.close();
});

test("closing before startup creates no channel, timers, or callbacks", async () => {
  const h = await harness();
  const stage = h.createStageSession("ABC234");
  stage.close();
  await flush();
  assert.equal(h.channels.length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
});
