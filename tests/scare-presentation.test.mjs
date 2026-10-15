import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import {
  createRoomMonster,
  animateRoomMonster,
} from "../src/world/room-monster.js";
import {
  scareEnvelope,
  scareFeedback,
  clearScareFeedback,
} from "../src/systems/scare-effects.js";
import { SFX } from "../src/data/sfx.js";
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
const flash = { style: {} };
globalThis.document = {
  createElement: () => ({ getContext: () => ctx }),
  querySelector: () => flash,
};
test("room monster has its own articulated geometry, detailed moving jaw, textured skin and individual fingers", () => {
  const monster = createRoomMonster();
  monster.visible = true;
  assert.equal(monster.userData.procedural, true);
  assert.equal(
    monster.userData.actions,
    undefined,
    "Does not reuse the Mara rig",
  );
  assert.equal(monster.userData.face.userData.teeth.length, 18);
  assert.equal(monster.userData.fingers.length, 8);
  assert.ok(monster.userData.face.userData.skin.map?.isCanvasTexture);
  assert.ok(monster.userData.face.userData.skin.bumpMap);
  let triangles = 0;
  monster.traverse((o) => {
    if (o.isMesh) {
      triangles +=
        (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
      assert.equal(o.castShadow, true);
    }
  });
  assert.ok(triangles > 25000);
  monster.userData.scareAmount = 0;
  animateRoomMonster(monster, 1 / 60, 0.1);
  const resting = monster.userData.face.userData.jaw.quaternion.clone();
  monster.userData.scareAmount = 1;
  animateRoomMonster(monster, 1 / 60, 0.2);
  monster.updateMatrixWorld(true);
  assert.ok(
    resting.angleTo(monster.userData.face.userData.jaw.quaternion) > 0.2,
  );
  const shoulder = monster.userData.bones.UpperArmL.getWorldPosition(
    new THREE.Vector3(),
  );
  const hand = monster.userData.bones.WristL.getWorldPosition(
    new THREE.Vector3(),
  );
  assert.ok(hand.z < shoulder.z - 0.3, "Reaches forward toward the player");
  monster.traverse((o) => {
    assert.ok(o.matrixWorld.elements.every(Number.isFinite));
  });
});
test("scares flash scene lighting twice, kick the camera, respect settings and fully clean up", () => {
  assert.ok(scareEnvelope(0.065).flash > 0.99);
  assert.equal(scareEnvelope(0.2).flash, 0);
  assert.ok(scareEnvelope(0.325).flash > 0.7);
  assert.equal(scareEnvelope(0.4).flash, 0);
  const game = {
    camera: new THREE.PerspectiveCamera(),
    config: { cameraShake: 1, scareFlash: true, cameraFov: 68 },
    world: {},
  };
  const light = new THREE.PointLight();
  game.camera.position.set(0, 1.65, 0);
  const pose = game.camera.quaternion.clone();
  scareFeedback(game, light, 0.065, { sustained: true, fovBase: 68 });
  assert.ok(game.camera.quaternion.angleTo(pose) > 0.025);
  assert.ok(light.intensity > 20);
  assert.ok(game.camera.fov < 60);
  assert.ok(game.world.scarePulse > 0.99);
  assert.ok(Number(flash.style.opacity) > 0.4);
  clearScareFeedback(game, light);
  assert.equal(game.world.scarePulse, 0);
  assert.equal(light.intensity, 0);
  assert.equal(flash.style.opacity, "0");
  assert.equal(game.camera.fov, 68);
  game.config.cameraShake = 0;
  game.config.scareFlash = false;
  game.camera.position.set(0, 1.65, 0);
  game.camera.quaternion.identity();
  const mutedPose = game.camera.quaternion.clone();
  scareFeedback(game, light, 0.065, { sustained: true, fovBase: 68 });
  assert.equal(game.camera.quaternion.angleTo(mutedPose), 0);
  assert.deepEqual(game.camera.position.toArray(), [0, 1.65, 0]);
  assert.equal(game.world.scarePulse, 0);
  assert.equal(flash.style.opacity, "0");
  assert.equal(
    light.intensity,
    3.8,
    "Steady face illumination remains when flashing is disabled",
  );
});
test("new scare files have an immediate dense stereo attack and dedicated louder scare-bus routing", async () => {
  for (const cue of ["scare", "shadowScare"]) {
    assert.equal(SFX[cue].bus, "scares");
    assert.ok(SFX[cue].volume > 1);
    const data = await readFile(
      new URL("../" + SFX[cue].files[0], import.meta.url),
    );
    assert.equal(data.readUInt16LE(22), 2);
    const at = data.indexOf(Buffer.from("data"), 36) + 8;
    let square = 0,
      peak = 0;
    const samples = data.readUInt32LE(24) * 2 * 0.05;
    for (let i = 0; i < samples; i++) {
      const v = data.readInt16LE(at + i * 2) / 32768;
      square += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(
      Math.sqrt(square / samples) > 0.12,
      "Attack is present in the first 50ms",
    );
    assert.ok(peak > 0.3);
  }
});
