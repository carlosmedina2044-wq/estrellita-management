import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ILLUSTRATIONS, MOMENTS } from "@/lib/illustrations";

const PUBLIC = path.join(process.cwd(), "public");

function walkSizes(dir: string): number {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += walkSizes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

test("MOMENTS Lottie JSON ships with WebP layers and no expressions", () => {
  for (const [id, moment] of Object.entries(MOMENTS)) {
    const rel = moment.path.replace(/^\//, "");
    const jsonPath = path.join(PUBLIC, rel);
    assert.ok(fs.existsSync(jsonPath), `${id} missing at ${jsonPath}`);
    const source = fs.readFileSync(jsonPath, "utf8");
    assert.equal(source.includes('"x":"'), false, `${id} contains expressions`);
    const data = JSON.parse(source) as {
      fr: number;
      w: number;
      assets?: Array<{ p?: string; u?: string }>;
    };
    assert.equal(data.fr, 60, `${id} fr`);
    assert.equal(data.w, 512, `${id} w`);
    for (const asset of data.assets ?? []) {
      if (!asset.p) continue;
      assert.ok(asset.p.endsWith(".webp"), `${id} asset ${asset.p} not webp`);
      const assetPath = path.join(path.dirname(jsonPath), asset.u ?? "images/", asset.p);
      assert.ok(fs.existsSync(assetPath), `${id} missing layer ${assetPath}`);
    }
  }
});

test("breathing-loop hides the Breathing sun layer", () => {
  const jsonPath = path.join(PUBLIC, "illustrations/lottie/breathing-loop/breathing-loop.json");
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
    layers?: Array<{ nm?: string; hd?: boolean }>;
  };
  const sun = data.layers?.find((layer) => layer.nm === "Breathing sun");
  assert.ok(sun, "Breathing sun layer missing");
  assert.equal(sun.hd, true);
});

test("ILLUSTRATIONS still files exist", () => {
  for (const [name, art] of Object.entries(ILLUSTRATIONS)) {
    const rel = art.src.replace(/^\//, "");
    const filePath = path.join(PUBLIC, rel);
    assert.ok(fs.existsSync(filePath), `${name} missing at ${filePath}`);
  }
});

test("public/illustrations stays within 500 KB", () => {
  const root = path.join(PUBLIC, "illustrations");
  const bytes = walkSizes(root);
  assert.ok(
    bytes <= 500 * 1024,
    `illustrations pack is ${(bytes / 1024).toFixed(1)} KB (budget 500 KB)`,
  );
});
