import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { DUR_AMBIENT, DUR_BASE, DUR_INSTANT, DUR_QUICK, DUR_SCREEN } from "@/lib/motion";

const COMPONENTS_DIR = join(__dirname, "..", "components");

/**
 * A `duration:` value between 0 and 1 (inclusive) is a `motion/react`
 * transition timing expressed in seconds. Anything outside that range is a
 * different kind of value entirely — a toast's millisecond timeout, a
 * per-instance CSS animation length built from a variable — and is left
 * alone deliberately, not missed.
 *
 * The number must not be preceded by a token character, so this does not
 * flag `duration: DUR_QUICK` (the whole point of the token file) by matching
 * a stray digit inside an identifier.
 */
const RAW_DURATION = /duration:\s*(?<![\w])[01](?:\.\d+)?\b/;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...tsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

test("no component hardcodes a raw motion duration — use a token from lib/motion", () => {
  const offenders: string[] = [];
  for (const file of tsxFiles(COMPONENTS_DIR)) {
    const contents = readFileSync(file, "utf8");
    const lines = contents.split("\n");
    lines.forEach((line, index) => {
      if (RAW_DURATION.test(line)) {
        offenders.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `Found raw duration literal(s) — replace with DUR_INSTANT/DUR_QUICK/DUR_BASE/DUR_SCREEN/DUR_AMBIENT from @/lib/motion:\n${offenders.join("\n")}`,
  );
});

test("the duration scale is ordered and each step is a meaningful jump from the last", () => {
  const scale = [DUR_INSTANT, DUR_QUICK, DUR_BASE, DUR_SCREEN, DUR_AMBIENT];
  for (let i = 1; i < scale.length; i++) {
    assert.ok(scale[i] > scale[i - 1], `step ${i} (${scale[i]}) is not slower than step ${i - 1} (${scale[i - 1]})`);
    assert.ok(
      scale[i] / scale[i - 1] >= 1.25,
      `step ${i} (${scale[i]}) is too close to step ${i - 1} (${scale[i - 1]}) to read as distinct`,
    );
  }
});
