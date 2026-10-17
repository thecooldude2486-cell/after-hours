import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../vendor/three.module.js";
import { PlayerPhysics } from "../src/systems/physics.js";
import { DEFAULTS } from "../src/data/config.js";
import { SFX, deviceProfile, deviceDistortionCurve } from "../src/data/sfx.js";
import { SettingsSystem, readSettings } from "../src/systems/settings.js";
import { AudioSystem } from "../src/systems/audio.js";
import { lineClear } from "../src/systems/navigation.js";
function fixture(obstacles = []) {
  const cues = [];
  const p = {
    config: { ...DEFAULTS },
    position: new THREE.Vector3(0, 1.65, 0),
    world: { obstacles },
    audio: { cue: (...v) => cues.push(v) },
    landingNoise: 0,
  };
  p.physics = new PlayerPhysics(p);
  return { p, cues };
}
const desk = {
  enabled: true,
  minX: -0.65,
  maxX: 0.65,
  minZ: 1,
  maxZ: 1.8,
  minY: 0.725,
  maxY: 0.815,
};
test("solid desks stop walking/sprinting without tunnelling at a long frame", () => {
  const { p } = fixture([desk]);
  p.physics.update(0.5, 0, 10, false);
  assert.ok(p.position.z <= 0.78);
  assert.equal(p.physics.feet, 0);
  assert.equal(p.physics.grounded, true);
});
test("a grounded jump has gravity, rejects a second airborne jump, lands stably on a desktop, and falls when walking off", () => {
  const { p, cues } = fixture([desk]);
  assert.equal(p.physics.jump(), true);
  assert.equal(p.physics.jump(), false);
  for (let i = 0; i < 33; i++) p.physics.update(1 / 60, 0, 2.35 / 60, false);
  assert.equal(p.physics.grounded, true);
  assert.ok(Math.abs(p.physics.feet - 0.815) < 0.001);
  assert.ok(Math.abs(p.position.y - 2.465) < 0.001);
  for (let i = 0; i < 60; i++) p.physics.update(1 / 60, 0, 0, false);
  assert.equal(p.physics.feet, 0.815);
  for (let i = 0; i < 90; i++) p.physics.update(1 / 60, 2.35 / 60, 0, false);
  assert.equal(p.physics.feet, 0);
  assert.equal(p.physics.grounded, true);
  assert.ok(cues.some((c) => c[0] === "land"));
  assert.ok(cues.some((c) => c[0] === "jump"));
});
test("jumping cannot cross a full-height locked door, and a low ceiling stops upward motion", () => {
  const door = { ...desk, minY: 0, maxY: 3.8 };
  const { p } = fixture([door]);
  p.physics.jump();
  for (let i = 0; i < 60; i++) p.physics.update(1 / 60, 0, 4.8 / 60, false);
  assert.ok(p.position.z <= 0.78);
  const ceiling = {
    minX: -2,
    maxX: 2,
    minZ: -2,
    maxZ: 2,
    minY: 1.96,
    maxY: 2.2,
  };
  const { p: q } = fixture([ceiling]);
  q.physics.jump();
  let maximum = 0;
  for (let i = 0; i < 60; i++) {
    q.physics.update(1 / 60, 0, 0, false);
    maximum = Math.max(maximum, q.physics.feet);
  }
  assert.ok(maximum <= 0.191);
  assert.equal(q.physics.grounded, true);
  q.physics.jump();
  q.physics.reset();
  assert.equal(q.physics.queued, false);
  assert.equal(q.physics.velocity, 0);
});
test("height-aware sight passes above a desk but walls still occlude", () => {
  assert.equal(
    lineClear({ x: 0, y: 1.65, z: 0 }, { x: 0, y: 1.7, z: 3 }, [desk]),
    true,
  );
  assert.equal(
    lineClear({ x: 0, y: 0.7, z: 0 }, { x: 0, y: 0.8, z: 3 }, [desk]),
    false,
  );
  assert.equal(
    lineClear({ x: 0, y: 1.65, z: 0 }, { x: 0, y: 1.7, z: 3 }, [
      { ...desk, minY: 0, maxY: 3.8 },
    ]),
    false,
  );
});
test("every routed foley/scare file is an actual non-silent PCM asset with documented licenses", async () => {
  const paths = new Set(Object.values(SFX).flatMap((s) => s.files));
  assert.ok(paths.size >= 20);
  for (const path of paths) {
    const data = await readFile(new URL("../" + path, import.meta.url));
    assert.equal(data.subarray(0, 4).toString(), "RIFF");
    assert.equal(data.subarray(8, 12).toString(), "WAVE");
    const at = data.indexOf(Buffer.from("data"), 36);
    let peak = 0;
    for (let i = at + 8; i < data.length - 1; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
    assert.ok(peak > 1000, path);
  }
  for (const pack of ["impact", "rpg"])
    assert.match(
      await readFile(
        new URL("../assets/sfx/" + pack + "-CC0.txt", import.meta.url),
        "utf8",
      ),
      /CC0/,
    );
});
test("intercom uses stronger device processing and reduced distance loss, without altering clean Mara", () => {
  const intercom = deviceProfile({ speaker: "MARA · INTERCOM" }, {}),
    vm = deviceProfile({ speaker: "MARA · VOICEMAIL" }, {}),
    child = deviceProfile({ speaker: "YOUNG MARA" }, {});
  assert.ok(intercom.gain > vm.gain);
  assert.ok(intercom.refDistance >= 12);
  assert.ok(intercom.depth > vm.depth);
  assert.ok(intercom.rolloff < vm.rolloff);
  assert.equal(child.gain, 1);
  const custom = deviceProfile(
    { speaker: "MARA · INTERCOM" },
    { intercomVolume: 0.5, intercomDistortion: 0 },
  );
  assert.equal(custom.gain, 0.5);
  assert.equal(custom.depth, 0);
  const clean = deviceDistortionCurve(0),
    strong = deviceDistortionCurve(0.75);
  assert.equal(clean[512], 0);
  assert.equal(strong[0], -1);
  assert.equal(strong[1024], 1);
  assert.ok(strong[600] > clean[600] * 2);
  assert.ok(Math.abs(strong[424] + strong[600]) < 0.00001);
});
test("settings validate saved values and persist separately from preset tuning; mix ducks ambience during dialogue", () => {
  const settings = readSettings({
    getItem: () =>
      JSON.stringify({
        audioVolume: 8,
        voiceVolume: -2,
        cameraFov: 300,
        scareFlash: false,
        spokenDialogue: false,
        unknown: 42,
      }),
  });
  assert.equal(settings.audioVolume, 1);
  assert.equal(settings.voiceVolume, 0);
  assert.equal(settings.cameraFov, 90);
  assert.equal(settings.scareFlash, false);
  assert.equal(settings.spokenDialogue, false);
  assert.equal(settings.unknown, undefined);
  assert.equal(readSettings({ getItem: () => "null" }).audioVolume, 0.7);
  const originalWindow = globalThis.window;
  globalThis.window = { speechSynthesis: {} };
  try {
    const audio = new AudioSystem({
      ...DEFAULTS,
      ...settings,
      ambienceVolume: 0.5,
      musicVolume: 0.4,
    });
    audio.ctx = { currentTime: 0 };
    audio.master = { gain: { value: 0 } };
    audio.buses = Object.fromEntries(
      ["ambience", "music", "voices", "effects", "scares"].map((k) => [
        k,
        { gain: { value: 0 } },
      ]),
    );
    audio.activeClip = { ended: false };
    audio.applyMix();
    assert.equal(audio.buses.ambience.gain.value, 0.14);
    assert.equal(audio.buses.voices.gain.value, 0);
    audio.activeClip.ended = true;
    audio.applyMix();
    assert.equal(audio.buses.ambience.gain.value, 0.5);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("title and pause settings controls save preferences and close without starting or resuming the story", () => {
  const oldDocument = globalThis.document,
    oldStorage = globalThis.localStorage;
  const elements = new Map(),
    data = new Map();
  const node = () => ({
    style: {},
    classList: { add() {}, remove() {} },
    append(...children) {
      for (const child of children)
        if (child.id) elements.set("#" + child.id, child);
    },
    replaceChildren() {},
    textContent: "",
  });
  globalThis.document = {
    querySelector: (s) => {
      if (!elements.has(s)) elements.set(s, node());
      return elements.get(s);
    },
    createElement: node,
    createTextNode: (text) => ({ textContent: text }),
  };
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  try {
    const game = {
      started: false,
      paused: false,
      config: { ...DEFAULTS },
      camera: new THREE.PerspectiveCamera(68, 1, 0.06, 90),
      cinematics: { active: null },
      audio: { applyMix() {}, suspend() {}, stopLine() {}, stopEffects() {} },
      pause() {
        this.paused = true;
      },
    };
    const settings = new SettingsSystem(game);
    const quality=elements.get('#setting_performanceMode');
    quality.value='low';quality.onchange();
    assert.equal(JSON.parse(data.get('after-hours-settings')).performanceMode,'low');
    const input = elements.get("#setting_intercomVolume");
    input.value = "2.1";
    input.oninput();
    assert.equal(game.config.intercomVolume, 2.1);
    assert.equal(
      JSON.parse(data.get("after-hours-settings")).intercomVolume,
      2.1,
    );
    elements.get("#titleSettings").onclick();
    settings.close();
    assert.equal(game.started, false);
    assert.equal(game.paused, false);
    game.started = true;
    elements.get("#settingsButton").onclick();
    assert.equal(game.paused, true);
    settings.close();
    assert.equal(game.paused, true);
    elements.get("#resetSettings").onclick();
    assert.equal(game.config.intercomVolume, 1.8);
    assert.equal(game.config.cameraFov, 68);
  } finally {
    globalThis.document = oldDocument;
    globalThis.localStorage = oldStorage;
  }
});
