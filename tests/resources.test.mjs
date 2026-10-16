import test from "node:test";
import assert from "node:assert/strict";
import { ResourceSystem } from "../src/systems/resources.js";
import { InventorySystem } from "../src/systems/inventory.js";
import { CheatSystem } from "../src/systems/cheats.js";
import { PRESETS, applyPreset } from "../src/data/presets.js";
import { DEFAULTS } from "../src/data/config.js";
import { DIALOGUE } from "../src/data/dialogue.js";
import * as THREE from "../vendor/three.module.js";
const ui = new Map();
globalThis.document = {
  querySelector: (s) => {
    if (!ui.has(s))
      ui.set(s, {
        textContent: "",
        style: {},
        classList: { add() {}, remove() {} },
      });
    return ui.get(s);
  },
};
function fixture(preset = "normal") {
  const config = { ...DEFAULTS };
  applyPreset(config, preset);
  const g = {
    config,
    time: 1,
    world: {
      env: { state: "ruined" },
      doors: [],
      interactables: [],
      openDoor(d, v) {
        d.open = v;
      },
    },
    player: {
      battery: 70,
      sanity: 100,
      flashlight: true,
      hidden: null,
      moving: true,
      stamina: config.sprintCapacity,
      position: new THREE.Vector3(),
      syncFlashlight() {},
      leaveHide() {},
      teleport(x, z) {
        this.position.set(x, 1.65, z);
      },
    },
    teacher: { active: false },
    cinematics: { active: null },
    audio: { cue() {} },
    story: { stage: "survive", save() {}, refreshObjective() {} },
    interactions: { prompt: { textContent: "" } },
  };
  g.cheats = new CheatSystem(g);
  g.inventory = new InventorySystem(g);
  g.resources = new ResourceSystem(g);
  return g;
}
test("five distinct presets increase pursuit pressure and relocate each required item", async () => {
  const { ITEM_LAYOUTS } = await import("../src/data/items.js");
  const values = Object.values(PRESETS);
  assert.equal(values.length, 5);
  assert.equal(values[0].enemy, false);
  for (let i = 1; i < 5; i++) {
    assert.ok(values[i].chaseSpeed > values[i - 1].chaseSpeed);
    assert.ok(values[i].sprintCapacity < values[i - 1].sprintCapacity);
  }
  for (const anchors of Object.values(ITEM_LAYOUTS))
    assert.equal(new Set(anchors.map((a) => a.join(","))).size, 5);
});
test("safe exploration uses school lighting, and legacy battery saves cannot impose torch penalties", () => {
 const g=fixture();g.player.moving=true;
 g.resources.restore({battery:0,sanity:75});g.resources.update(20);
 assert.equal(g.player.sanity,75);assert.equal(g.resources.flashlightFactor,undefined);
 assert.deepEqual(g.resources.snapshot(),{sanity:75});
 g.player.lightsOut=true;g.resources.update(1);assert.ok(g.player.sanity<75);
});
test("fuse repair preserves school-power puzzles and locks still require matching tools", () => {
  const g = fixture(), inv = g.inventory;
  assert.equal(inv.repairPower(), false);
  inv.items.add("fuse");
  assert.equal(inv.repairPower(), true);
  assert.equal(inv.power, true);
  assert.equal(inv.has("fuse"), false);
  assert.equal(inv.repairPower(), true);
  const door = {
    id: "phoneGate",
    requires: "staffKey",
    position: new THREE.Vector3(),
  };
  assert.equal(inv.check(door), false);
  inv.items.add("staffKey");
  assert.equal(inv.check(door), true);
  inv.items.delete("staffKey");
  assert.equal(inv.check(door), true);
});
test("saved inventory restores collected props, grounding supplies and locks; old checkpoints receive only completed prerequisites", () => {
  const g = fixture(),
    inv = g.inventory;
  inv.items.add("lockerKey");
  inv.groundingKits = 3;
  inv.collected.add("item_lockerKey");
  inv.unlocked.add("bracelet");
  const save = inv.snapshot();
  inv.reset();
  inv.restore(save);
  assert.ok(inv.has("lockerKey"));
  assert.equal(inv.groundingKits, 3);
  assert.ok(inv.unlocked.has("bracelet"));
  inv.reset();
  inv.hydrateStage("survive");
  assert.ok(inv.has("classroomKey"));
  assert.equal(inv.has("staffKey"), false);
  assert.equal(inv.has("recordsKey"), false);
  assert.equal(inv.has("cutters"), false);
  assert.equal(inv.unlocked.has("phoneGate"), false);
  inv.reset();
  inv.hydrateStage("waiting");
  assert.ok(inv.has("recordsKey"));
  assert.equal(inv.has("cutters"), false);
  assert.equal(inv.power, true);
  g.resources.restore({ battery: 0, sanity: 5 }, true);
  assert.equal(g.player.sanity, 55);
});
test("cheats refill resources, grant tools, and bypass locks without changing story order", () => {
  const g = fixture();
  g.cheats.grantItems();
  assert.ok(g.inventory.has("cutters"));
  assert.equal(g.inventory.groundingKits, 99);
  g.player.sanity = 10;
  g.cheats.refill();
  assert.equal(g.player.sanity, 100);
  g.cheats.allKeys = true;
  assert.equal(g.inventory.check({ id: "new", requires: "staffKey" }), true);
    g.cheats.infiniteSanity =
    g.cheats.infiniteStamina =
      true;
  g.resources.update(100);
  assert.equal(g.player.sanity, 100);
  assert.equal(g.story.stage, "survive");
});
test("Mara device processing applies only to device voices and leaves child performances clean", () => {
  assert.equal(DIALOGUE.voicemail[0].voiceProfile, "mara-device");
  assert.equal(DIALOGUE.intercom[0].voiceProfile, "mara-device");
  assert.equal(DIALOGUE.lastVoicemail[2].voiceProfile, "mara-device");
  assert.equal(DIALOGUE.argument[0].voiceProfile, "mara-child");
  assert.equal(DIALOGUE.belief[0].voiceProfile, "mara-child");
  assert.equal(DIALOGUE.classroom[0].voiceProfile, "mara-child");
  assert.equal(DIALOGUE.phone[1].voiceProfile, "mara-adult");
});

test("Mara imports a fully clothed authored mesh and independently animated skeleton clones", async () => {
  const { readFile } = await import("node:fs/promises");
  const { loadMaraModel, createMara, animateMara } = await import(
    "../src/world/mara.js"
  );
  const bytes = await readFile(
    new URL("../assets/models/mara-base.glb", import.meta.url),
  );
  await loadMaraModel(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  const a = createMara(),
    b = createMara();
  let count = 0;
  a.traverse((o) => {
    if (o.isSkinnedMesh) count++;
  });
  assert.ok(count > 5);
  assert.equal(a.userData.authored, true);
  assert.notEqual(a.userData.head, b.userData.head);
  assert.ok(a.userData.actions.Walk);
  assert.ok(a.userData.actions.Idle_Neutral);
  assert.equal(a.userData.actions.Gun_Shoot, undefined);
  const original = b.userData.head.scale.x;
  a.userData.head.scale.setScalar(1.12);
  assert.equal(b.userData.head.scale.x, original);
  a.position.x = 0.03;
  animateMara(a, 0.02, 1);
  assert.equal(a.userData.current, a.userData.actions.Walk);
  animateMara(a, 0.03, 1.03);
  assert.equal(a.userData.current, a.userData.actions.Idle_Neutral);
});

test("walking and sprinting never drain sanity in safe lit exploration", () => {
  for (const sprinting of [false, true]) {
    for (const sanity of [100, 62.5]) {
      const g = fixture();
      Object.assign(g.player, {moving: true, sprinting, sanity});
      for (let i=0; i<3600; i++) g.resources.update(1/60);
      assert.equal(g.player.sanity, sanity);
    }
  }
  const g = fixture();
  g.player.sprinting = true;
  g.player.lightsOut = true;
  g.resources.update(1);
  assert.ok(g.player.sanity < 100, "Darkness remains a separate sanity risk");
});
