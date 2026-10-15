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

await g.story.start("survive",{jump:true});g.inventory.items.add('staffKey');
const door=g.world.doors.find(d=>d.id==='classroomGate');
const {updatePushDoor}=await import('../src/world/push-doors.js');
door.pushable=door.unlatched=true;door.amount=.8;door.swing=1;updatePushDoor(door);
await use("hideDesk_classroom",-6.4,-16.6);
for(let i=0;i<600;i++)step();
await until(()=>g.teacher.mesh.position.z>-12&&g.teacher.state==='Patrol','northbound patrol',6000);
g.player.leaveHide();g.player.flashlight=false;
await walk(-1.3,-17,'crouch');
await use('phoneGate',1.5,-36.5);
await use('phoneGate');
await walk(10,-42,'sprint');
await stage('phone');assert.equal(g.catches,0);console.log('PASS new push-door chase route');
