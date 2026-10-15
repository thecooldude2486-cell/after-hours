import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { createRoomMonster } from "../src/world/room-monster.js";
import { HauntingSystem } from "../src/systems/hauntings.js";
import { HAUNTINGS, HAUNTING_REVISION } from "../src/data/hauntings.js";
import { PRESETS, applyPreset } from "../src/data/presets.js";
import { BLOOD_ART, SCHOOL_ART } from "../src/world/school-art.js";
import {
  HORROR_SKIN,
  loadHorrorMaterials,
} from "../src/world/horror-detail.js";
import { paperGeometry } from "../src/world/aged-paper.js";
import { loadMaraModel } from "../src/world/mara.js";
import { createSchool } from "../src/world/school.js";
import { DEFAULTS } from "../src/data/config.js";
import { blocked } from "../src/systems/navigation.js";
const ui = { style: {} },
  ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  createElement: () => ({ getContext: () => ctx }),
  querySelector: () => ui,
};
function game() {
  return {
    started: true,
    config: {
      ...DEFAULTS,
      enemy: false,
      cameraFov: 68,
      scareFlash: false,
      cameraShake: 0.7,
    },
    camera: new THREE.PerspectiveCamera(68),
    world: {
      scene: new THREE.Scene(),
      env: { state: "ruined", roomStates: new Map() },
      obstacles: [],
      scarePulse: 0,
    },
    player: {
      position: new THREE.Vector3(0, 1.65, -22),
      keys: new Set(["KeyW"]),
    },
    teacher: { active: false },
    interactions: { reader: false },
    dialogue: { current: null },
    cinematics: { active: null },
    ambushes: { active: null },
    story: {
      stage: "cassette",
      companion: false,
      triggers: { busy: false },
      save() {},
    },
    audio: {
      calls: [],
      cue(...args) {
        this.calls.push(args);
      },
    },
    cheats: {},
  };
}
test("apparitions are visible at range, disappear on approach, preserve control and stay cleared in saves", () => {
  const g = game();
  g.camera.position.copy(g.player.position);
  g.camera.lookAt(2.76, 1.8, -35.04);
  const h = new HauntingSystem(g);
  h.update(0.02, 1);
  assert.equal(h.active.event.id, "corridor-vanishing-figure");
  assert.equal(h.actor.visible, false, "No sharp body fallback");
  assert.equal(h.distant.mesh.visible, true);
  assert.equal(g.audio.calls[0][0], "apparitionArrival", "Distinct arrival cue");
  assert.deepEqual([...g.player.keys], ["KeyW"]);
  g.paused = true;
  const elapsed = h.active.elapsed;
  h.update(10, 2);
  assert.equal(h.active.elapsed, elapsed);
  g.paused = false;
  h.update(1.15, 2.5);
  g.player.position.z = -31.5;
  h.update(0.2, 3);
  assert.equal(h.actor.visible, false);
  assert.equal(h.active, null);
  assert.equal(g.audio.calls[1][0], "apparitionVanish");
  const save = h.snapshot();
  h.reset(save);
  assert.ok(h.fired.has("corridor-vanishing-figure"));
  assert.equal(h.light.intensity, 0);
});
test("an interrupted glimpse is rearmed instead of silently consumed by the checkpoint", () => {
  const g = game();
  g.camera.position.copy(g.player.position);
  g.camera.lookAt(2.76, 1.8, -35.04);
  const h = new HauntingSystem(g);
  h.update(0.02, 1);
  g.dialogue.current = {};
  h.update(0.02, 2);
  assert.equal(h.active, null);
  assert.equal(h.fired.size, 0);
  g.dialogue.current = null;
  h.update(0.02, 3);
  assert.equal(h.active.event.id, "corridor-vanishing-figure");
  h.reset({
    revision: HAUNTING_REVISION - 1,
    fired: HAUNTINGS.map((e) => e.id),
  });
  assert.equal(h.fired.size, 0, "Old saves rearm the improved encounters");
});
test("cancelling a distant apparition cannot erase a room monster's camera and flash effects", () => {
  const g = game(),
    h = new HauntingSystem(g);
  h.start(HAUNTINGS.find((e) => e.id === "corridor-vanishing-figure"));
  g.camera.fov = 76;
  g.world.scarePulse = 0.73;
  ui.style.opacity = ".4";
  g.ambushes.active = { phase: "struggle" };
  h.update(0.02, 1);
  assert.equal(h.active, null);
  assert.equal(h.actor.visible, false);
  assert.equal(g.camera.fov, 76);
  assert.equal(g.world.scarePulse, 0.73);
  assert.equal(ui.style.opacity, ".4");
});
test("the early figure is visible in every preset and retreats at full scale only after it was seen", () => {
  for (const preset of Object.keys(PRESETS)) {
    const g = game();
    applyPreset(g.config, preset);
    g.config.scareFlash = false;
    g.story.stage = "locker";
    g.player.position.set(0, 1.65, -4);
    g.camera.position.copy(g.player.position);
    g.camera.lookAt(-2.79, 1.8, -18.06);
    const h = new HauntingSystem(g);
    h.update(0.02, 1);
    assert.equal(h.active.event.id, "entrance-vanishing-figure", preset);
    assert.deepEqual(g.audio.calls.map(c => c[0]), ["apparitionArrival"]);
    const scale = h.actor.scale.x;
    h.update(1.2, 2);
    g.player.position.set(0, 1.65, -14.4);
    g.camera.position.copy(g.player.position);
    g.camera.lookAt(-2.79, 1.8, -18.06);
    h.update(0.1, 3);
    assert.equal(h.actor.scale.x, scale, "Retreat does not shrink the body");
    assert.equal(g.audio.calls[1][0], "apparitionVanish");
    h.update(0.1, 3.1);
    assert.equal(h.actor.visible, false);
    assert.ok(h.fired.has("entrance-vanishing-figure"));
    assert.equal(
      g.world.scarePulse,
      0,
      "Flash setting applies to doorway retreats",
    );
    assert.equal(g.camera.fov, g.config.cameraFov ?? 68);
  }
});
test("an open animated door leaf can still occlude the figure despite its disabled movement collider", () => {
  const g = game();
  g.camera.position.copy(g.player.position);
  g.camera.lookAt(2.76, 1.8, -35.04);
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(8, 3, 0.15),
    new THREE.MeshBasicMaterial(),
  );
  leaf.position.set(0, 1.5, -25);
  g.world.scene.add(leaf);
  g.world.doors = [{ id: "open-leaf", open: true, angle: -1.5, leaf }];
  const h = new HauntingSystem(g);
  h.update(0.1, 1);
  assert.equal(h.active, null);
  leaf.position.x = 8;
  h.update(0.1, 2);
  assert.equal(h.active.event.id, "corridor-vanishing-figure");
});
test("the classroom doorway peek waits for the real door to open, then can be seen from across the hall", async () => {
  const b = await readFile(
    new URL("../assets/models/mara-base.glb", import.meta.url),
  );
  await loadMaraModel(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
  const g = game();
  g.world = createSchool({}, DEFAULTS);
  g.story.stage = "drawing";
  g.player.position.set(2.8, 1.65, -17.15);
  g.camera.position.copy(g.player.position);
  g.camera.lookAt(-2.91, 1.8, -17.91);
  const h = new HauntingSystem(g);
  h.fired.add("entrance-vanishing-figure");
  h.fired.add("corridor-vanishing-figure");
  h.update(0.1, 1);
  assert.equal(h.active, null);
  const door = g.world.doors.find((d) => d.id === "classroomGate");
  g.world.openDoor(door);
  g.world.update(1, 1, g.player);
  h.update(0.1, 2);
  assert.equal(h.active?.event.id, "classroom-door-peek");
  assert.equal(h.visibleAt(h.active.event), true);
  assert.equal(h.distant.mesh.rotation.y, Math.PI / 2);
  assert.equal(h.actor.visible, false);
});
test("environment scares never fire through walls or in friendly, emotional, pursuit, reader or room-grab states", () => {
  for (const setup of [
    (g) => (g.world.env.state = "normal"),
    (g) => (g.story.stage = "embrace"),
    (g) => (g.story.companion = true),
    (g) => (g.teacher.active = g.config.enemy = true),
    (g) => (g.interactions.reader = true),
    (g) => (g.ambushes.active = { phase: "struggle" }),
    (g) =>
      (g.world.obstacles = [
        { minX: -100, maxX: 100, minZ: -26, maxZ: -25, minY: 0, maxY: 3 },
      ]),
  ]) {
    const g = game();
    g.camera.position.copy(g.player.position);
    g.camera.lookAt(2.76, 1.8, -35.04);
    setup(g);
    const h = new HauntingSystem(g);
    h.update(0.1, 1);
    assert.equal(h.active, null);
    assert.equal(h.actor.visible, false);
  }
});
test("all added jumpscare variants restore camera, lighting and props, obey flash setting and do not drain resources", () => {
  for (const event of HAUNTINGS.filter((e) => e.type !== "apparition")) {
    const g = game();
    g.story.stage = event.stages[0];
    g.player.position.set(event.at[0], 1.65, event.at[1]);
    g.camera.position.copy(g.player.position);
    g.player.sanity = 100;
    const h = new HauntingSystem(g);
    h.start(event);
    h.update(0.05, 1);
    assert.equal(g.audio.calls[0][0], event.cue);
    assert.equal(g.world.scarePulse, 0);
    assert.equal(Number(ui.style.opacity), 0);
    assert.equal(g.player.sanity, 100);
    assert.ok(g.player.keys.has("KeyW"));
    h.update(event.duration, 2);
    assert.equal(h.active, null);
    assert.equal(h.actor.visible, false);
    assert.equal(h.screen.visible, false);
    assert.equal(h.light.intensity, 0);
    assert.equal(g.camera.fov, 68);
  }
});
test("entering dialogue cancels an active scare immediately and resets its effects", () => {
  const g = game(),
    h = new HauntingSystem(g);
  h.start(HAUNTINGS.find((e) => e.type === "rush"));
  h.update(0.04, 1);
  g.dialogue.current = {};
  h.update(0.1, 2);
  assert.equal(h.active, null);
  assert.equal(h.actor.visible, false);
  assert.equal(g.camera.fov, 68);
  assert.equal(g.world.scarePulse, 0);
});
test("new art assets are valid, distinct files; blood phrases are real RGBA decals and paper has physical relief", async () => {
  const paths = [
    SCHOOL_ART.classroom,
    SCHOOL_ART.stairs,
    SCHOOL_ART.window,
    SCHOOL_ART.gym,
    HORROR_SKIN,
    ...Object.values(BLOOD_ART),
  ];
  const hashes = new Set();
  for (const path of paths) {
    const b = await readFile(new URL("../" + path, import.meta.url));
    assert.equal(b.subarray(1, 4).toString(), "PNG");
    assert.ok(b.readUInt32BE(16) > 1000);
    if (Object.values(BLOOD_ART).includes(path)) assert.equal(b[25], 6);
    hashes.add(b.toString("base64"));
  }
  assert.equal(hashes.size, paths.length);
  const g = paperGeometry(),
    z = g.attributes.position;
  let max = 0,
    min = Infinity;
  for (let i = 0; i < z.count; i++) {
    min = Math.min(min, z.getZ(i));
    max = Math.max(max, z.getZ(i));
  }
  assert.ok(max - min > 0.01);
  assert.ok(min >= 0);
});
test("fixed apparitions fit school space; ruined paper and stains clear and restore with environment states", async () => {
  const b = await readFile(
    new URL("../assets/models/mara-base.glb", import.meta.url),
  );
  await loadMaraModel(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
  const w = createSchool({}, DEFAULTS);
  for (const e of HAUNTINGS.filter((e) => e.type === "apparition"))
    assert.equal(
      blocked(
        e.at[0],
        e.at[1],
        w.obstacles.filter((o) => !w.doors.some((d) => d.obstacle === o) && (o.minY??0)<1.8 && (o.maxY??4)>1.8),
        0.02,
      ),
      false,
      e.id + " must not intersect furniture",
    );
  assert.equal(
    new Set(
      w.interactables
        .filter((t) => t.type === "gallery")
        .map((t) => t.horrorImage),
    ).size,
    6,
  );
  const old = w.art.photos[0].geometry;
  assert.ok(w.art.photos[0].material.alphaMap);
  assert.ok(w.decay.length >= 20);
  w.env.set("normal", "school", true);
  assert.notEqual(w.art.photos[0].geometry, old);
  assert.equal(w.art.photos[0].material.alphaMap, null);
  assert.ok(w.decay.every((m) => !m.visible));
  w.env.set("ruined", "school", true);
  assert.equal(w.art.photos[0].geometry, old);
  assert.ok(w.decay.every((m) => m.visible));
});

test("preloaded skin uses the generated albedo and a separate linear relief texture", async () => {
  const original = THREE.TextureLoader.prototype.loadAsync,
    color = new THREE.Texture();
  THREE.TextureLoader.prototype.loadAsync = async (path) => {
    if (path === HORROR_SKIN) return color;
    assert.ok(/(face-v(10|12|13)|capture-v(12|13))\.png$/.test(path));
    return new THREE.Texture();
  };
  try {
    await loadHorrorMaterials();
    const material = createRoomMonster().userData.face.userData.skin;
    assert.equal(material.map, color);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.notEqual(material.bumpMap, color);
    assert.equal(material.bumpMap.colorSpace, THREE.NoColorSpace);
    assert.ok(material.isMeshPhysicalMaterial);
    assert.equal(material.clearcoat, 0.12);
  } finally {
    THREE.TextureLoader.prototype.loadAsync = original;
  }
});

test("every apparition retreats at its safety distance even before the observation timer completes, and cannot spawn inside it", () => {
  for (const event of HAUNTINGS.filter(e => e.type === "apparition")) {
    const g = game(), h = new HauntingSystem(g);
    g.story.stage = event.stages[0];
    h.fired = new Set(HAUNTINGS.filter(e => e !== event).map(e => e.id));
    g.world.doors = [{ id: event.door, open: true, angle: -1.5 }];
    const normal = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), event.peekYaw || 0);
    g.player.position.set(event.at[0],1.65,event.at[1]).addScaledVector(normal,event.vanishRange-.2);
    g.camera.position.copy(g.player.position);
    g.camera.lookAt(h.distant.sightPoint(event));
    h.start(event);
    h.update(.02,0);
    assert.ok(h.active.fading > 0, event.id + " immediately retreats when too close");
    assert.ok(h.active.observed < 1.1);
    h.update(.2,.2);
    assert.equal(h.active,null);
    assert.equal(h.distant.mesh.visible,false);
    h.cooldown=0;
    h.update(1,1);
    assert.equal(h.active,null,event.id + " cannot reappear within the safety distance");
    assert.equal(g.audio.calls.filter(c=>c[0]==="apparitionArrival").length,1);
  }
});
