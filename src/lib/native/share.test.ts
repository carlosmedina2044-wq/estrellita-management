import assert from "node:assert/strict";
import { test } from "node:test";

type Nav = {
  share?: (data: unknown) => Promise<void>;
  clipboard: { writeText: (value: string) => Promise<void>; readText: () => Promise<string> };
};

function stubEnv(nav: Nav) {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = { navigator: globals.navigator, window: globals.window };
  const timers: Array<() => void> = [];
  Object.defineProperty(globals, "navigator", { value: nav, configurable: true, writable: true });
  globals.window = { setTimeout: (fn: () => void) => timers.push(fn) };
  return {
    timers,
    restore() {
      Object.defineProperty(globals, "navigator", { value: previous.navigator, configurable: true, writable: true });
      globals.window = previous.window;
    },
  };
}

test("a cancelled web share reports 'cancelled' and leaves the clipboard alone", async () => {
  let written: string[] = [];
  const env = stubEnv({
    share: async () => {
      const error = new Error("Share canceled");
      error.name = "AbortError";
      throw error;
    },
    clipboard: {
      writeText: async (value) => {
        written.push(value);
      },
      readText: async () => "",
    },
  });
  try {
    const { shareText } = await import("@/lib/native/share");
    assert.equal(await shareText("Title", "body"), "cancelled");
    assert.deepEqual(written, []);
  } finally {
    written = [];
    env.restore();
  }
});

test("with no share sheet the text is copied, and the later wipe skips a clipboard the user changed", async () => {
  const written: string[] = [];
  let clipboard = "";
  const env = stubEnv({
    clipboard: {
      writeText: async (value) => {
        written.push(value);
        clipboard = value;
      },
      readText: async () => clipboard,
    },
  });
  try {
    const { shareText } = await import("@/lib/native/share");
    assert.equal(await shareText("Title", "body"), "copied");
    assert.deepEqual(written, ["body"]);

    // The user copied something else before the 60s wipe fires.
    clipboard = "their own thing";
    env.timers.forEach((fn) => fn());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(written, ["body"]);

    // Still ours: the wipe goes ahead.
    clipboard = "body";
    env.timers.forEach((fn) => fn());
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(written, ["body", ""]);
  } finally {
    env.restore();
  }
});
