import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/storage.js", import.meta.url), "utf8");

async function storage(settings) {
  const entries = new Map([
    ["promptly.settings.v1", JSON.stringify(settings)],
    ["promptly.library.v1", '[{"id":"my-script","body":"First paragraph, then last paragraph"}]']
  ]);
  const context = vm.createContext({
    localStorage: { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) }
  });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => {});
  await module.evaluate();
  return { ...module.namespace, entries };
}

test("old vertical mirroring migrates to the normal flip without changing scripts", async () => {
  const saved = await storage({ mirrorX: false, mirrorY: true, fontSize: 64 });
  const settings = saved.getSettings();
  assert.equal(settings.mirrorX, true);
  assert.equal(Object.hasOwn(settings, "mirrorY"), false);
  assert.equal(settings.fontSize, 64);
  assert.equal(JSON.parse(saved.entries.get("promptly.settings.v1")).mirrorY, undefined);
  assert.equal(saved.getLibrary()[0].body, "First paragraph, then last paragraph");
  assert.equal(saved.saveSettings({ mirrorX: false }).mirrorX, false);
  assert.equal(saved.getSettings().mirrorX, false);
});

test("normal mirror preferences are preserved and obsolete vertical settings cannot be saved", async () => {
  const saved = await storage({ mirrorX: true });
  assert.equal(saved.getSettings().mirrorX, true);
  saved.saveSettings({ mirrorY: true });
  assert.equal(Object.hasOwn(JSON.parse(saved.entries.get("promptly.settings.v1")), "mirrorY"), false);
});

test("a corrupt saved speed cannot reverse playback", async () => {
  const saved = await storage({ speed: -70, mirrorX: false, mirrorY: false });
  assert.equal(saved.getSettings().speed, 20);
  assert.equal(saved.getSettings().mirrorX, false);
});
