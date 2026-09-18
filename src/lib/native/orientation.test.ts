import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

type Win = {
  DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
  localStorage: { getItem(k: string): string | null; setItem(k: string, v: string): void };
};

function installWindow(requestPermission?: () => Promise<string>): Map<string, string> {
  const store = new Map<string, string>();
  const win: Win = {
    DeviceOrientationEvent: requestPermission ? { requestPermission } : undefined,
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    },
  };
  (globalThis as unknown as { window: Win }).window = win;
  return store;
}

beforeEach(() => {
  delete (globalThis as unknown as { window?: Win }).window;
});

test("a platform with no permission gate is treated as already granted", async () => {
  const store = installWindow();
  const { requestTilt, tiltNeedsPermission } = await import("@/lib/native/orientation?no-gate");
  assert.equal(tiltNeedsPermission(), false);
  assert.equal(await requestTilt(), "granted");
  assert.equal(store.get("cuidala.motionTilt"), "granted");
});

test("the system prompt is asked once and the answer is remembered", async () => {
  let calls = 0;
  const store = installWindow(async () => {
    calls += 1;
    return "granted";
  });
  const { requestTilt } = await import("@/lib/native/orientation?asks-once");
  assert.equal(await requestTilt(), "granted");
  assert.equal(await requestTilt(), "granted");
  assert.equal(calls, 1, "the prompt was shown more than once");
  assert.equal(store.get("cuidala.motionTilt"), "granted");
});

test("a refusal is remembered so the prompt never comes back", async () => {
  let calls = 0;
  const store = installWindow(async () => {
    calls += 1;
    return "denied";
  });
  const { requestTilt } = await import("@/lib/native/orientation?denied");
  assert.equal(await requestTilt(), "denied");
  assert.equal(await requestTilt(), "denied");
  assert.equal(calls, 1);
  assert.equal(store.get("cuidala.motionTilt"), "denied");
});

test("a throw (no user gesture) is not remembered, so a later tap can ask again", async () => {
  const store = installWindow(async () => {
    throw new Error("not a user gesture");
  });
  const { requestTilt } = await import("@/lib/native/orientation?throws");
  assert.equal(await requestTilt(), "denied");
  assert.equal(store.get("cuidala.motionTilt"), undefined);
});
