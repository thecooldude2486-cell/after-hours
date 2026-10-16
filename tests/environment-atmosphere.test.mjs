import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { loadMaraModel } from "../src/world/mara.js";
import { createSchool } from "../src/world/school.js";
import { AmbushSystem, scareDirection } from "../src/systems/ambushes.js";
import { AMBUSH_REVISION, ROOM_AMBUSHES } from "../src/data/ambushes.js";
import { DEFAULTS } from "../src/data/config.js";
import { SCHOOL_ART } from "../src/world/school-art.js";
import { MUSIC, atmosphereCue } from "../src/data/atmosphere.js";
import { AtmosphereSystem } from "../src/systems/atmosphere.js";
import { AudioSystem } from "../src/systems/audio.js";
import { SchoolRenderer } from "../src/systems/rendering.js";
import { animateTeacher } from "../src/world/teacher-model.js";
import { InteractionSystem } from "../src/systems/interaction.js";
import { lineClear } from "../src/systems/navigation.js";
const ui = new Map(),
  ctx = new Proxy({}, { get: () => () => {}, set: () => true });
const element = () => ({
  style: {},
  textContent: "",
  classList: { add() {}, remove() {} },
});
globalThis.document = {
  createElement: () => ({ getContext: () => ctx }),
  querySelector: (s) => {
    if (!ui.has(s)) ui.set(s, element());
    return ui.get(s);
  },
};
const data = await readFile(
  new URL("../assets/models/mara-base.glb", import.meta.url),
);
await loadMaraModel(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
);
test("normal school swaps clean surfaces, friendly photographs and posters; horror writing, leaks and puddles disappear", () => {
  const w = createSchool({}, DEFAULTS);
  assert.equal(w.art.photos.length, 6);
  assert.equal(w.art.writing.length, 7);
  assert.ok(w.art.photos.every((m) => m.material.emissiveIntensity >= 0.15));
  for (const m of w.art.writing.filter((m) => m.position.z > -28 && m.position.x > -3))
    assert.ok(
      m.position.y - m.geometry.parameters.height / 2 > 2.54,
      "Early writing sits above locker tops",
    );
  const dirtyPhoto = w.art.photos[0].material.map;
  const floor = w.env.entries.find((e) => e.role === "floor").mesh,
    dirtyFloor = floor.material.map;
  w.env.set("normal", "school", true);
  w.update(0, 0, { position: new THREE.Vector3() });
  assert.notEqual(floor.material.map, dirtyFloor);
  assert.ok(floor.material.bumpMap);
  assert.notEqual(w.art.photos[0].material.map, dirtyPhoto);
  assert.ok(w.art.writing.every((m) => !m.visible));
  assert.ok(w.art.friendlyProps.every((m) => m.visible));
  assert.ok(w.rain.every((m) => !m.visible));
  assert.ok(
    w.env.entries
      .filter((e) => ["debris", "puddle", "water-bucket"].includes(e.role))
      .every((e) => !e.mesh.visible),
  );
  assert.ok(w.scene.fog.density < 0.01);
  assert.ok(w.env.ambient.intensity >= 2);
  w.env.set("ruined", "school", true);
  w.update(0, 0, { position: new THREE.Vector3() });
  assert.equal(w.art.photos[0].material.map, dirtyPhoto);
  assert.equal(floor.material.map, dirtyFloor);
  assert.ok(w.art.writing.every((m) => m.visible));
  assert.ok(w.art.friendlyProps.every((m) => !m.visible));
});
test("school stays readable without a flashlight while friendly states retain daylight", () => {
  const w = createSchool({}, DEFAULTS), player = { position: new THREE.Vector3() };
  w.update(0, 0, player);
  const darkFixture = w.lights.filter(f => f.light).map(f => f.light.intensity);
  assert.ok(w.env.ambient.intensity >= 0.4);
  assert.ok(w.scene.environmentIntensity >= 0.5);
  assert.ok(w.exterior.intensity >= 0.8);
  for (const state of ["normal", "memory"]) {
    w.env.set(state, "school", true);
    w.update(0, 0, player);
    assert.ok(w.env.ambient.intensity >= 2);
    assert.equal(w.scene.environmentIntensity, 1);
    assert.ok(w.exterior.intensity >= 2);
    w.lights.filter(f => f.light).forEach((f,i) => assert.ok(f.light.intensity > darkFixture[i]*1.5));
  }
  for (const state of ["ruined", "burned", "distorted"]) {
    w.env.set(state, "school", true);
    w.update(0, 0, player);
    assert.ok(w.env.ambient.intensity >= 0.4);
    assert.ok(w.scene.environmentIntensity >= 0.5);
    assert.ok(w.exterior.intensity >= 0.8);
  }
  assert.equal(w.flash, undefined);
});
test("Teacher animation overlays do not accumulate head and chest rotation between frames", () => {
  const w = createSchool({}, DEFAULTS),
    actor = w.teacher;
  actor.visible = true;
  animateTeacher(actor, 0, 0);
  const head = actor.userData.head.quaternion.clone();
  const chest = actor.userData.model
    .getObjectByName("Chest")
    .quaternion.clone();
  for (let i = 0; i < 300; i++) animateTeacher(actor, 0, 0);
  assert.ok(head.angleTo(actor.userData.head.quaternion) < 1e-6);
  assert.ok(
    chest.angleTo(actor.userData.model.getObjectByName("Chest").quaternion) <
      1e-6,
  );
});
function game() {
  return {
    config: { ...DEFAULTS, enemy: false, preset: "story" },
    world: {
      scene: new THREE.Scene(),
      env: { state: "ruined", roomStates: new Map() },
      obstacles: [],
    },
    player: {
      position: new THREE.Vector3(9, 1.65, -19),
      yaw: 0,
      keys: new Set(),
      sanity: 100,
    },
    camera: new THREE.PerspectiveCamera(),
    teacher: { active: true },
    cinematics: { active: null },
    dialogue: { current: null },
    interactions: { reader: false },
    story: { stage: "cassette", triggers: { busy: false }, save() {} },
    audio: { cue() {}, stopLine() {} },
    cheats: {},
  };
}
test("school photographs open as visible images in both states and cannot pause an active pursuer", async () => {
  const g = game();
  g.requestLock = () => {};
  let cancellations = 0;
  g.hauntings = {
    cancel() {
      cancellations++;
    },
  };
  const interaction = new InteractionSystem(g);
  const target = { type: "gallery", room: "office", mesh: { visible: true } };
  await interaction.use(target);
  assert.equal(ui.get("#readImage").src, SCHOOL_ART.haunted);
  assert.equal(ui.get("#readBody").textContent, "");
  assert.equal(
    cancellations,
    1,
    "Reading cancels a live school scare before gameplay pauses",
  );
  interaction.close();
  g.world.env.state = "normal";
  await interaction.use(target);
  assert.equal(ui.get("#readImage").src, SCHOOL_ART.friendly);
  interaction.close();
  g.config.enemy = true;
  g.teacher.state = "Chase";
  await interaction.use(target);
  assert.equal(interaction.reader, false);
});
test("all three distinct room models trigger across exploration steps in Story, survive save restoration and stay out of normal scenes", () => {
  for (const room of ROOM_AMBUSHES) {
    const g = game();
    g.player.position.set(
      (room.bounds[0] + room.bounds[1]) / 2,
      1.65,
      (room.bounds[2] + room.bounds[3]) / 2,
    );
    g.camera.position.copy(g.player.position);
    const a = new AmbushSystem(g);
    assert.equal(a.monsters.size, 3);
    assert.equal(
      new Set([...a.monsters.values()].map((m) => m.userData.variant)).size,
      3,
    );
    a.reset({ cleared: [room.id] });
    assert.equal(
      a.cleared.size,
      0,
      "Old encounter revisions rearm after this update",
    );
    g.world.env.state = "normal";
    a.update(0.1, 0);
    assert.equal(a.active, null);
    g.world.env.state = "ruined";
    a.update(0.1, 1);
    assert.equal(a.active.room.id, room.id);
    assert.equal(a.monster.userData.variant, room.variant);
    assert.equal(a.monster.visible, true);
    for (let i = 0; i < 6; i++) {
      a.update(0.1, i + 2);
      a.tap({ code: "KeyE", repeat: false });
    }
    assert.ok(a.active, "Minimum visible reveal remains even after fast taps");
    a.update(0.2, 10);
    assert.ok(a.cleared.has(room.id));
    const save = a.snapshot();
    assert.equal(save.revision, AMBUSH_REVISION);
    a.reset(save);
    assert.ok(a.cleared.has(room.id));
    a.rearm();
    assert.equal(a.cleared.size, 0);
  }
});
test("room attack direction stays visible when entering facing a solid wall", () => {
  const g = game();
  g.player.position.set(8, 1.65, -19);
  g.camera.position.copy(g.player.position);
  g.camera.lookAt(8, 1.65, -25);
  const walls = [
    {
      enabled: true,
      minX: 7,
      maxX: 9,
      minZ: -20,
      maxZ: -19.4,
      minY: 0,
      maxY: 3,
    },
  ];
  const dir = scareDirection(
    g.camera,
    g.player.position,
    ROOM_AMBUSHES[0],
    walls,
  );
  assert.ok(
    lineClear(
      g.camera.position,
      g.camera.position.clone().addScaledVector(dir, 1),
      walls,
    ),
  );
  assert.ok(Math.abs(dir.x) > 0.4);
});
test("photographic atlases and all original music are bundled real assets; wrong music uses empty-room positions and stops for emotional scenes", async () => {
  for (const path of Object.values(SCHOOL_ART)) {
    const bytes = await readFile(new URL("../" + path, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.ok(bytes.readUInt32BE(16) >= 1000);
  }
  for (const path of Object.values(MUSIC)) {
    const bytes = await readFile(new URL("../" + path, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
    const at = bytes.indexOf(Buffer.from("data"), 36),
      count = bytes.readUInt32LE(at + 4);
    assert.ok(count > 24000 * 10 * 2);
    let peak = 0;
    for (let i = at + 8; i < at + 8 + count; i += 2)
      peak = Math.max(peak, Math.abs(bytes.readInt16LE(i)));
    assert.ok(peak > 1000);
  }
  const g = game();
  g.started = true;
  g.story.companion = false;
  assert.equal(atmosphereCue(g).id, "wrong");
  assert.equal(atmosphereCue(g).zone.id, "office");
  g.world.env.state = "normal";
  assert.equal(atmosphereCue(g).id, "friendly");
  g.world.env.state = "ruined";
  g.story.stage = "embrace";
  assert.equal(atmosphereCue(g), null);
  let starts = 0,
    stops = 0;
  g.story.stage = "drawing";
  g.audio.playMusic = () => {
    starts++;
    return {
      playing: true,
      stop() {
        this.playing = false;
        stops++;
      },
    };
  };
  const a = new AtmosphereSystem(g);
  a.update();
  a.update();
  assert.equal(starts, 1);
  g.story.stage = "reunion";
  a.update();
  assert.equal(stops, 1);
});
test("music sources route through music gain and checkpoint cleanup stops looping sources", () => {
  const audio = new AudioSystem(DEFAULTS),
    nodes = [];
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {
      this.disconnected = true;
    },
  });
  audio.ctx = {
    createGain: () => ({ ...node(), gain: { value: 0 } }),
    createBufferSource: () => {
      const s = {
        ...node(),
        playbackRate: { value: 1 },
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      nodes.push(s);
      return s;
    },
  };
  audio.master = node();
  audio.buses = { music: node() };
  audio.sfxBuffers.set(MUSIC.friendly, {});
  const h = audio.playMusic("friendly", null, 0.2);
  assert.equal(nodes[0].loop, true);
  assert.equal(h.playing, true);
  audio.stopEffects();
  assert.equal(h.playing, false);
  assert.equal(nodes[0].stopped, true);
  assert.equal(audio.musicLoops.size, 0);
});
test("HDR presentation resizes to actual output, resolves to screen, uses friendly profile and offers a direct render fallback", () => {
  const calls = [],
    renderer = {
      getDrawingBufferSize: (v) => v.set(800, 500),
      setRenderTarget: (t) => calls.push(["target", t]),
      render: (s, c) => calls.push(["render", s, c]),
    };
  const config = { screenEffects: true },
    p = new SchoolRenderer(renderer, config),
    world = { scene: new THREE.Scene(), env: { state: "normal" } },
    camera = new THREE.PerspectiveCamera(68, 1.6, 0.06, 90);
  p.render(world, camera, 2);
  assert.equal(p.target.width, 800);
  assert.equal(p.target.height, 500);
  assert.equal(p.uniforms.friendly.value, 1);
  assert.equal(calls.filter((c) => c[0] === "render").length, 2);
  assert.equal(calls.at(-2)[1], null);
  assert.ok(
    !p.material.fragmentShader.includes("tonemapping_pars_fragment"),
    "Renderer injects this chunk; duplicating it breaks GLSL",
  );
  config.screenEffects = false;
  calls.length = 0;
  p.render(world, camera, 3);
  assert.equal(calls.filter((c) => c[0] === "render").length, 1);
  assert.equal(calls[1][1], world.scene);
  config.screenEffects = true;
  p.supported = false;
  calls.length = 0;
  p.render(world, camera, 4);
  assert.equal(calls.filter((c) => c[0] === "render").length, 1);
});
