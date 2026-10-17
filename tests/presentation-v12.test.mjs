import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { DistantFigure } from "../src/world/distant-figure.js";
import { loadFaceSurfaces } from "../src/world/face-surface.js";
import { loadMaraModel } from "../src/world/mara.js";
import { createTeacher, animateTeacher } from "../src/world/teacher-model.js";
import { faceTarget } from "../src/world/scare-motion.js";
import { VOICES } from "../src/data/voices.js";
import { CaptureSystem } from "../src/systems/capture.js";
import { CinematicSystem } from "../src/systems/cinematics.js";
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  createElement: () => ({ getContext: () => ctx }),
  querySelector: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  exitPointerLock() {},
};

test("all Mara speech uses one native child voice with no pitch or time-stretch substitutions", () => {
  let count = 0;
  for (const take of Object.values(VOICES)) {
    if (!take.character.startsWith("mara") || take.text.startsWith("["))
      continue;
    assert.equal(take.voice, "en-US-AnaNeural");
    assert.equal(take.engine, "microsoft-neural");
    assert.ok([12,31].includes(take.revision));
    assert.equal(take.pitch, undefined);
    assert.equal(take.pitch_rate, undefined);
    count++;
  }
  assert.equal(count, 33);
  assert.equal(VOICES["lastVoicemail:0"].engine, "recorded-cc0");
});

test("a doorway peek is volumetric, clipped and untextured; it never faces the camera", () => {
  const scene = new THREE.Scene(),
    actor = new THREE.Group(),
    peek = new DistantFigure(scene);
  peek.setPeek({ at: [-2.48, -18.06], mirror: true, peekYaw: 0 }, actor);
  assert.equal(actor.visible, false);
  assert.ok(peek.mesh.isGroup);
  assert.equal(peek.material.map, null);
  let count = 0;
  peek.mesh.traverse((o) => {
    if (o.isMesh) {
      count++;
      assert.ok(!o.geometry.type.includes("Plane"));
      assert.equal(o.material.clippingPlanes.length, 3);
    }
  });
  assert.ok(count > 8);
  assert.ok(peek.blurRadius > 0 && peek.blurRadius <= 4);
  const q = peek.mesh.quaternion.clone(),
    camera = new THREE.PerspectiveCamera();
  camera.rotation.y = 1.2;
  peek.update(camera);
  assert.ok(peek.mesh.quaternion.equals(q));
  const p = peek.mesh.position.clone();
  peek.retreat(1);
  assert.ok(peek.mesh.position.x < p.x);
  peek.hide();
  assert.equal(peek.mesh.visible, false);
});

test("the Teacher has an adult-size head, independent smooth clothing and an authored attack expression", async () => {
  const load = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async (path) => {
    const t = new THREE.Texture();
    t.image = { width: 1254, height: 1254, path };
    return t;
  };
  try {
    await loadFaceSurfaces();
    const b = await readFile(
      new URL("../assets/models/mara-base.glb", import.meta.url),
    );
    await loadMaraModel(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    );
    const teacher = createTeacher();
    teacher.visible = true;
    animateTeacher(teacher, 0.016, 1);
    teacher.updateMatrixWorld(true);
    assert.equal(teacher.userData.realisticBody, true);
    teacher.userData.model.traverse((o) => {
      if (o.isSkinnedMesh) assert.equal(o.visible, false);
    });
    const skull = teacher.userData.face.userData.skull,
      size = new THREE.Box3()
        .setFromObject(skull, true)
        .getSize(new THREE.Vector3());
    assert.ok(size.x < 0.24 && size.y < 0.29, "Adult head proportions");
    assert.notEqual(
      teacher.userData.face.userData.attackTexture,
      teacher.userData.face.userData.texture,
    );
    assert.ok(
      faceTarget(teacher, 1.7).z < teacher.position.z - 0.18,
      "Capture aims at front of face",
    );
    teacher.userData.scareAmount = 1;
    animateTeacher(teacher, 0.016, 1.2);
    assert.ok(teacher.userData.face.userData.jawOpen.value > 0.5);
    teacher.traverse((o) =>
      assert.ok(o.matrixWorld.elements.every(Number.isFinite)),
    );
  } finally {
    THREE.TextureLoader.prototype.loadAsync = load;
  }
});

test("Teacher capture frames the front of the face at standing and crouching heights without near-plane clipping", async () => {
  for (const height of [1.65, 1.02]) {
    const teacher = createTeacher(),
      camera = new THREE.PerspectiveCamera(68, 1, 0.06, 90);
    camera.position.set(0, height, 0);
    const player = {
      position: camera.position.clone(),
      yaw: 0,
      keys: new Set(),
      leaveHide() {},
      syncCamera() {},
    };
    const game = {
      camera,
      world: { scene: new THREE.Scene(), teacher },
      player,
      config: {
        enemy: true,
        cameraFov: 68,
        cameraShake: 0.7,
        scareFlash: true,
      },
      teacher: { active: true },
      attempts: 0,
      story: { stage: "vale", epoch: 1, triggers: { reset() {} } },
      dialogue: { reset() {} },
      audio: { cue() {} },
      cheats: {},
    };
    game.cinematics = new CinematicSystem(game);
    const completion = new CaptureSystem(game).catchPlayer();
    let closest = Infinity;
    for (let i = 0; i < 98; i++) {
      game.cinematics.update(1 / 60);
      const point = faceTarget(teacher, 1.73),
        projected = point.clone().project(camera);
      closest = Math.min(closest, point.distanceTo(camera.position));
      assert.ok(
        Math.abs(projected.x) < 0.5 && Math.abs(projected.y) < 0.5,
        "Face stays centered through the lunge",
      );
      assert.ok(
        projected.z > -1 && projected.z < 1,
        "Face stays in front of camera",
      );
    }
    assert.ok(
      closest > 0.18 && closest < 0.6,
      "Close attack remains beyond the near plane",
    );
    game.cinematics.update(0.1);
    await completion;
    assert.equal(teacher.visible, false);
    assert.equal(camera.fov, 68);
  }
});
