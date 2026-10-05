import assert from "node:assert/strict";
import { test } from "node:test";
import {
  endPowerHourActivity,
  installPowerHourPluginForTests,
  startPowerHourActivity,
  updatePowerHourActivity,
  type PowerHourPlugin,
} from "@/lib/native/power-hour";

test.afterEach(() => installPowerHourPluginForTests(null));

const input = { title: "Power hour", total: 6, left: 6, nextTitle: "Dishes", endsAtMs: 1_000_000 };

function fake(overrides: Partial<PowerHourPlugin> = {}): PowerHourPlugin {
  return {
    startPowerHour: async () => ({ started: true }),
    updatePowerHour: async () => {},
    endPowerHour: async () => {},
    ...overrides,
  };
}

test("off iOS everything is unavailable or a no-op and nothing throws", async () => {
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "unavailable" });
  await updatePowerHourActivity({ left: 3 });
  await endPowerHourActivity(true);
});

test("start passes the payload through and reports ok", async () => {
  let seen: unknown;
  installPowerHourPluginForTests(
    fake({
      startPowerHour: async (options) => {
        seen = options;
        return { started: true };
      },
    }),
  );
  assert.deepEqual(await startPowerHourActivity(input), { ok: true });
  assert.deepEqual(seen, input);
});

test("start maps native reasons and failures", async () => {
  installPowerHourPluginForTests(fake({ startPowerHour: async () => ({ started: false, reason: "disabled" }) }));
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "disabled" });
  installPowerHourPluginForTests(fake({ startPowerHour: async () => ({ started: false, reason: "unsupported" }) }));
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "unsupported" });
  installPowerHourPluginForTests(fake({ startPowerHour: async () => ({ started: false, reason: "lol" }) }));
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "failed" });
  installPowerHourPluginForTests(fake({ startPowerHour: async () => Promise.reject(new Error("boom")) }));
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "failed" });
  installPowerHourPluginForTests(fake({ startPowerHour: async () => null as never }));
  assert.deepEqual(await startPowerHourActivity(input), { ok: false, reason: "failed" });
});

test("update and end forward their arguments and swallow errors", async () => {
  const calls: unknown[] = [];
  installPowerHourPluginForTests(
    fake({
      updatePowerHour: async (o) => void calls.push(["update", o]),
      endPowerHour: async (o) => void calls.push(["end", o]),
    }),
  );
  await updatePowerHourActivity({ left: 2, nextTitle: "Floors", endsAtMs: 5 });
  await endPowerHourActivity(true);
  await endPowerHourActivity(false);
  assert.deepEqual(calls, [
    ["update", { left: 2, nextTitle: "Floors", endsAtMs: 5 }],
    ["end", { finished: true }],
    ["end", { finished: false }],
  ]);
  installPowerHourPluginForTests(
    fake({
      updatePowerHour: async () => Promise.reject(new Error("x")),
      endPowerHour: async () => Promise.reject(new Error("x")),
    }),
  );
  await updatePowerHourActivity({ left: 1 });
  await endPowerHourActivity(false);
});
