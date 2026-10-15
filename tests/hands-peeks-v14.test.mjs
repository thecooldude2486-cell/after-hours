import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "../vendor/three.module.js";
import { loadHandModels, createRiggedHand } from "../src/world/hand-rig.js";
import { createFlashlightViewModel } from "../src/world/viewmodel.js";
import {
  DistantFigure,
  APPARITION_LAYER,
} from "../src/world/distant-figure.js";
import { SchoolRenderer } from "../src/systems/rendering.js";
import { HauntingSystem } from "../src/systems/hauntings.js";

const bytes = {};
for (const side of ["left", "right"]) {
  const b = await readFile(
    new URL("../assets/models/hand-" + side + "-v14.glb", import.meta.url),
  );
  bytes[side] = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
await loadHandModels(bytes);

test("left and right human skin rigs keep independent skeletons, bone lengths and handedness", () => {
  const material = new T.MeshStandardMaterial(),
    right = createRiggedHand("right", material),
    left = createRiggedHand("left", material),
    other = createRiggedHand("right", material);
  for (const h of [right, left, other]) {
    assert.equal(h.joints.length, 25);
    assert.equal(new Set(h.joints).size, 25);
    assert.equal(h.mesh.geometry.attributes.position.count, 1360);
    assert.ok(h.mesh.isSkinnedMesh);
    h.root.updateMatrixWorld(true);
    h.root.traverse((o) =>
      assert.ok(o.scale.x > 0 && o.scale.y > 0 && o.scale.z > 0),
    );
    for (const finger of [
      "index-finger",
      "middle-finger",
      "ring-finger",
      "pinky-finger",
    ]) {
      const proximal = h.model.getObjectByName(finger + "-phalanx-proximal"),
        middle = h.model.getObjectByName(finger + "-phalanx-intermediate"),
        distal = h.model.getObjectByName(finger + "-phalanx-distal");
      assert.equal(middle.parent, proximal);
      assert.equal(distal.parent, middle);
      assert.ok(
        middle.position.length() > 0.025 && middle.position.length() < 0.06,
      );
      assert.ok(
        distal.position.length() > 0.01 && distal.position.length() < 0.035,
      );
    }
    for (let i = 0; i < h.mesh.geometry.attributes.position.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(
        h.mesh.geometry.attributes.position,
        i,
      );
      h.mesh.applyBoneTransform(i, v);
      assert.ok(v.toArray().every(Number.isFinite));
      const weights = new T.Vector4().fromBufferAttribute(
        h.mesh.geometry.attributes.skinWeight,
        i,
      );
      assert.ok(
        Math.abs(weights.x + weights.y + weights.z + weights.w - 1) < 1e-5,
      );
    }
  }
  assert.notEqual(right.mesh.skeleton, other.mesh.skeleton);
  assert.notEqual(right.thumb, other.thumb);
  const before = other.thumb.quaternion.clone();
  right.thumb.rotateX(0.2);
  assert.ok(other.thumb.quaternion.equals(before));
  assert.ok(
    right.model
      .getObjectByName("thumb-metacarpal")
      .getWorldPosition(new T.Vector3()).x < 0,
  );
  assert.ok(
    left.model
      .getObjectByName("thumb-metacarpal")
      .getWorldPosition(new T.Vector3()).x > 0,
  );
});

test("the flashlight stays inside the cylindrical grip and bob never drifts the articulated hand", () => {
  const camera = new T.PerspectiveCamera(68, 1.6, 0.06, 90),
    view = createFlashlightViewModel(camera, new T.Scene());
  const right = view.hands[0],
    player = {
      moving: true,
      bob: 0,
      physics: { velocity: 0, landing: 0 },
      flashlight: true,
      battery: 100,
      lightFactor: 1,
    };
  const pose = right.joints.map((j) => j.quaternion.clone());
  for (let i = 0; i < 300; i++) {
    player.bob = i * 0.04;
    view.update(player, i / 60);
  }
  for (let i = 0; i < pose.length; i++)
    assert.ok(right.joints[i].quaternion.equals(pose[i]));
  right.root.updateWorldMatrix(true, true);
  // Finger centers must curl around the barrel, rather than pointing through its axis or staying straight.
  for (const name of [
    "index-finger",
    "middle-finger",
    "ring-finger",
    "pinky-finger",
  ]) {
    const ip = right.model.getObjectByName(name + "-phalanx-intermediate");
    const p = view.torch.worldToLocal(ip.getWorldPosition(new T.Vector3()));
    const distance = Math.hypot(p.y, p.z);
    assert.ok(distance > 0.02 && distance < 0.032, name + " contact clearance about the tilted barrel");
  }
  const tip = right.root.worldToLocal(
    right.model.getObjectByName("thumb-tip").getWorldPosition(new T.Vector3()),
  );
  assert.ok(
    tip.y > 0.085 && tip.z > view.torch.position.z,
    "Opposing thumb reaches the near side",
  );
  assert.ok(view.muzzle().toArray().every(Number.isFinite));
  player.hidden = true;
  view.update(player, 6);
  assert.equal(view.root.visible, false);
});

function rendererStub({ float = true, failMask = false } = {}) {
  const r = {
    calls: [],
    target: null,
    color: new T.Color(0x263746),
    alpha: 0.7,
    localClippingEnabled: false,
    extensions: { has: () => float },
    capabilities: { maxSamples: 0 },
    getDrawingBufferSize: (v) => v.set(960, 600),
    getClearColor: (v) => v.copy(r.color),
    getClearAlpha: () => r.alpha,
    setClearColor(c, a) {
      r.color.set(c);
      r.alpha = a;
    },
    setRenderTarget(t) {
      r.target = t;
    },
    clear() {},
    render(scene, camera) {
      r.calls.push({
        scene,
        camera,
        target: r.target,
        layer: camera.layers.mask,
        override: scene.overrideMaterial,
      });
      if (failMask && camera.layers.mask === 1 << APPARITION_LAYER)
        throw Error("mask render failed");
    },
  };
  return r;
}
function worldWithPeek() {
  const scene = new T.Scene();
  scene.background = new T.Color(0x192122);
  scene.fog = new T.FogExp2(0x212932, 0.02);
  const apparition = new DistantFigure(scene);
  apparition.setPeek({ at: [2.48, -35.04] }, new T.Group());
  return { scene, apparition, env: { state: "ruined" } };
}
test("the live 3D silhouette mask retains blur with lens effects off and without float targets", () => {
  for (const float of [true, false]) {
    const r = rendererStub({ float }),
      p = new SchoolRenderer(r, { screenEffects: false }),
      world = worldWithPeek(),
      camera = new T.PerspectiveCamera(68, 1.6, 0.06, 90);
    const before = {
      mask: camera.layers.mask,
      bg: world.scene.background,
      fog: world.scene.fog,
    };
    p.render(world, camera, 2);
    assert.equal(
      r.calls.length,
      3,
      "World, actual geometry mask and screen resolve",
    );
    assert.equal(r.calls[1].layer, 1 << APPARITION_LAYER);
    assert.equal(r.calls[1].override, p.maskMaterial);
    assert.equal(p.maskMaterial.clippingPlanes, world.apparition.clipPlanes);
    assert.equal(p.uniforms.figureActive.value, 1);
    assert.equal(p.uniforms.lensOnly.value, 1);
    assert.equal(p.target.width, 960);
    assert.equal(p.figureTarget.height, 600);
    assert.equal(camera.layers.mask, before.mask);
    assert.equal(world.scene.background, before.bg);
    assert.equal(world.scene.fog, before.fog);
    assert.equal(world.scene.overrideMaterial, null);
    assert.equal(r.color.getHex(), 0x263746);
    assert.equal(r.alpha, 0.7);
    world.apparition.hide();
    r.calls = [];
    p.render(world, camera, 3);
    assert.equal(r.calls.length, 1);
  }
});
test("a failed silhouette mask restores scene, camera layers and renderer state", () => {
  const r = rendererStub({ failMask: true }),
    p = new SchoolRenderer(r, {}),
    world = worldWithPeek(),
    camera = new T.PerspectiveCamera();
  camera.layers.enable(1);
  const layers = camera.layers.mask,
    bg = world.scene.background,
    fog = world.scene.fog;
  assert.throws(() => p.render(world, camera, 2), /mask render failed/);
  assert.equal(camera.layers.mask, layers);
  assert.equal(world.scene.background, bg);
  assert.equal(world.scene.fog, fog);
  assert.equal(world.scene.overrideMaterial, null);
  assert.equal(r.color.getHex(), 0x263746);
  assert.equal(r.alpha, 0.7);
});
test("a motionless observer cannot study a distant figure indefinitely", () => {
  globalThis.document = {
    createElement: () => ({
      getContext: () => new Proxy({}, { get: () => () => {} }),
    }),
    querySelector: () => ({ style: {} }),
  };
  const camera = new T.PerspectiveCamera(68);
  camera.position.set(0, 1.65, -6);
  camera.lookAt(-2.79, 1.8, -18.06);
  const g = {
    started: true,
    camera,
    config: { enemy: false },
    world: {
      scene: new T.Scene(),
      env: { state: "ruined", roomStates: new Map() },
      obstacles: [],
    },
    player: { position: camera.position.clone() },
    teacher: { active: false },
    interactions: {},
    dialogue: {},
    cinematics: {},
    ambushes: {},
    story: { stage: "locker", triggers: { busy: false }, save() {} },
    audio: {
      calls: [],
      cue(name) {
        this.calls.push(name);
      },
    },
    cheats: {},
  };
  const h = new HauntingSystem(g);
  for (let i = 0; i < 280; i++) h.update(1 / 60, i / 60);
  assert.equal(h.active, null);
  assert.equal(h.distant.mesh.visible, false);
  assert.ok(h.fired.has("entrance-vanishing-figure"));
  assert.equal(g.audio.calls.filter((c) => c === "apparitionVanish").length, 1);
});
