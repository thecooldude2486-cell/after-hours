import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { EnvironmentSoundSystem } from "../src/systems/environment-sounds.js";
import { HauntingSystem } from "../src/systems/hauntings.js";
import { loadMaraModel } from "../src/world/mara.js";
import { createSchool } from "../src/world/school.js";
import { DEFAULTS } from "../src/data/config.js";
import {
  scareFeedback,
  clearScareFeedback,
} from "../src/systems/scare-effects.js";
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
const flash = { style: {} };
globalThis.document = {
  createElement: () => ({ getContext: () => ctx }),
  querySelector: () => flash,
};
function game() {
  return {
    started: true,
    config: { ...DEFAULTS, enemy: false, cameraShake: 1, scareFlash: true },
    player: { position: new THREE.Vector3(0, 1.65, -6) },
    camera: new THREE.PerspectiveCamera(68),
    world: {
      env: { state: "ruined" },
      scene: new THREE.Scene(),
      obstacles: [],
    },
    story: { stage: "locker", triggers: { busy: false }, save() {} },
    dialogue: { current: null },
    interactions: { reader: false },
    cinematics: { active: null },
    ambushes: { active: null },
    teacher: { active: false },
    audio: {
      calls: [],
      cue(...args) {
        this.calls.push(args);
      },
    },
    cheats: {},
  };
}

test("empty-school foley is sparse, positional, non-repeating and pauses for dialogue, normal school and pursuit", () => {
  const g = game(),
    s = new EnvironmentSoundSystem(g, () => 0.5);
  s.update(6);
  assert.equal(g.audio.calls.length, 0);
  s.update(1.1);
  assert.equal(g.audio.calls.length, 1);
  assert.ok(["emptyLocker", "emptySteps"].includes(g.audio.calls[0][0]));
  assert.ok(Number.isFinite(g.audio.calls[0][1].x));
  const first = s.last;
  s.update(21);
  assert.equal(g.audio.calls.length, 2);
  assert.notEqual(s.last, first);
  for (const setup of [
    () => (g.paused = true),
    () => {
      g.paused = false;
      g.dialogue.current = {};
    },
    () => {
      g.dialogue.current = null;
      g.world.env.state = "normal";
    },
    () => {
      g.world.env.state = "ruined";
      g.teacher.active = g.config.enemy = true;
    },
  ]) {
    setup();
    const remaining = s.remaining;
    s.update(100);
    assert.equal(s.remaining, remaining);
    assert.equal(g.audio.calls.length, 2);
  }
});

test("the first partial apparition is actually seen on the ordinary central school approach", async () => {
  const b = await readFile(
    new URL("../assets/models/mara-base.glb", import.meta.url),
  );
  await loadMaraModel(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  );
  const g = game();
  g.world = createSchool({}, DEFAULTS);
  const h = new HauntingSystem(g);
  let seen = 0;
  for (let z = 5; z > -17.5; z -= 0.12) {
    g.player.position.set(0, 1.65, z);
    g.camera.position.copy(g.player.position);
    g.camera.lookAt(0, 1.65, z - 10);
    h.update(0.05, seen * 0.05);
    if (
      h.active?.event.id === "entrance-vanishing-figure" &&
      h.distant.mesh.visible
    )
      seen++;
  }
  assert.ok(
    seen >= 20,
    "Visible for at least one second through the real school geometry",
  );
  assert.ok(
    h.fired.has("entrance-vanishing-figure"),
    "Approach consumes the witnessed peek",
  );
  const locker = g.world.ambientLockers.find(
    (l) => l.x < 0 && Math.abs(l.z + 11.7) < 0.1,
  );
  g.world.disturbLocker({ x: -2.24, z: -11.7 });
  g.world.update(0.8, 5, g.player);
  assert.ok(Math.abs(locker.hinge.rotation.y) > 0.1);
  assert.ok(Math.abs(locker.hinge.rotation.y) <= 0.32, "Original restrained locker opening");
  assert.equal(locker.collider.enabled, true);
  assert.ok(locker.collider.maxX > locker.collider.minX);
  g.world.env.set("normal", "school", true);
  g.world.update(0.1, 6, g.player);
  assert.equal(locker.hinge.rotation.y, 0);
  assert.equal(locker.collider.enabled, false);
  g.world.disturbLocker({ x: -2.24, z: -11.7 });
  g.world.resetAmbientLockers();
  assert.equal(locker.playing, false);
});

test("capture lighting produces a strong white pulse while zero shake and disabled flash remain effective", () => {
  const g = game(),
    light = new THREE.PointLight();
  g.camera.position.set(0, 1.65, 0);
  scareFeedback(g, light, 0.065, { fovBase: 68 });
  assert.ok(light.intensity > 70);
  assert.ok(Number(flash.style.opacity) > 0.8);
  clearScareFeedback(g, light);
  g.config.scareFlash = false;
  g.config.cameraShake = 0;
  const p = g.camera.position.clone(),
    q = g.camera.quaternion.clone();
  scareFeedback(g, light, 0.325, { fovBase: 68 });
  assert.ok(g.camera.position.equals(p));
  assert.ok(g.camera.quaternion.equals(q));
  assert.equal(flash.style.opacity, "0");
});
