import assert from "node:assert/strict";
import { test } from "node:test";
import { installScanPluginForTests, scanLabel, scanSupported } from "@/lib/native/scan";

test.afterEach(() => installScanPluginForTests(null));

test("off native the scanner is unavailable and nothing throws", async () => {
  assert.equal(await scanSupported(), false);
  assert.deepEqual(await scanLabel(), { ok: false, reason: "unavailable" });
});

test("scanLabel passes the lines through", async () => {
  installScanPluginForTests({
    isSupported: async () => ({ supported: true }),
    scanLabel: async () => ({ lines: ["RHEEM", "MFG DATE 0314"] }),
  });
  assert.equal(await scanSupported(), true);
  assert.deepEqual(await scanLabel(), { ok: true, lines: ["RHEEM", "MFG DATE 0314"] });
});

test("known rejection codes map to reasons, others to unavailable", async () => {
  for (const code of ["cancelled", "denied", "unsupported"] as const) {
    installScanPluginForTests({
      isSupported: async () => ({ supported: true }),
      scanLabel: async () => Promise.reject(Object.assign(new Error("x"), { code })),
    });
    assert.deepEqual(await scanLabel(), { ok: false, reason: code });
  }
  installScanPluginForTests({
    isSupported: async () => Promise.reject(new Error("boom")),
    scanLabel: async () => Promise.reject(new Error("boom")),
  });
  assert.deepEqual(await scanLabel(), { ok: false, reason: "unavailable" });
  assert.equal(await scanSupported(), false);
});
