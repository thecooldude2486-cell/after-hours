import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { loadMaraModel, createMara } from "../src/world/mara.js";
import { createTeacher, animateTeacher } from "../src/world/teacher-model.js";
import { createSchool } from "../src/world/school.js";
import { InventorySystem } from "../src/systems/inventory.js";
import { InteractionSystem } from "../src/systems/interaction.js";
import { AmbushSystem } from "../src/systems/ambushes.js";
import { CaptureSystem } from "../src/systems/capture.js";
import { DEFAULTS } from "../src/data/config.js";
import { applyPreset } from "../src/data/presets.js";
const ui = new Map();
const element = () => ({
  textContent: "",
  style: {},
  classList: {
    values: new Set(),
    add(v) {
      this.values.add(v);
    },
    remove(v) {
      this.values.delete(v);
    },
    contains(v) {
      return this.values.has(v);
    },
  },
  addEventListener() {},
});
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  querySelector: (s) => {
    if (!ui.has(s)) ui.set(s, element());
    return ui.get(s);
  },
  createElement: () => ({ ...element(), getContext: () => ctx }),
  exitPointerLock() {},
};
const bytes = await readFile(
  new URL("../assets/models/mara-base.glb", import.meta.url),
);
await loadMaraModel(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
function fixture(preset = "normal") {
  const config = { ...DEFAULTS };
  applyPreset(config, preset);
  const g = {
    config,
    paused: false,
    recovering: false,
    ended: false,
    attempts: 0,
    world: { scene: new THREE.Scene(), teacher: new THREE.Group() },
    camera: new THREE.PerspectiveCamera(68, 1, 0.06, 90),
    player: {
      position: new THREE.Vector3(8, 1.65, -19),
      yaw: 0,
      keys: new Set(),
      sanity: 100,
      leaveHide() {},
      syncCamera() {},
    },
    interactions: { reader: false, hold: null },
    teacher: { active: false },
    audio: {
      cue(id) {
        (g.cues ||= []).push(id);
      },
      stopLine() {},
    },
    dialogue: { current: null, reset() {} },
    cinematics: {
      active: null,
      async play(id) {
        g.shot = id;
      },
    },
    story: {
      stage: "drawing",
      epoch: 0,
      triggers: { busy: false, reset() {} },
      save() {
        g.saved = g.ambushes.snapshot();
      },
    },
    cheats: {},
    requestLock() {},
  };
  g.camera.position.copy(g.player.position);
  g.ambushes = new AmbushSystem(g);
  g.catchPlayer = (reason, attacker) => {
    g.reason = reason;
    g.attacker = attacker;
    g.recovering = true;
  };
  return g;
}
function attack(g) {
  g.ambushes.update(0.01, 0);
  assert.equal(g.ambushes.active.phase, "struggle");
  assert.equal(g.ambushes.blocking, true);
}
test("Teacher is a separate animated human skeleton; burned materials never mutate Mara or the memory teacher", () => {
  const mara = createMara(),
    teacher = createTeacher(),
    memory = createTeacher("teacher-memory");
  let skinned = 0;
  teacher.traverse((o) => {
    if (o.isSkinnedMesh) skinned++;
  });
  assert.ok(skinned > 5);
  assert.notEqual(teacher.userData.head, mara.userData.head);
  assert.notEqual(teacher.userData.head, memory.userData.head);
  const human = mara.userData.model.getObjectByName("Cube032"),
    burned = teacher.userData.model.getObjectByName("Cube032");
  assert.notEqual(human.material, burned.material);
  assert.equal(burned.material.customProgramCacheKey(), "vale-charred-v5");
  assert.notEqual(
    human.material.color.getHex(),
    burned.material.color.getHex(),
  );
  assert.ok(teacher.userData.badge);
  assert.ok(teacher.userData.skirt);
  animateTeacher(teacher, 0.02, 1);
  assert.ok(Number.isFinite(teacher.userData.head.quaternion.w));
});
test("closed storage cannot yield hidden items; opening reveals them, collection and open state persist", async () => {
  const config = { ...DEFAULTS };
  applyPreset(config, "normal");
  const world = createSchool({}, config);
  const g = {
    config,
    world,
    audio: { cue() {} },
    story: { save() {}, refreshObjective() {} },
    player: {},
    teacher: {},
    cheats: {},
  };
  g.inventory = new InventorySystem(g);
  g.interactions = new InteractionSystem(g);
  g.inventory.restore({});
  const t = world.interactables.find((t) => t.id === "item_classroomKey"),
    container = t.container;
  assert.equal(world.storage.filter(c => !c.fixed).length, 30);
  assert.equal(world.storage.filter(c => c.fixed).length, 12);
  assert.equal(t.mesh.visible, false);
  assert.equal(t.enabled, false);
  await g.interactions.use(t);
  assert.equal(g.inventory.has("classroomKey"), false);
  await g.interactions.use(container);
  assert.equal(container.open, true);
  assert.equal(t.enabled, false, "Cannot collect through the moving face");
  world.update(0.6, 1, { position: new THREE.Vector3() });
  g.inventory.syncStorage();
  assert.equal(t.enabled, true);
  assert.equal(t.mesh.parent, container.tray);
  await g.interactions.use(t);
  assert.equal(g.inventory.has("classroomKey"), true);
  assert.equal(t.mesh.visible, false);
  const saved = g.inventory.snapshot();
  g.inventory.reset();
  g.inventory.restore(saved);
  assert.equal(container.open, true);
  assert.equal(t.enabled, false);
  assert.ok(g.inventory.has("classroomKey"));
  const other = world.interactables.find((t) => t.id === "item_staffKey");
  g.inventory.toggleStorage(other.container);
  world.update(0.6, 2, { position: new THREE.Vector3() });
  g.inventory.syncStorage();
  assert.equal(other.enabled, true);
  g.inventory.toggleStorage(other.container);
  assert.equal(other.enabled, false);
  await g.interactions.use(other);
  assert.equal(g.inventory.has("staffKey"), false);
});
test("room monsters grab immediately without warning, suppress during dialogue and freeze while paused", () => {
  for (const preset of ["story", "normal"]) {
    const g = fixture(preset);
    g.dialogue.current = {};
    g.ambushes.update(10, 0);
    assert.equal(g.ambushes.active, null);
    g.dialogue.current = null;
    attack(g);
    assert.deepEqual(g.cues, ["officeMonster"]);
    assert.equal(
      document.querySelector("#ambushTitle").textContent,
      "IT'S GOT YOU",
    );
    assert.ok(g.ambushes.monster.visible);
    assert.ok(g.player.sanity < 86);
    const elapsed = g.ambushes.active.elapsed,
      sanity = g.player.sanity;
    g.paused = true;
    g.ambushes.update(100, 3);
    assert.equal(g.ambushes.active.elapsed, elapsed);
    assert.equal(g.player.sanity, sanity);
    g.paused = false;
    g.ambushes.update(1, 4);
    assert.equal(g.player.sanity, sanity - g.config.monsterSanityDrain);
  }
});
test("holding E never counts as escape; fresh taps escape and the room stays cleared after restore", () => {
  const g = fixture();
  attack(g);
  const a = g.ambushes.active;
  assert.equal(document.querySelector("#ambushInstruction").textContent, "SPAM E TO BREAK FREE");
  assert.equal(document.querySelector("#struggleProgress").textContent, "0 / 16 PRESSES");
  for (let i = 0; i < 30; i++) g.ambushes.tap({ code: "KeyE", repeat: true });
  assert.equal(a.taps, 0);
  assert.match(document.querySelector("#ambushHelp").textContent, /RELEASE E/);
  assert.equal(document.querySelector("#ambush").classList.contains("pressed"), false);
  g.ambushes.tap({ code: "KeyF", repeat: false });
  assert.equal(a.taps, 0);
  for (let i = 0; i < a.rules.taps; i++) {
    g.ambushes.update(0.1, i / 10 + 3);
    g.ambushes.tap({ code: "KeyE", repeat: false });
    if (i === 0) {
      assert.ok(document.querySelector("#ambush").classList.contains("pressed"));
      assert.equal(document.querySelector("#struggleProgress").textContent, "1 / 16 PRESSES");
      assert.equal(document.querySelector("#struggleFill").style.width, "6.25%");
      assert.match(document.querySelector("#ambushHelp").textContent, /Press, release/);
    }
  }
  g.ambushes.update(0.2, 5);
  assert.equal(g.ambushes.active, null);
  assert.ok(g.ambushes.cleared.has("office-shape"));
  assert.equal(g.reason, undefined);
  g.ambushes.reset(g.saved);
  g.ambushes.update(10, 20);
  assert.equal(g.ambushes.active, null);
});
test("room timeout is lethal even in Story; retry and explicit safety cheats still work", () => {
  const g = fixture("nightmare");
  attack(g);
  g.ambushes.update(8, 12);
  assert.equal(g.reason, "ambush");
  assert.equal(g.attacker, g.ambushes.monster);
  assert.equal(g.ambushes.cleared.size, 0);
  g.recovering = false;
  g.ambushes.reset({});
  attack(g);
  assert.equal(
    g.ambushes.blocking,
    true,
    "Failed encounter returns on checkpoint retry",
  );
  for (const preset of ["story", "normal"]) {
    const safe = fixture(preset);
    attack(safe);
    safe.ambushes.update(12, 15);
    assert.equal(safe.reason, "ambush");
    assert.equal(safe.ambushes.cleared.size, 0);
    const invincible = fixture(preset);
    invincible.cheats.invincible = true;
    attack(invincible);
    invincible.ambushes.update(12, 15);
    assert.equal(invincible.reason, undefined);
    assert.ok(invincible.ambushes.cleared.has("office-shape"));
  }
  const disabled = fixture();
  disabled.cheats.disableMonsters = true;
  disabled.ambushes.update(10, 10);
  assert.equal(disabled.ambushes.active, null);
});
test("Story blocks Teacher capture but monster death uses its own shot and retries the checkpoint", async () => {
  const g = fixture("story");
  const original = g.world.teacher.position.clone();
  g.world.teacher.visible = false;
  g.story.start = async (stage) => {
    assert.equal(stage, "drawing");
    g.ambushes.reset({});
  };
  g.audio.resume = () => {};
  const capture = new CaptureSystem(g);
  await capture.catchPlayer("caught");
  assert.equal(g.recovering, false);
  assert.equal(g.attempts, 0);
  assert.equal(g.shot, undefined);
  await capture.catchPlayer("ambush", g.ambushes.monster);
  assert.equal(g.shot, "ambushCapture");
  assert.equal(g.world.teacher.visible, false);
  assert.ok(g.world.teacher.position.equals(original));
  assert.match(document.querySelector("#deathTip").textContent, /E/);
  assert.equal(g.retryStage, "drawing");
  await capture.retry();
  assert.equal(g.recovering, false);
  assert.equal(g.ambushes.monster.visible, false);
});

test("room monsters drain sanity to zero without blocking escape; infinite sanity preserves the bar but not the deadline", () => {
  const g = fixture("story");
  g.player.sanity = 20;
  attack(g);
  g.ambushes.update(1, 1);
  assert.equal(g.player.sanity, 0);
  assert.equal(g.reason, undefined);
  const taps = g.ambushes.active.rules.taps;
  for (let i = 0; i < taps; i++) {
    g.ambushes.update(0.1, 2 + i / 10);
    g.ambushes.tap({ code: "KeyE", repeat: false });
  }
  assert.ok(g.ambushes.cleared.has("office-shape"));
  assert.equal(g.reason, undefined);
  const infinite = fixture("story");
  infinite.player.sanity = 20;
  infinite.cheats.infiniteSanity = true;
  attack(infinite);
  infinite.ambushes.update(2, 2);
  assert.equal(infinite.player.sanity, 20);
  assert.equal(infinite.reason, undefined);
  infinite.ambushes.update(8, 10);
  assert.equal(
    infinite.reason,
    "ambush",
    "Infinite sanity does not remove the escape deadline",
  );
});
