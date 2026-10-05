import assert from "node:assert/strict";
import { test } from "node:test";
import { installScanPluginForTests, readPhoto, scanAny, scanLabel, scanSupported } from "@/lib/native/scan";

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

test("scanAny and readPhoto return lines and barcodes, off native they are unavailable", async () => {
  assert.deepEqual(await scanAny(), { ok: false, reason: "unavailable" });
  assert.deepEqual(await readPhoto(), { ok: false, reason: "unavailable" });
  const payload = { lines: ["BOX", 5 as unknown as string], barcodes: [{ value: "0123", symbology: "EAN13" }, { value: "" }] as never };
  installScanPluginForTests({
    isSupported: async () => ({ supported: true }),
    scanLabel: async () => ({ lines: [] }),
    scanAny: async () => payload,
    readPhoto: async () => payload,
  });
  const expected = { ok: true, lines: ["BOX"], barcodes: [{ value: "0123", symbology: "EAN13" }] };
  assert.deepEqual(await scanAny(), expected);
  assert.deepEqual(await readPhoto(), expected);
});

test("scanAny and readPhoto map rejection codes and never throw", async () => {
  for (const code of ["cancelled", "denied", "unsupported"] as const) {
    const reject = async () => Promise.reject(Object.assign(new Error("x"), { code }));
    installScanPluginForTests({ isSupported: async () => ({ supported: true }), scanLabel: reject, scanAny: reject, readPhoto: reject });
    assert.deepEqual(await scanAny(), { ok: false, reason: code });
    assert.deepEqual(await readPhoto(), { ok: false, reason: code });
  }
  installScanPluginForTests({ isSupported: async () => ({ supported: true }), scanLabel: async () => ({ lines: [] }) });
  assert.deepEqual(await readPhoto(), { ok: false, reason: "unavailable" });
});
