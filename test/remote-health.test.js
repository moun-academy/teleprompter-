import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../api/remote-health.js", import.meta.url), "utf8");

async function run({ method = "GET", env = {}, fails = false } = {}) {
  let queries = 0, connection;
  const context = vm.createContext({ process: { env } });
  const dependency = new vm.SyntheticModule(["default"], function () {
    this.setExport("default", (url) => {
      connection = url;
      return async (parts) => {
        assert.equal(parts.join(""), "select 1 as healthy");
        queries++;
        if (fails) throw new Error("private-database-password");
      };
    });
  }, { context });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => dependency);
  await module.evaluate();
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; }
  };
  await module.namespace.default({ method }, response);
  return { response, queries, connection };
}

test("health check uses the replacement DB for three harmless user queries", async () => {
  const result = await run({ env: { RELAY_POSTGRES_URL: "new-server", POSTGRES_URL: "old-server" } });
  assert.equal(result.connection, "new-server");
  assert.equal(result.queries, 3);
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.ok, true);
});

test("missing configuration and database failures return 503 without secrets", async () => {
  const missing = await run();
  assert.equal(missing.response.statusCode, 503);
  const failure = await run({ env: { POSTGRES_URL: "private-url" }, fails: true });
  assert.equal(failure.response.statusCode, 503);
  assert.equal(JSON.stringify(failure.response.body), '{"ok":false}');
  assert.equal(failure.response.headers["Cache-Control"], "no-store");
});

test("health endpoint rejects writes", async () => {
  const result = await run({ method: "POST" });
  assert.equal(result.response.statusCode, 405);
  assert.equal(result.queries, 0);
});
