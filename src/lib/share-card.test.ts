import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  closedDayCardModel,
  SKY_HEIGHT,
  stackBox,
  windowOnCard,
  yearCardModel,
} from "@/lib/share-card";

test("the house box is centred, fills most of the width and sits on the panel edge", () => {
  const box = stackBox({ w: 936, h: 672 });
  assert.equal(box.x * 2 + box.w, CARD_WIDTH);
  assert.ok(box.w > CARD_WIDTH * 0.7 && box.w < CARD_WIDTH * 0.85);
  assert.ok(box.y + box.h > SKY_HEIGHT, "the base of the box dips just under the panel edge");
  assert.ok(box.y + box.h < SKY_HEIGHT + box.h * 0.1);
  assert.ok(CARD_HEIGHT > SKY_HEIGHT);
});

test("a window rect maps proportionally onto the card", () => {
  const frame = { w: 936, h: 672 };
  const box = stackBox(frame);
  const on = windowOnCard({ id: "w1", x: 468, y: 336, w: 93.6, h: 67.2 }, frame, box);
  assert.ok(Math.abs(on.x - (box.x + box.w / 2)) < 0.01);
  assert.ok(Math.abs(on.y - (box.y + box.h / 2)) < 0.01);
  assert.ok(Math.abs(on.w - box.w / 10) < 0.01);
});

test("closed-day and year models hide the home name in private mode", () => {
  const closed = closedDayCardModel({
    home: "Casa",
    headline: "Day closed",
    done: 3,
    minutes: 30,
    rooms: 2,
    labels: { done: "things done", minutes: "minutes given", rooms: "rooms touched" },
    runLine: "Day 12",
    careLine: "Kept",
    brand: "Cuidala",
    privateMode: false,
  });
  assert.equal(closed.subline, "Casa · Kept");
  assert.equal(closed.stats.length, 3);
  assert.equal(closed.footnote, "Day 12");
  const year = yearCardModel({
    home: "Casa",
    headline: "2026, wrapped",
    closedDays: 210,
    bestRun: 31,
    hoursText: "42 hours",
    labels: { closed: "closed days", best: "best run", hours: "given to the house" },
    careLine: "Loved",
    brand: "Cuidala",
    privateMode: true,
  });
  assert.equal(year.subline, "Loved");
  assert.equal(year.footnote, null);
});
