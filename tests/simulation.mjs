// Runs the actual scene, movement, interactions, sequencing and AI without a graphics driver.
// The tiny DOM shim supplies only UI/canvas calls; gameplay modules are not mocked.
import assert from "node:assert/strict";
const elements = new Map();
const element = () => ({
  style: {},
  classList: {
    values: new Set(),
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
  textContent: "",
  addEventListener() {},
  append() {},
  replaceChildren() {},
});
const drawingContext = new Proxy({}, { get: () => () => {}, set: () => true });
globalThis.document = {
  querySelector(s) {
    if (!elements.has(s)) elements.set(s, element());
    return elements.get(s);
  },
  createElement() {
    return {
      ...element(),
      width: 256,
      height: 256,
      getContext: () => drawingContext,
    };
  },
  addEventListener() {},
  exitPointerLock() {},
};
globalThis.window = { addEventListener() {}, speechSynthesis: { cancel() {} } };
globalThis.localStorage = {
  data: new Map(),
  getItem(k) {
    return this.data.get(k) || null;
  },
  setItem(k, v) {
    this.data.set(k, v);
  },
  removeItem(k) {
    this.data.delete(k);
  },
};
const THREE = await import("../vendor/three.module.js");
const { DEFAULTS } = await import("../src/data/config.js");
const { STAGES } = await import("../src/data/beats.js");
const { readFile } = await import("node:fs/promises");
const { loadMaraModel } = await import("../src/world/mara.js");
const bytes = await readFile(
  new URL("../assets/models/mara-base.glb", import.meta.url),
);
await loadMaraModel(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const { loadHandModels } = await import("../src/world/hand-rig.js");
const handBytes = {};
for (const side of ["left", "right"]) {
  const b = await readFile(
    new URL("../assets/models/hand-" + side + "-v14.glb", import.meta.url),
  );
  handBytes[side] = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}
await loadHandModels(handBytes);
const { HauntingSystem } = await import("../src/systems/hauntings.js");
const { AmbushSystem } = await import("../src/systems/ambushes.js");
const { InventorySystem } = await import("../src/systems/inventory.js");
const { ResourceSystem } = await import("../src/systems/resources.js");
const { CheatSystem } = await import("../src/systems/cheats.js");
const { applyPreset } = await import("../src/data/presets.js");
const { createSchool } = await import("../src/world/school.js");
const { Player } = await import("../src/systems/player.js");
const { AudioSystem } = await import("../src/systems/audio.js");
const { DialogueSystem } = await import("../src/systems/dialogue.js");
const { InteractionSystem } = await import("../src/systems/interaction.js");
const { TeacherAI } = await import("../src/systems/teacher.js");
const { ObjectiveSystem } = await import("../src/systems/objectives.js");
const { StorySystem } = await import("../src/systems/story.js");
const { CinematicSystem } = await import("../src/systems/cinematics.js");
const { Navigation, blocked, lineClear } = await import(
  "../src/systems/navigation.js"
);
const g = {
  config: {
    ...DEFAULTS,
    dialogueTiming: 0.01,
    triggerTiming: 0.01,
    transitionDuration: 0.01,
  },
  paused: false,
  ended: false,
  time: 0,
  catches: 0,
  requestLock() {},
  finish() {
    this.ended = true;
  },
  fail(e) {
    throw e;
  },
};
const preset = process.env.AFTER_HOURS_PRESET || "normal";
applyPreset(g.config, preset);
g.camera = new THREE.PerspectiveCamera(68, 1.6, 0.06, 90);
g.world = createSchool({}, g.config);
g.audio = new AudioSystem(g.config);
g.audio.voice = false; // This simulation stubs sound output; WAV assets are checked separately.
g.player = new Player(g.camera, g.world, g.audio, g.config);
g.dialogue = new DialogueSystem(g.audio, g.config);
g.interactions = new InteractionSystem(g);
g.teacher = new TeacherAI(g.world, g.player, g.audio, g.config, () => {
  g.catches++;
  g.teacher.deactivate();
});
g.objectives = new ObjectiveSystem(document.querySelector("#objective"));
g.cinematics = new CinematicSystem(g);
g.story = new StorySystem(g);
g.inventory = new InventorySystem(g);
g.resources = new ResourceSystem(g);
g.cheats = new CheatSystem(g);
g.ambushes = new AmbushSystem(g);
g.hauntings = new HauntingSystem(g);
g.catchPlayer = () => {
  g.catches++;
  g.ambushes.reset();
};
function step(dt = 1 / 60) {
  if (!g.interactions.reader) {
    g.time += dt;
    g.player.update(dt, !g.cinematics.active && !g.ambushes.blocking);
    g.dialogue.update(dt);
    if (
      !g.cinematics.active &&
      !g.ambushes.blocking &&
      g.config.enemy &&
      !g.cheats.freezeTeacher
    )
      g.teacher.update(dt);
    g.resources.update(dt);
    if (!g.ambushes.blocking) g.story.update(dt, g.time);
    g.ambushes.update(dt, g.time);
    g.hauntings.update(dt, g.time);
    if (
      g.ambushes.blocking &&
      g.ambushes.active.elapsed - g.ambushes.active.lastTap >= 0.13
    )
      g.ambushes.tap({ code: "KeyE", repeat: false, preventDefault() {} });
    g.world.env.update(dt, g.time);
    g.world.update(dt, g.time, g.player);
    g.world.scene.updateMatrixWorld(true);
    if (!g.cinematics.active && !g.ambushes.blocking) g.interactions.update(dt);
    g.cinematics.update(dt);
  }
}
async function until(condition, label, limit = 3000) {
  for (let i = 0; i < limit; i++) {
    step();
    if (condition()) return;
    await new Promise((r) => setTimeout(r, 1));
  }
  throw Error(
    "Timed out: " +
      label +
      " at " +
      g.story.stage +
      " / busy " +
      g.story.triggers.busy +
      " / Teacher " +
      JSON.stringify({
        state: g.teacher.state,
        active:g.teacher.active,catches:g.catches,player:g.player.position.toArray(),safeTime:g.story.safeTime,
        position: g.teacher.mesh.position.toArray(),
        target: g.teacher.target,
        next: g.teacher.path[0],
      }),
  );
}
async function stage(s) {
  await until(
    () => g.story.stage === s && !g.story.triggers.busy,
    "stage " + s,
  );
  console.log("PASS story stage:", s);
}
async function walk(x, z, mode = "sprint") {
  const nav = new Navigation(g.world.obstacles),
    route = nav.path(g.player.position, { x, z });
  assert.ok(
    route.length ||
      Math.hypot(x - g.player.position.x, z - g.player.position.z) < 1,
    "Reachable route " +
      x +
      "," +
      z +
      " from " +
      g.player.position.x +
      "," +
      g.player.position.z,
  );
  for (const point of route) {
    let frames = 0;
    while (
      Math.hypot(point.x - g.player.position.x, point.z - g.player.position.z) >
        0.18 &&
      frames++ < 650
    ) {
      const dx = point.x - g.player.position.x,
        dz = point.z - g.player.position.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.keys.add("KeyW");
      if (mode === "sprint") g.player.keys.add("ShiftLeft");
      if (mode === "crouch") g.player.keys.add("KeyC");
      step();
    }
    g.player.keys.clear();
    assert.ok(frames < 650, "Collision-free walk to " + JSON.stringify(point));
  }
  g.player.keys.clear();
}
function aim(t) {
  if (t.id === "mara") {
    t.position.copy(g.world.mara.position);
    t.position.y += 1.3;
  }
  const d = t.position.clone().sub(g.player.position);
  g.player.yaw = Math.atan2(-d.x, -d.z);
  g.player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  g.player.syncCamera(0);
  g.world.scene.updateMatrixWorld(true);
  g.interactions.update();
  assert.equal(
    g.interactions.focus?.id,
    t.id,
    "Real focus on " + t.id + "; found " + g.interactions.focus?.id,
  );
}
async function pushDoorBody(door) {
  const centre=new THREE.Vector3(door.hinge.position.x+door.baseAxis.x*door.width/2,1.65,door.hinge.position.z+door.baseAxis.z*door.width/2);
  const normal=new THREE.Vector3(-door.baseAxis.z,0,door.baseAxis.x);
  const side=Math.sign(g.player.position.clone().sub(centre).dot(normal))||1;
  const goal=centre.clone().addScaledVector(normal,-side*.95);
  for(let i=0;i<240;i++){
    const delta=goal.clone().sub(g.player.position);delta.y=0;
    if(delta.length()<.16)break;
    g.player.yaw=Math.atan2(-delta.x,-delta.z);g.player.keys.add("KeyW");g.player.keys.add("ShiftLeft");step();
  }
  g.player.keys.clear();
  assert.ok(g.player.position.clone().sub(centre).dot(normal)*side<-.5,"Body pushed through "+door.id);
}
async function use(id, x, z) {
  if (x != null) await walk(x, z);
  const t = g.world.interactables.find((t) => t.id === id);
  aim(t);
  const wasOpen=t.door?.open;
  await g.interactions.use();
  if(t.door?.pushable&&t.door.unlatched&&!wasOpen)await pushDoorBody(t.door);
  if (g.interactions.reader) {
    g.interactions.readOpened = 0;
    g.interactions.close();
  }
}
const { PRESETS } = await import("../src/data/presets.js");
for (const id of Object.keys(PRESETS)) {
  applyPreset(g.config, id);
  g.inventory.reset();
  g.inventory.restore({});
  const get = (item) => g.world.interactables.find((t) => t.item === item);
  const reachable = (start, t, label) => {
    const nav = new Navigation(g.world.obstacles),
      end = t.container?.approach || {
        x: t.position.x,
        z: t.position.z + 0.85,
      };
    assert.ok(
      nav.path(start, end).length ||
        Math.hypot(end.x - start.x, end.z - start.z) < 1,
      id + ": accessible " + label,
    );
  };
  reachable({ x: 0, z: 8 }, get("lockerKey"), "locker key");
  reachable({ x: 0, z: -11 }, get("classroomKey"), "classroom key");
  assert.equal(
    new Navigation(g.world.obstacles).path({ x: 0, z: -16 }, { x: -9, z: -18 })
      .length,
    0,
    "Classroom 04 is physically locked",
  );
  g.world.openDoor(
    g.world.doors.find((d) => d.id === "classroomGate"),
    true,
  );
  reachable({ x: -5, z: -16.5 }, get("staffKey"), "Classroom 08 key");
  g.world.openDoor(
    g.world.doors.find((d) => d.id === "phoneGate"),
    true,
  );
  reachable({ x: 5, z: -36.5 }, get("recordsKey"), "staff cabinet key");
  reachable({ x: 17.5, z: -44 }, get("fuse"), "maintenance fuse");
  reachable({ x: -5, z: -36.5 }, get("cutters"), "bolt cutters");
  const nav = new Navigation(g.world.obstacles);
  assert.equal(
    nav.path({ x: 0, z: -60 }, { x: 0, z: -66 }).length,
    0,
    "Both gym entrances are locked",
  );
  g.world.openDoor(
    g.world.doors.find((d) => d.id === "classDoor"),
    true,
  );
  reachable(
    { x: 0, z: -60 },
    { position: new THREE.Vector3(2, 1.2, -74) },
    "Mara notebook after cutting padlock",
  );
  for (const t of g.world.interactables.filter(
    (t) => t.type === "pickup" && t.available,
  ))
    for (const n of g.world.interactables.filter(
      (n) => n.type === "note" && n.id !== "bracelet",
    ))
      assert.ok(
        Math.hypot(t.position.x - n.position.x, t.position.z - n.position.z) >
          0.3,
        "Pickup does not overlap story prop " + id + ": " + t.id + " / " + n.id,
      );
  console.log("PASS solvable locked-door layout:", id);
}
applyPreset(g.config, preset);
await g.story.start("arrival", { fresh: true });
await stage("locker");
// A real route from the entrance through the school; story events are produced by the interaction system.
const pickup = async (item) => {
  const t = g.world.interactables.find((t) => t.item === item && t.available);
  assert.equal(t.enabled, false, "Item begins concealed");
  const c = t.container;
  await use(c.id, c.approach.x, c.approach.z);
  await until(() => c.amount > 0.99, "Container opens");
  await until(() => !g.ambushes.active, "Resolve room hazard");
  g.inventory.syncStorage();
  assert.equal(t.enabled, true, "Opening storage reveals item");
  await use(t.id);
  assert.ok(g.inventory.has(item));
};
await pickup("lockerKey");
await use("bracelet", -1.5, -7.3);
await stage("drawing");
await pickup("classroomKey");
await use("classroomGate", -1.6, -16.5);
await pickup("staffKey");
await use("drawing", -9, -14.4);
await stage("cassette");
await use("cassette", -5.2, -21.3);
await stage("survive");
await use("hideDesk_classroom", -6.4, -16.6);
assert.ok(g.player.hidden);
assert.equal(g.teacher.sees(), false, "Cover breaks sight");
// Waiting in cover no longer completes the encounter.
for (let i = 0; i < 600; i++) step();
assert.equal(g.story.stage, "survive", "No timed auto-win inside a locker");
if (g.config.enemy)
  await until(
    () => g.teacher.mesh.position.z > -12 && g.teacher.state === "Patrol",
    "Teacher passes Classroom 04",
    6000,
  );
g.player.leaveHide();
await walk(-1.3, -17, "crouch");
await use("phoneGate", 1.5, -36.5);
await use("phoneGate"); // Pull the door closed behind us after physically pushing through it.
await walk(10, -42, "sprint");
await stage("phone");
await pickup("recordsKey");
await use("phone", 12.4, -39.7);
await until(() => g.interactions.reader, "family memory");
g.interactions.close();
await stage("afternoon");
await use("phoneGate",4.5,-36.5); // Release the door we closed during the chase, then push back into the hall.
await use("clock", 0, -46);
await until(() => g.story.stage === "walkaway", "afternoon entered");
await walk(0, -6);
await stage("fault");
await pickup("fuse");
await use("fuseBox", 18.3, -50);
assert.equal(g.inventory.power, true);
await use("fault", 17.5, -50.8);
await stage("vale");
await walk(16.5, -37.5);
const pressureDoor = g.world.interactables.find((t) => t.id === "escapeDoor");
aim(pressureDoor);
g.player.keys.add("KeyE");
await g.interactions.use();
await until(() => g.world.escapeDoor.unlatched, "Force door latch under pressure");
g.player.keys.clear();await pushDoorBody(g.world.escapeDoor);
// The repaired pursuit no longer loses time backtracking. Shut the classroom
// door to break sight before entering the corridor locker unseen.
await use("phoneGate", 1.5, -36.5);
await walk(0, -26);
await use("hideHall", 1.5, -25.3);
if (g.config.enemy)
  await until(
    () => g.teacher.state === "Return" && g.teacher.mesh.position.z < -50,
    "Let the Teacher retreat before leaving cover",
    6000,
  );
g.player.leaveHide();
await use("phoneGate", 1.5, -36.5); // Reopen the route after her retreat for the later escort.
await use("vale", -11, -37.8);
await stage("waiting");
await pickup("cutters");
await use("classDoor", 0, -60.8);
await use("waiting", 2, -72.8);
await stage("reunion");
await use("mara", 0, -68.6);
await stage("embrace");
await use("mara");
await stage("escortLatch");
await use("latch", 17.5, -35.8);
await stage("entrance");
assert.equal(g.world.latch.obstacle.enabled, false);
await walk(0, 10);
await stage("outside");
await walk(0, 15.5);
await stage("return");
await use("mara", 0, 11.5);
await stage("lastClass");
await walk(-7, -16);
await stage("seat");
await use("seat", -9, -16.5);
await stage("leave");
await use("leave", -4.3, -16.5);
await stage("lastPhone");
await use("lastPhone", 0.5, 16.4);
await until(() => g.ended, "ending");
assert.equal(g.story.stage, "end");
assert.equal(g.catches, 0, "Fair route survives both encounters");
assert.deepEqual(
  [...g.ambushes.cleared].sort(),
  ["archive-shape", "office-shape", "phone-shape"],
  "The route encounters and escapes all three room hazards",
);
console.log("PASS all three room ambushes escaped using fresh E taps");
assert.ok(
  g.hauntings.fired.size >= 2,
  "The playable route actually encounters the new school hauntings",
);
console.log(
  "PASS school hauntings encountered:",
  [...g.hauntings.fired].join(", "),
);
console.log(
  "PASS full playable story, original ending, no soft lock; catches:",
  g.catches,
  "preset:",
  preset,
);
// All checkpoint anchors must be valid, including automatic death recovery.
for (const [id, data] of Object.entries(STAGES)) {
  await g.story.start(id);
  assert.equal(g.story.stage, id);
  assert.equal(
    blocked(g.player.position.x, g.player.position.z, g.world.obstacles, 0.23),
    false,
    "Checkpoint " + id + " not inside collider",
  );
}
console.log("PASS all checkpoint anchors");
// Perception: walls block sight, running reaches hearing threshold, stationary crouching is quiet.
g.ended = false;
await g.story.start("survive");
g.teacher.grace = 0;
g.teacher.mesh.position.set(0, 0, -30);
g.teacher.mesh.rotation.y = Math.PI;
g.player.teleport(0, -25);
assert.equal(g.teacher.sees(), true);
g.player.teleport(-9, -20);
assert.equal(g.teacher.sees(), false);
g.player.teleport(0, -25);
g.player.noise = 1;
assert.equal(g.teacher.hears(), true);
g.player.noise = 0;
assert.equal(g.teacher.hears(), false);
g.teacher.deactivate();
console.log("PASS perception: line of sight, distance, noise, and hiding");
await g.story.start("survive");
g.player.teleport(0, -30);
g.teacher.mesh.position.set(0, 0, -30.5);
g.teacher.mesh.rotation.y = Math.PI;
g.teacher.grace = 0;
g.teacher.update(0.7);
assert.equal(
  g.catches,
  1,
  "Close visible contact invokes capture exactly once",
);
g.teacher.update(1);
assert.equal(g.catches, 1, "Capture is not emitted repeatedly");
await g.story.start(g.story.checkpoint());
assert.equal(g.story.stage, "survive");
assert.ok(g.teacher.active && g.teacher.grace > 0);
assert.equal(g.player.hidden, null);
assert.equal(
  blocked(g.player.position.x, g.player.position.z, g.world.obstacles),
  false,
);
g.teacher.deactivate();
console.log("PASS capture and checkpoint recovery");

await g.story.start("survive");
g.teacher.deactivate();
g.player.teleport(0, -16);
g.player.yaw = 0;
g.player.keys.add("KeyW");
g.player.keys.add("ShiftLeft");
for (let i = 0; i < Math.ceil(g.config.sprintCapacity * 60) + 2; i++)
  g.player.update(1 / 60);
assert.ok(
  g.player.exhausted && g.player.stamina < 0.2,
  "A continuous sprint exhausts the player",
);
g.player.keys.clear();
for (let i = 0; i < 800; i++) g.player.update(1 / 60);
assert.equal(
  g.player.stamina,
  g.config.sprintCapacity,
  "Breath recovers while still",
);
assert.equal(g.player.viewModel, undefined);
assert.equal(g.world.flash, undefined);
console.log("PASS finite sprint reserve, recovery, and no held flashlight");
g.teacher.deactivate();
g.player.teleport(-9, -19, Math.PI);
g.player.keys.add("KeyW");
for (let i = 0; i < 90; i++) g.player.update(1 / 60);
assert.ok(
  g.player.position.z < -18.6,
  "Actual classroom tabletop blocks walking",
);
assert.ok(
  g.world.obstacles
    .filter((o) => o.kind === "desk")
    .every((o) => o.enabled !== false),
);
g.player.teleport(-9, -19, Math.PI);
assert.equal(g.player.jump(), true);
g.player.keys.add("KeyW");
for (let i = 0; i < 33; i++) g.player.update(1 / 60);
g.player.keys.clear();
assert.ok(
  Math.abs(g.player.physics.feet - 0.815) < 0.01,
  "Actual jump lands on the classroom desk",
);
for (let i = 0; i < 60; i++) g.player.update(1 / 60);
assert.ok(
  Math.abs(g.player.physics.feet - 0.815) < 0.01,
  "Actual desktop support is stable",
);
g.player.teleport(0, -16);
console.log(
  "PASS solid classroom desks and real jump/landing through the Player controller",
);
assert.equal(g.world.teacher.userData.kind, "teacher");
assert.equal(g.world.teacher.userData.joints.arms.length, 2);
assert.equal(g.world.mara.userData.authored, true);
assert.ok(g.world.mara.userData.model.getObjectByName("Head"));
assert.ok(g.world.mara.userData.actions.Walk);
const teacherSize = new THREE.Box3()
  .setFromObject(g.world.teacher)
  .getSize(new THREE.Vector3());
assert.ok(
  teacherSize.y > 1.7 && teacherSize.y < 2.1,
  "Teacher retains adult human proportions",
);
assert.equal(
  g.world.teacher.scale.x,
  g.world.teacher.scale.y,
  "No stretched vertical scaling",
);
g.player.syncCamera(0);
assert.equal(g.player.viewModel, undefined);
assert.equal(g.world.interactables.some(t=>t.item==='battery'),false);
g.interactions.read("photo");
assert.equal(
  document.querySelector("#readImage").src,
  "assets/images/first-day.png",
);
assert.equal(document.querySelector("#readBody").textContent, "");
g.interactions.close();
assert.equal(
  g.world.interactables.find((t) => t.id === "photo").mesh.userData.imagePath,
  "assets/images/first-day.png",
);
console.log(
  "PASS articulated characters, readable unlit exploration, and visible photograph inspection",
);
g.story.epoch++;
g.dialogue.reset();
