import test from "node:test";
import assert from "node:assert/strict";
import { BEATS, STAGES, STAGE_ORDER } from "../src/data/beats.js";
import { DIALOGUE } from "../src/data/dialogue.js";
import { NOTES } from "../src/data/notes.js";
import {
  Navigation,
  blocked,
  slide,
  lineClear,
} from "../src/systems/navigation.js";
import { TriggerSystem } from "../src/systems/triggers.js";
import { readFile } from "node:fs/promises";
test("the full narrative is a connected chain ending in the supplied voicemail", () => {
  let stage = "arrival";
  const seen = new Set();
  while (stage !== "end") {
    assert.ok(!seen.has(stage), "No circular story progression");
    seen.add(stage);
    const beat = BEATS.find(
      (b) => b.stage === stage && b.effects.some((e) => e.type === "stage"),
    );
    assert.ok(beat, stage + " has a playable transition");
    for (const e of beat.effects) {
      if (e.type === "dialogue") assert.ok(DIALOGUE[e.id]);
      if (e.type === "read") assert.ok(NOTES[e.note]);
    }
    const next = beat.effects.find((e) => e.type === "stage");
    assert.ok(STAGES[next.stage]);
    stage = next.stage;
  }
  assert.equal(seen.size, STAGE_ORDER.length - 1);
  assert.equal(DIALOGUE.lastVoicemail.at(-1).text, "I am.");
});
test("spoken dialogue keeps source wording and excludes new exposition", async () => {
  const source = await readFile(
    new URL("../assets/STORY-SOURCE.txt", import.meta.url),
    "utf8",
  );
  const normalize = (s) =>
    s.replace(/[’‘]/g, "'").replace(/[“”]/g, "").replace(/\s+/g, " ");
  const all = normalize(source);
  const approved = new Set([
    "Mara… is it really you?",
    "It’s me, Eli.",
    "You’re really here.",
    "I waited for you.",
    "Do you still talk to your school friends?",
    "Do you think I'd have been happy?",
    "You were scared.",
  ]);
  for (const group of Object.values(DIALOGUE))
    for (const l of group) {
      if (l.text && !l.text.startsWith("["))
        assert.ok(
          approved.has(l.text) || all.includes(normalize(l.text)),
          l.text + " matches source",
        );
    }
});
test("movement slides along walls and never tunnels at high speed", () => {
  const obstacles = [{ minX: 1, maxX: 1.2, minZ: -4, maxZ: 4 }];
  const p = { x: 0, z: 0 };
  slide(p, 10, 2, obstacles);
  assert.ok(p.x < 0.8);
  assert.equal(Math.round(p.z), 2);
  assert.equal(blocked(p.x, p.z, obstacles), false);
});
test("navigation routes around walls through a real gap", () => {
  const obstacles = [
    { minX: 1, maxX: 2, minZ: -4, maxZ: 1 },
    { minX: 1, maxX: 2, minZ: 3, maxZ: 7 },
  ];
  const nav = new Navigation(obstacles),
    path = nav.path({ x: 0, z: 0 }, { x: 4, z: 0 });
  assert.ok(path.length > 0);
  assert.ok(path.some((p) => p.z >= 1.5));
  assert.equal(lineClear({ x: 0, z: 0 }, { x: 4, z: 0 }, obstacles), false);
  for (const p of path) assert.ok(!blocked(p.x, p.z, obstacles, 0.29));
});
test("triggers serialize effects, fire once, and cancel stale progression", async () => {
  const log = [];
  let release;
  const t = new TriggerSystem({
    mark: (e) => log.push(e.id),
    wait: () => new Promise((r) => (release = r)),
  });
  const a = {
    id: "a",
    effects: [
      { type: "mark", id: 1 },
      { type: "wait" },
      { type: "mark", id: 2 },
    ],
  };
  const running = t.run(a, {});
  await Promise.resolve();
  assert.equal(await t.run(a, {}), false);
  t.reset();
  release();
  await running;
  assert.deepEqual(log, [1]);
  assert.equal(t.busy, false);
  assert.equal(
    await t.run({ id: "b", effects: [{ type: "mark", id: 3 }] }, {}),
    true,
  );
  assert.deepEqual(log, [1, 3]);
});
