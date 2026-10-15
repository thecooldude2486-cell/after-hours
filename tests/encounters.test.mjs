import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three.module.js";
import { TeacherAI } from "../src/systems/teacher.js";
import { CinematicSystem } from "../src/systems/cinematics.js";
import { DEFAULTS, loadConfig } from "../src/data/config.js";

function encounter() {
  const mesh = new THREE.Group();
  mesh.position.set(0, 0, 0);
  const world = { teacher: mesh, obstacles: [] };
  const player = {
    position: new THREE.Vector3(0, 1.65, -4),
    noise: 0,
    flashlight: true,
    hidden: null,
    crouched: false,
  };
  const captures = [];
  const ai = new TeacherAI(
    world,
    player,
    { cue() {} },
    { ...DEFAULTS },
    (reason) => captures.push(reason),
  );
  ai.activate(0, 0);
  ai.grace = 0;
  mesh.rotation.y = 0;
  return { ai, player, captures };
}
test("witnessed hiding is searched and captured once; unwitnessed hiding stays safe", () => {
  const { ai, player, captures } = encounter();
  ai.noticeHide({ id: "locker" });
  assert.ok(ai.witnessedHide);
  player.hidden = { spot: { id: "locker" } };
  ai.mesh.position.set(0, 0, -3.5);
  for (let i = 0; i < 200; i++) ai.update(0.02);
  assert.deepEqual(captures, ["witnessed"]);
  const safe = encounter();
  safe.ai.mesh.rotation.y = Math.PI;
  safe.ai.noticeHide({ id: "locker" });
  assert.equal(safe.ai.witnessedHide, null);
  safe.player.hidden = { spot: { id: "locker" } };
  for (let i = 0; i < 1500; i++) safe.ai.update(0.02);
  assert.equal(safe.captures.length, 0);
});
test("a pursuer remembers a player after the first second without sight", () => {
  const { ai, player } = encounter();
  ai.change("Chase", player.position);
  ai.lastKnown = { x: 0, z: -4 };
  player.hidden = { spot: { id: "locker" } };
  ai.update(1.5);
  assert.equal(ai.state, "Chase");
  ai.update(1.6);
  assert.equal(ai.state, "Search");
});
test("Teacher route refreshes never reverse an unobstructed pursuit and turns use the shortest angle", () => {
  const { ai } = encounter();
  ai.mesh.position.set(0.13, 0, -0.11);
  ai.change("Chase", { x: 0.13, z: -12 });
  let previous = ai.mesh.position.z;
  for (let i = 0; i < 160; i++) {
    ai.moveTo(ai.target, 0.02, 2);
    assert.ok(
      ai.mesh.position.z <= previous + 1e-8,
      "Route refresh must not send her backwards",
    );
    previous = ai.mesh.position.z;
  }
  assert.ok(previous < -5, "Pursuit makes steady forward progress");
  ai.mesh.rotation.y = Math.PI - 0.01;
  ai.path = [{ x: ai.mesh.position.x - 0.01, z: ai.mesh.position.z + 1 }];
  ai.pathTimer = 1;
  const before = ai.mesh.rotation.y;
  ai.moveTo(ai.path[0], 0.02, 2);
  assert.ok(
    Math.abs(ai.mesh.rotation.y - before) <=
      ai.config.teacherTurnSpeed * 0.02 + 1e-8,
  );
});
test("old saved defaults migrate to harder encounters without discarding volume", () => {
  const config = loadConfig({
    getItem: () =>
      JSON.stringify({
        chaseSpeed: 3.65,
        searchDuration: 12,
        audioVolume: 0.4,
      }),
  });
  assert.equal(config.chaseSpeed, DEFAULTS.chaseSpeed);
  assert.equal(config.searchDuration, 24);
  assert.equal(config.audioVolume, 0.4);
  const custom = loadConfig({
    getItem: () => JSON.stringify({ revision: 3, chaseSpeed: 3 }),
  });
  assert.equal(custom.chaseSpeed, 3);
});
test("camera sequences complete, skip, and cancel without leaving input locked", async () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    querySelector: () => ({
      style: {},
      classList: { add() {}, remove() {} },
      textContent: "",
    }),
  };
  try {
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 90);
    camera.position.set(0, 1.65, 0);
    const teacher = new THREE.Group();
    teacher.position.z = -2;
    const game = {
      camera,
      world: { teacher, mara: new THREE.Group() },
      audio: { cue() {} },
      player: { keys: new Set(), syncCamera() {} },
    };
    const shots = new CinematicSystem(game);
    const completed = shots.play("teacherArrival");
    shots.update(2);
    await completed;
    assert.equal(shots.active, null);
    assert.equal(camera.fov, 68);
    const cancelled = shots.play("reunion");
    shots.cancel();
    await cancelled;
    assert.equal(shots.active, null);
    const skipped = shots.play("fireMemory");
    shots.update(0.5);
    shots.skip();
    await skipped;
    assert.equal(shots.active, null);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("capture cancels progression, shows a retry screen, and restores the same encounter", async () => {
  const { CaptureSystem } = await import("../src/systems/capture.js");
  const previousDocument = globalThis.document;
  const ui = new Map();
  globalThis.document = {
    querySelector(s) {
      if (!ui.has(s))
        ui.set(s, {
          style: {},
          textContent: "",
          classList: {
            values: new Set(["hidden"]),
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
        });
      return ui.get(s);
    },
    exitPointerLock() {},
  };
  try {
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 90);
    camera.position.set(0, 1.65, 0);
    const g = {
      config: { ...DEFAULTS, enemy: true },
      recovering: false,
      attempts: 0,
      paused: false,
      camera,
      world: { teacher: new THREE.Group(), mara: new THREE.Group() },
      teacher: { active: true },
      player: {
        position: camera.position.clone(),
        yaw: 0,
        keys: new Set(["KeyW"]),
        leaveHide() {},
        syncCamera() {},
      },
      story: {
        stage: "vale",
        epoch: 0,
        triggers: { reset() {} },
        async start(stage) {
          this.stage = stage;
          g.teacher.active = true;
          g.player.stamina = 4.5;
        },
      },
      dialogue: { reset() {} },
      audio: { cue() {}, resume() {} },
      requestLock() {},
    };
    g.cinematics = new CinematicSystem(g);
    const capture = new CaptureSystem(g);
    const first = capture.catchPlayer("exhausted");
    await capture.catchPlayer("caught");
    assert.equal(g.attempts, 1);
    assert.equal(g.story.epoch, 1);
    assert.equal(g.teacher.active, false);
    assert.equal(g.player.keys.size, 0);
    assert.equal(
      globalThis.document.querySelector("#death").classList.contains("hidden"),
      true,
    );
    g.cinematics.update(2);
    await first;
    assert.equal(
      globalThis.document.querySelector("#death").classList.contains("hidden"),
      false,
    );
    assert.match(
      globalThis.document.querySelector("#deathTip").textContent,
      /breath/,
    );
    await capture.retry();
    assert.equal(g.story.stage, "vale");
    assert.equal(g.recovering, false);
    assert.equal(g.teacher.active, true);
    assert.equal(g.player.stamina, 4.5);
    assert.equal(
      globalThis.document.querySelector("#death").classList.contains("hidden"),
      true,
    );
  } finally {
    globalThis.document = previousDocument;
  }
});
