import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { loadHandModels } from "../src/world/hand-rig.js";
import { createFlashlightViewModel } from "../src/world/viewmodel.js";
import {
  createFaceSurface,
  loadFaceSurfaces,
  FACE_ASSETS,
} from "../src/world/face-surface.js";
import {
  animateScareFace,
  horrorMaterial,
} from "../src/world/horror-detail.js";
import { atmosphereCue, MUSIC } from "../src/data/atmosphere.js";
import { AudioSystem } from "../src/systems/audio.js";
import { HAUNTINGS } from "../src/data/hauntings.js";
const ctx = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
test("all vanishing figures have distant reveal and disappearance ranges with no close face reveal", () => {
  for (const e of HAUNTINGS.filter((e) => e.type === "apparition")) {
    assert.ok(e.revealRange >= 18);
    assert.ok(e.vanishRange >= 2.2);
    assert.ok(e.revealRange - e.vanishRange >= 12);
  }
});
test("two five-digit hands remain in the camera frustum with finite connected grip geometry", async () => {
  const handBytes = {};
  for (const side of ["left", "right"]) {
    const b = await readFile(
      new URL("../assets/models/hand-" + side + "-v14.glb", import.meta.url),
    );
    handBytes[side] = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }
  await loadHandModels(handBytes);
  const camera = new THREE.PerspectiveCamera(68, 16 / 10, 0.06, 90),
    scene = new THREE.Scene();
  const v = createFlashlightViewModel(camera, scene);
  v.update(
    {
      moving: false,
      bob: 0,
      physics: {},
      flashlight: true,
      battery: 100,
      lightFactor: 1,
    },
    1,
  );
  scene.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  assert.equal(v.hands.length, 2);
  for (const hand of v.hands) {
    assert.equal(hand.fingers.length, 4);
    assert.ok(hand.thumb.isBone);
    assert.ok(hand.mesh.isSkinnedMesh);
    const p = hand.palm.getWorldPosition(new THREE.Vector3()).project(camera);
    assert.ok(
      Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z > -1 && p.z < 1,
      hand.side + " palm visible",
    );
    for (const value of hand.mesh.geometry.attributes.position.array)
      assert.ok(Number.isFinite(value));
  }
  assert.equal(v.root.parent, camera);
});
test("photographic face assets are projected onto curved geometry with stable animated jaw uniforms", async () => {
  const load = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => {
    const t = new THREE.Texture();
    t.image = { width: 1254, height: 1254 };
    return t;
  };
  try {
    await loadFaceSurfaces();
    for (const variant of ["teacher", "shadow"]) {
      const face = createFaceSurface(variant, horrorMaterial("skin"));
      assert.equal(face.userData.photographic, true);
      assert.equal(face.userData.texture.colorSpace, THREE.SRGBColorSpace);
      const bounds = new THREE.Box3()
        .setFromObject(face)
        .getSize(new THREE.Vector3());
      assert.ok(bounds.z > 0.15 && bounds.y > 0.3);
      const shader = {
        uniforms: {},
        vertexShader: "#include <common>\n#include <begin_vertex>",
        fragmentShader: "#include <common>\n#include <color_fragment>",
      };
      face.userData.skin.onBeforeCompile(shader);
      assert.equal(shader.uniforms.facePhoto.value, face.userData.texture);
      animateScareFace(face, 1, 1);
      assert.ok(shader.uniforms.faceJaw.value > 0.5);
      animateScareFace(face, 0, 2);
      assert.equal(shader.uniforms.faceJaw.value, 0);
      assert.ok(shader.vertexShader.includes("transformed.y-=faceJaw"));
    }
  } finally {
    THREE.TextureLoader.prototype.loadAsync = load;
  }
  for (const path of Object.values(FACE_ASSETS)) {
    const b = await readFile(new URL("../" + path, import.meta.url));
    assert.equal(b.subarray(1, 4).toString(), "PNG");
    assert.ok(b.readUInt32BE(16) > 1000);
  }
});
test("pressure music follows the creepy scenes, increases for pursuit and releases for Mara", () => {
  const g = {
    started: true,
    config: { enemy: true },
    world: { env: { state: "ruined" } },
    story: { stage: "fault" },
    teacher: { active: false },
    player: { position: { x: 17.5, z: -44 } },
  };
  assert.equal(atmosphereCue(g).id, "pressure");
  g.ambushes = { active: { phase: "struggle" } };
  assert.equal(atmosphereCue(g).id, "tension");
  g.ambushes.active = null;
  g.teacher.active = true;
  g.teacher.state = "Search";
  const low = atmosphereCue(g).gain;
  g.teacher.state = "Chase";
  assert.ok(atmosphereCue(g).gain > low);
  g.teacher.active = false;
  g.story.stage = "waiting";
  g.player.position = { x: 0, z: -60 };
  assert.equal(atmosphereCue(g).id, "gym");
  g.story.stage = "reunion";
  assert.equal(atmosphereCue(g), null);
});
test("real music handles fade without clicks and checkpoint cleanup also terminates fading sources", () => {
  const events = [],
    sources = [];
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {
      events.push("disconnect");
    },
  });
  const param = () => ({
    value: 0,
    setValueAtTime(v, t) {
      this.value = v;
      events.push(["set", v, t]);
    },
    linearRampToValueAtTime(v, t) {
      events.push(["ramp", v, t]);
    },
    cancelScheduledValues() {},
    setTargetAtTime() {},
  });
  const a = new AudioSystem({});
  a.ctx = {
    currentTime: 4,
    createGain: () => ({ ...node(), gain: param() }),
    createBufferSource: () => {
      const s = {
        ...node(),
        start() {},
        stop(t) {
          events.push(["stop", t]);
        },
      };
      sources.push(s);
      return s;
    },
  };
  a.buses = { music: node() };
  a.sfxBuffers.set(MUSIC.tension, {});
  const h = a.playMusic("tension", null, 0.4);
  assert.ok(
    events.some((e) => e[0] === "ramp" && e[1] === 0.4 && e[2] === 5.2),
  );
  h.stop();
  assert.ok(events.some((e) => e[0] === "ramp" && e[1] === 0));
  assert.equal(h.playing, false);
  assert.equal(
    a.musicLoops.size,
    1,
    "The fading source remains tracked until it ends",
  );
  a.stopEffects();
  assert.equal(a.musicLoops.size, 0);
  assert.ok(events.includes("disconnect"));
});
