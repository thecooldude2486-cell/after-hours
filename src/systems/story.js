import { MARA_LAST_CLASS_POSITION } from "../data/classroom.js";
import { applyPreset } from "../data/presets.js";
import { STAGES, BEATS, STAGE_ORDER } from "../data/beats.js";
import { TriggerSystem } from "./triggers.js";
import { Navigation, slide, blocked } from "./navigation.js";
export class StorySystem {
  constructor(game) {
    this.game = game;
    this.stage = "arrival";
    this.elapsed = 0;
    this.hiddenTime = 0;
    this.ambientTimer = 0;
    this.companion = false;
    this.nav = new Navigation(game.world.obstacles);
    this.companionPath = [];
    this.pathTimer = 0;
    this.gap = false;
    this.epoch = 0;
    this.hugTime = 0;
    this.sitTime = 0;
    const g = game;
    this.triggers = new TriggerSystem({
      dialogue: (e) =>
        g.dialogue.play(
          e.id,
          e.position ||
            {
              intercom: { x: 0, y: 3.5, z: -12 },
              hideMemory: { x: -5.1, y: 1, z: -22.8 },
              argument: { x: -9, y: 1.2, z: -20 },
              phone: { x: 12, y: 1.8, z: -41 },
              teacher: {
                x: g.player.position.x,
                y: 2.2,
                z: g.player.position.z - 3,
              },
              teacherReveal: { x: 0, y: 2.4, z: -42 },
              belief: { x: 2, y: 1.2, z: -74 },
              lastVoicemail: { x: 0.5, y: 0.05, z: 15 },
            }[e.id] ||
            null,
        ),
      objective: (e) => g.objectives.set(e.id, e.text),
      lighting: (e) => {
        for (const light of g.world.lights) {
          if (
            (e.minZ == null || light.z >= e.minZ) &&
            (e.maxZ == null || light.z <= e.maxZ)
          ) {
            if (e.multiplier != null) light.base *= e.multiplier;
            if (e.color != null) light.colorOverride = e.color;
          }
        }
        if (e.behind != null) g.player.lightsOut = e.behind;
      },
      environment: (e) => {
        g.world.env.set(e.state, e.room);
        g.audio.mode(e.state);
      },
      audio: (e) => g.audio.cue(e.name, e.position),
      wait: (e) => this.wait(e.seconds * g.config.triggerTiming),
      cinematic: async (e) => {
        const epoch = this.epoch;
        if (e.id === "teacherArrival") {
          const dir = g.camera.getWorldDirection(
            g.world.teacher.position.clone(),
          );
          g.world.teacher.position
            .copy(g.player.position)
            .addScaledVector(dir, 2.15);
          g.world.teacher.position.y = 0;
          g.world.teacher.rotation.y = g.player.yaw + Math.PI;
          g.world.teacher.visible = true;
        }
        await g.cinematics.play(e.id);
        if (epoch === this.epoch && e.id === "teacherArrival")
          g.world.teacher.visible = false;
      },
      stage: (e) => this.setStage(e.stage),
      mara: (e) => this.placeMara(e.x, e.z, e.age),
      hideMara: () => {
        g.world.mara.visible = false;
      },
      teacher: (e) => {
        if (!e.enabled) g.teacher.deactivate();
        else {
          g.teacher.activate(e.x, e.z, true);
          if (e.chase) {
            g.teacher.grace = 0.6;
            g.teacher.lastKnown = {
              x: g.player.position.x,
              z: g.player.position.z,
            };
            g.teacher.change("Chase", g.player.position);
            g.teacher.mesh.rotation.y = Math.PI;
            g.player.lightsOut = true;
          }
        }
      },
      teleport: (e) => g.player.teleport(e.x, e.z, e.yaw),
      blackout:()=>g.inventory.failPower(),
      read: (e) =>
        new Promise((resolve) => {
          g.interactions.read(e.note, resolve);
        }),
      fade: (e) => this.fade(e.seconds),
      silhouette: async (e) => {
        const epoch = this.epoch;
        g.world.teacher.visible = true;
        g.world.teacher.position.set(0, 0, -31);
        g.audio.cue("teacherStep", { x: 0, z: -30 });
        await this.wait(e.seconds);
        if (epoch === this.epoch) g.world.teacher.visible = false;
      },
      door: (e) => {
        const d = g.world.doors.find((d) => d.id === e.id);
        g.world.openDoor(d, e.open);
      },
      sunrise: () => this.sunrise(),
      embrace: () => {
        this.hugTime = 3;
        g.audio.cue("memory");
        g.world.mara.position.set(
          g.player.position.x - Math.sin(g.player.yaw) * 0.65,
          0,
          g.player.position.z - Math.cos(g.player.yaw) * 0.65,
        );
      },
      companionGap: async () => {
        const epoch = this.epoch;
        this.gap = true;
        this.companion = false;
        g.world.mara.position.set(19.3, 0, -34.8);
        g.world.mara.scale.setScalar(0.92);
        await this.wait(2.5);
        if (epoch !== this.epoch) return;
        g.world.mara.position.set(17.5, 0, -32.8);
        g.world.mara.scale.setScalar(1);
        this.gap = false;
        this.companion = true;
      },
      sit: () => {
        g.player.teleport(-9, -16.5, -0.5);
        g.player.position.y = 1.15;
        this.sitTime = 2;
      },
      exterior: async () => {
        const epoch = this.epoch;
        await this.fade(1.2);
        if (epoch !== this.epoch) return;
        g.world.env.set("ruined", "school", true);
        g.world.mara.visible = false;
        this.companion = false;
        g.player.teleport(0, 18, 0);
        this.sunrise();
        g.world.openDoor(g.world.front, true);
        g.audio.cue("door", { x: 0, z: 12 });
        await g.cinematics.play("lastBell");
      },
      end: () => {
        g.finish();
      },
    });
  }
  async wait(seconds) {
    const epoch = this.epoch;
    let time = 0;
    return new Promise((resolve) => {
      const handle = setInterval(() => {
        if (epoch !== this.epoch) {
          clearInterval(handle);
          resolve();
          return;
        }
        if (!this.game.paused && !this.game.interactions.reader) time += 0.05;
        if (time >= seconds) {
          clearInterval(handle);
          resolve();
        }
      }, 50);
    });
  }
  async fade(seconds) {
    const overlay = document.querySelector("#transition");
    overlay.style.transition = `opacity ${seconds * 0.4}s`;
    overlay.style.opacity = "1";
    await this.wait(seconds);
    overlay.style.opacity = "0";
  }
  placeMara(x, z, age = 17) {
    const m = this.game.world.mara;
    m.visible = true;
    m.position.set(x, 0, z);
    m.scale.setScalar(age === 9 ? 0.72 : 1);
    if (m.userData.head) m.userData.head.scale.setScalar(age === 9 ? 1.12 : 1);
    const p = this.game.player.position;
    m.rotation.y = Math.atan2(-(p.x - x), -(p.z - z));
  }
  sunrise() {
    const g = this.game;
    g.world.exterior.color.setHex(0xffdab0);
    g.world.exterior.intensity = 2.3;
    g.world.env.set("ruined");
    g.world.env.ambient.intensity = 0.9;
    g.world.openDoor(g.world.front, true);
  }
  setStage(stage, save = true) {
    if (!STAGES[stage]) throw new Error("Unknown story stage " + stage);
    this.stage = stage;
    if(stage==='fault')this.blackoutAnchor=[this.game.player.position.x,this.game.player.position.z,this.game.player.yaw];
    this.elapsed = 0;
    this.hiddenTime = 0;
    this.safeTime = 0;
    const data = STAGES[stage],
      g = this.game;
    document.querySelector("#chapterNo").textContent = String(
      data.chapter,
    ).padStart(2, "0");
    document.querySelector("#chapterName").textContent =
      data.name.toUpperCase();
    g.objectives.set(stage, data.objective);
    this.companion = Boolean(data.companion);
    const index = STAGE_ORDER.indexOf(stage);
    for (const t of g.world.interactables) {
      if (["seat", "leave", "clock", "lastPhone"].includes(t.id))
        t.enabled =
          {
            seat: "seat",
            leave: "leave",
            clock: "afternoon",
            lastPhone: "lastPhone",
          }[t.id] === stage;
      if (t.id === "lastPhone")
        t.mesh.visible = stage === "lastPhone" || stage === "end";
      const revealAt = {
        fault: "fault",
        vale: "vale",
        waiting: "waiting",
        family: "phone",
        headmaster_file: "headmaster",
        ash_register: "emptyClass",
      }[t.id];
      if (revealAt) {
        t.enabled = index >= STAGE_ORDER.indexOf(revealAt);
        t.mesh.visible = t.enabled;
      }
    }
    g.audio.maraAge = index >= STAGE_ORDER.indexOf("phone") ? 17 : 9;
    g.player.boundary = stage === "walkaway" ? -47 : null;
    if (stage === "survive") {
      g.player.stamina = g.config.sprintCapacity;
      g.player.exhausted = false;
      g.teacher.activate(0, -38);
      g.player.lightsOut = true;
    }
    if (stage === "vale") {
      g.player.stamina = g.config.sprintCapacity;
      g.player.exhausted = false;
      g.world.openDoor(g.world.escapeDoor, false);
    }
    if (stage === "phone") {
      g.teacher.deactivate();
      g.player.lightsOut = false;
    }
    if (stage === "outside" || stage === "return") {
      this.companion = false;
      this.placeMara(0, 10, 17);
    }
    if (stage === "lastClass") {
      g.world.mara.visible = true;
      this.companion = true;
    }
    if (stage === "reunion" || stage === "embrace") this.placeMara(0, -70, 17);
    if (stage === "seat" || stage === "leave")
      g.world.memoryFigures.forEach((m) => (m.visible = false));
    if (save) this.save();
    this.refreshObjective();
  }
  save() {
    try {
      localStorage.setItem(
        "after-hours-save",
        JSON.stringify({
          version: 2,
          storyRevision: 30,
          blackoutAnchor:this.blackoutAnchor,
          stage: this.stage,
          inventory: this.game.inventory?.snapshot(),
          resources: this.game.resources?.snapshot(),
          ambushes: this.game.ambushes?.snapshot(),
          hauntings: this.game.hauntings?.snapshot(),
          echoes: this.game.echoes?.snapshot(),
          preset: this.game.config.preset,
        }),
      );
    } catch {}
  }
  refreshObjective() {
    const g = this.game,
      inv = g.inventory;
    if (!inv) return;
    const text = {
      locker: inv.has("lockerKey")
        ? "Unlock Mara’s locker · Locker 17."
        : "Search reception lockers for Locker 17’s key. Then find Mara’s locker.",
      drawing: inv.has("classroomKey")
        ? "Unlock Classroom 04. Find Mara’s drawing."
        : "Search office drawers for Classroom 04’s key.",
      cassette:
        "Find Classroom 08’s key in the classroom drawers. Play the cassette.",
      survive:
        "Break sight, hide, then unlock Classroom 08 with the key from Classroom 04.",
      fault: inv.power
        ? "Read the corrected fire record beside the fuse box."
        : !inv.has('flashlight') ? "The lights are out. Search the emergency equipment locker in reception."
        : !inv.has('fuse') ? "Reach maintenance through Classroom 08’s warped side door. Search the lockers for a fuse."
        : "Install the replacement fuse in the maintenance fuse box.",
      vale: inv.has("recordsKey")
        ? "Unlock Mrs. Vale’s staff record in the archive."
        : "Escape through Classroom 08. Find the staff cabinet key in its drawers.",
      waiting: inv.has("cutters")
        ? inv.has('diaryKey') ? "Cut a gym padlock. Open Mara’s final journal page." : "Mara’s notebook has a tiny clasp. Her pencil tin is in Classroom 04."
        : "Search the archive drawers for bolt cutters. Cut the gym padlock.",
      headmaster: inv.has('headmasterKey')
        ? "Find the headmaster’s sealed file in the office. His broken bell sits by the entrance."
        : "Find the headmaster’s seal case in the staff archive. His file is in the office.",
      emptyClass: "Compare the recovered attendance roll with the register in Classroom 08.",
    }[this.stage];
    if (text) g.objectives.set(this.stage, text);
  }
  async start(stage = "arrival", options = {}) {
    this.epoch++;
    this.game.cinematics.cancel();
    this.game.hauntings?.cancel();
    this.game.environmentSounds?.reset();
    this.triggers.reset();
    this.game.dialogue.reset();
    this.game.audio.stopEffects?.();
    this.game.teacher.deactivate();
    this.game.echoes?.reset();
    this.game.player.leaveHide();
    this.game.interactions.reader = false;
    this.game.interactions.hold = null;
    document.querySelector("#reader").classList.add("hidden");
    document.querySelector("#hud").classList.remove("reading");
    const g = this.game,
      d = STAGES[stage] || STAGES.arrival;
    stage = STAGES[stage] ? stage : "arrival";
    if (g.inventory) {
      let saved;
      try {
        saved = JSON.parse(localStorage.getItem("after-hours-save"));
      } catch {}
      const exact =
        !options.fresh &&
        !options.jump &&
        saved?.version === 2 &&
        saved.stage === stage;
      if (exact && saved.preset && saved.preset !== g.config.preset) {
        if (g.configurePreset) g.configurePreset(saved.preset);
        else applyPreset(g.config, saved.preset);
      }
      g.ambushes?.reset(exact ? saved.ambushes : {});
      g.hauntings?.reset(exact ? saved.hauntings : {});
      g.echoes?.reset(exact ? saved.echoes : {});
      g.inventory.reset();
      g.inventory.restore(exact ? saved.inventory : {});
      if (!exact) g.inventory.hydrateStage(stage);
      if(exact&&saved.storyRevision!==30){
        const at=STAGE_ORDER.indexOf(stage);
        if(at>=STAGE_ORDER.indexOf('waiting'))g.inventory.items.add('diaryKey');
        if(at>=STAGE_ORDER.indexOf('emptyClass'))g.inventory.items.add('attendanceRoll');
        if(at>=STAGE_ORDER.indexOf('vale')){g.inventory.items.add('flashlight');g.inventory.flashlightOn=true;}
        g.inventory.draw();
      }
      if(stage==='fault')this.blackoutAnchor=exact&&saved.blackoutAnchor?.length===3?saved.blackoutAnchor:null;
      g.resources.restore(exact ? saved.resources : {}, Boolean(options.retry));
      g.player.stamina = g.config.sprintCapacity;
      g.player.exhausted = false;
      const locker = g.world.interactables.find((t) => t.id === "bracelet");
      locker.open = g.inventory.unlocked.has("bracelet");
      if (locker.hinge)
        locker.hinge.rotation.y = locker.open ? locker.openAngle : 0;
      for (const drawer of g.world.interactables.filter(
        (t) => t.type === "drawer",
      )) {
        drawer.mesh.position.x = drawer.position.x;
        drawer.open = false;
      }
    }
    const anchor=stage==='fault'&&this.blackoutAnchor?this.blackoutAnchor:d.position;
    g.player.teleport(anchor[0],anchor[1],anchor[2]||0);
    g.world.env.set(d.state, "school", true);
    g.audio.mode(d.state);
    if (stage === "reunion" || stage === "embrace")
      g.world.env.set("memory", "gym", true);
    g.world.mara.visible = false;
    g.player.lightsOut = false;
    g.world.openDoor(
      g.world.front,
      STAGE_ORDER.indexOf(stage) <= STAGE_ORDER.indexOf("locker") ||
        STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf("outside"),
    );
    g.world.openDoor(
      g.world.latch,
      STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf("entrance"),
    );
    g.world.openDoor(
      g.world.escapeDoor,
      STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf("waiting"),
    );
    g.world.exterior.color.setHex(0x9fb9d9);
    g.world.exterior.intensity = 0.9;
    this.gap = false;
    this.hugTime = 0;
    this.sitTime = 0;
    this.companionPath = [];
    this.setStage(stage);
    if (d.teacher && stage !== "survive") {
      g.teacher.activate(17.5, -57.5);
      g.teacher.mesh.rotation.y = Math.PI;
      g.teacher.change("Chase", g.player.position);
      g.teacher.lastKnown = { x: g.player.position.x, z: g.player.position.z };
      g.player.lightsOut = true;
    }
    if (d.companion)
      this.placeMara(g.player.position.x + 1, g.player.position.z + 2, 17);
    if (d.child)
      this.placeMara(
        stage === "walkaway" ? 0 : MARA_LAST_CLASS_POSITION[0],
        stage === "walkaway" ? -55 : MARA_LAST_CLASS_POSITION[1],
        9,
      );
    if (["outside", "return", "lastPhone", "end"].includes(stage))
      this.sunrise();
    if (stage === "arrival") this.signal("start");
    if (stage === "end") g.finish();
  }
  signal(type, target = null) {
    if (this.triggers.busy) return false;
    const beat = BEATS.find(
      (b) =>
        b.stage === this.stage &&
        !this.triggers.fired.has(b.id) &&
        this.triggers.matches(b, { type, target }, this),
    );
    if (!beat) return false;
    this.triggers.run(beat, this).catch((err) => this.game.fail(err));
    return true;
  }
  label(t) {
    if(t.type==='lockerDoor')return t.locker.manualOpen?'Close locker':'Open locker';
    if(t.type==='door' && t.door.motorTarget != null)return t.door.motorTarget ? 'Door opening' : 'Door closing';
    if (t.type === "secretDoor" && t.unlatched && !t.open) return "Heavy panel";
    if (t.type === "door" && t.door?.pushable && t.door.unlatched)
      return t.door.open ? (t.door.requires ? "Close door" : "Door") : "Open door";
    if (t.id === "mara") {
      if (this.stage === "embrace") return "Embrace Mara";
      if (this.stage === "return") return "Go back to her";
      if (this.stage === "reunion") return "Speak to Mara";
      return "Mara";
    }
    if (t.id === "latch")
      return this.stage === "escortLatch"
        ? "Let Mara reach the latch"
        : this.game.world.latch.open
          ? "Maintenance door"
          : "Locked maintenance door";
    if (t.id === "exit")
      return this.game.world.front.open
        ? "Front entrance"
        : "The front doors won’t open";
    if (t.type === "grounding" && this.game.resources?.restAt === t.id)
      return "Recovering sanity / stay still in the light";
    if (t.type === "container" && t.fixed)
      return (t.open ? "Close " : "Open ") + t.title;
    if (t.type === "container" && t.title)
      return (t.open ? "Close " : "Search ") + t.title;
    if (t.type === "container")
      return (t.open ? "Close " : "Search ") + t.kind + " " + (t.index + 1);
    return t.label;
  }
  update(dt, time) {
    const g = this.game,
      p = g.player,
      w = g.world;
    this.refreshObjective();
    this.elapsed += dt;
    this.ambientTimer += dt;
    this.hugTime = Math.max(0, this.hugTime - dt);
    this.sitTime = Math.max(0, this.sitTime - dt);
    if (this.stage === "survive") {
      if (p.hidden) this.hiddenTime += dt;
      else this.hiddenTime = 0;
      const inRoom =
        p.position.x > 6 &&
        p.position.x < 14 &&
        p.position.z < -33 &&
        p.position.z > -44;
      const clear =
        !g.config.enemy ||
        g.cheats?.freezeTeacher ||
        g.cheats?.invincible ||
        (!g.teacher.sees() &&
          g.teacher.state !== "Chase" &&
          g.teacher.distance(p.position) > 9);
      this.safeTime = inRoom && clear ? this.safeTime + dt : 0;
      if (this.safeTime > 3.5) this.signal("safe");
    }
    if (this.stage === "walkaway") {
      p.boundary = Math.max(p.boundary, p.position.z - 1.35);
      const calls = [
        ["firstCall", -39],
        ["secondCall", -27],
        ["lastCall", -17],
      ];
      const pending = calls.find(
        ([id, z]) => p.position.z > z && !this.triggers.fired.has(id),
      );
      if (pending) this.signal("location", pending[0]);
      else if (p.position.z > -8 && this.triggers.fired.has("lastCall"))
        this.signal("location", "entranceMemory");
      // An optical stretch amplifies the long real corridor without separating visuals from collision.
      g.camera.fov =
        68 + Math.min(1, Math.max(0, (p.position.z + 46) / 38)) * 14;
      g.camera.updateProjectionMatrix();
    } else if (g.camera.fov !== 68) {
      g.camera.fov = 68;
      g.camera.updateProjectionMatrix();
    }
    if (
      this.stage === "entrance" &&
      p.position.z > 8.5 &&
      Math.abs(p.position.x) < 5
    )
      this.signal("location", "front");
    if (this.stage === "outside" && p.position.z > 14)
      this.signal("location", "outside");
    if (
      this.stage === "lastClass" &&
      p.position.x < -4 &&
      p.position.z < -14 &&
      p.position.z > -25
    )
      this.signal("location", "classroom");
    if (this.stage === "phone" && this.ambientTimer > 4) {
      g.audio.cue("phone", { x: 12, z: -41 });
      this.ambientTimer = 0;
    } else if (this.ambientTimer > 14) {
      this.ambientTimer = 0;
      if (!g.dialogue.current) {
        if (["fault", "vale", "entrance", "lastClass"].includes(this.stage))
          g.audio.cue("collapse", { x: 18, z: p.position.z - 8 });
        else if (["locker", "drawing", "cassette"].includes(this.stage))
          g.audio.cue("chalk", { x: -9, z: -20 });
        else g.audio.cue("thunder", { x: -14, z: p.position.z });
      }
    }
    if (this.companion && w.mara.visible && !this.gap) {
      this.pathTimer -= dt;
      const dist = Math.hypot(
        p.position.x - w.mara.position.x,
        p.position.z - w.mara.position.z,
      );
      if (dist > 2.1) {
        if (this.pathTimer <= 0) {
          this.companionPath = this.nav.path(w.mara.position, p.position);
          this.pathTimer = 0.8;
        }
        const next = this.companionPath[0];
        if (next) {
          const dx = next.x - w.mara.position.x,
            dz = next.z - w.mara.position.z,
            d = Math.hypot(dx, dz);
          if (d < 0.3) this.companionPath.shift();
          else {
            slide(
              w.mara.position,
              (dx / d) * dt * 3.15,
              (dz / d) * dt * 3.15,
              w.obstacles,
              0.22,
            );
            w.mara.rotation.y = Math.atan2(-dx, -dz);
          }
        }
      } else {
        const dx = p.position.x - w.mara.position.x,
          dz = p.position.z - w.mara.position.z;
        w.mara.rotation.y = Math.atan2(-dx, -dz);
      }
    }
    if (this.hugTime > 0)
      document.querySelector("#film").style.background =
        "radial-gradient(ellipse,transparent 15%,#b69e5822 70%,#0009)";
    else document.querySelector("#film").style.background = "";
    document.querySelector("#damage").style.opacity =
      g.teacher.state === "Chase" && g.teacher.active ? ".8" : "0";
    document
      .querySelector("#film")
      .classList[
        (p.hidden && p.hidden.spot.id.startsWith("hideHall")) ||
        (p.hidden && p.hidden.spot.id === "hideEast")
          ? "add"
          : "remove"
      ]("hiding");
    document.querySelector("#status").textContent = p.pushingDoor
      ? p.stamina > 0 ? "PUSHING · STAMINA DRAINING" : "EXHAUSTED · STOP PUSHING TO CATCH YOUR BREATH"
      : p.hidden
      ? g.teacher.witnessedHide
        ? "SHE SAW YOU · MOVE"
        : "HIDDEN · LISTEN BEFORE LEAVING"
      : p.crouched
        ? "CROUCHING"
        : "";
    const breath = document.querySelector("#breath");
    breath.style.setProperty?.(
      "--reserve",
      String(p.stamina / g.config.sprintCapacity),
    );
    breath.classList[
      p.stamina < g.config.sprintCapacity - 0.2 ? "remove" : "add"
    ]("hidden");
    breath.classList[p.exhausted ? "add" : "remove"]("empty");
  }
  checkpoint() {
    let stage = this.stage;
    try {
      const s = JSON.parse(localStorage.getItem("after-hours-save"));
      if ([1, 2].includes(s?.version) && STAGES[s.stage]) stage = s.stage;
    } catch {}
    return stage === "end" ? "arrival" : stage;
  }
}
