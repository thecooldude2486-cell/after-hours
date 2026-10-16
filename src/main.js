import { EnvironmentSoundSystem } from "./systems/environment-sounds.js";
import {EchoSystem} from "./systems/echoes.js";
import {FlashlightSystem} from './systems/flashlight.js';
import {loadHandSurface} from './world/viewmodel.js';
import { SchoolRenderer } from "./systems/rendering.js";
import { AtmosphereSystem } from "./systems/atmosphere.js";
import { loadHorrorMaterials } from "./world/horror-detail.js";
import { loadSchoolArt } from "./world/school-art.js";
import * as THREE from "../vendor/three.module.js";
import { loadConfig, DEFAULTS, TUNING } from "./data/config.js";
import { loadMaraModel } from "./world/mara.js";
import { InventorySystem } from "./systems/inventory.js";
import { ResourceSystem } from "./systems/resources.js";
import { CheatSystem } from "./systems/cheats.js";
import { PRESETS, applyPreset } from "./data/presets.js";
import { STAGES } from "./data/beats.js";
import { createSchool } from "./world/school.js";
import { Player } from "./systems/player.js";
import { AudioSystem } from "./systems/audio.js";
import { DialogueSystem } from "./systems/dialogue.js";
import { InteractionSystem } from "./systems/interaction.js";
import { TeacherAI } from "./systems/teacher.js";
import { StorySystem } from "./systems/story.js";
import { ObjectiveSystem } from "./systems/objectives.js";
import { CinematicSystem } from "./systems/cinematics.js";
import { SettingsSystem } from "./systems/settings.js";
import { HauntingSystem } from "./systems/hauntings.js";
import { AmbushSystem } from "./systems/ambushes.js";
import { CaptureSystem } from "./systems/capture.js";
const $ = (s) => document.querySelector(s);
class Game {
  constructor() {
    this.config = loadConfig();
    this.configurePreset(this.config.preset || "normal");
    this.started = false;
    this.paused = false;
    this.ended = false;
    this.recovering = false;
    this.attempts = 0;
    this.time = 0;
    this.renderer = new THREE.WebGLRenderer({
      canvas: $("#game"),
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.config.pixelRatio),
    );
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.presentation = new SchoolRenderer(this.renderer, this.config);
    this.camera = new THREE.PerspectiveCamera(
      68,
      innerWidth / innerHeight,
      0.06,
      90,
    );
    this.world = createSchool(this.renderer, this.config);
    this.audio = new AudioSystem(this.config);
    this.player = new Player(this.camera, this.world, this.audio, this.config);
    this.dialogue = new DialogueSystem(this.audio, this.config);
    this.interactions = new InteractionSystem(this);
    this.teacher = new TeacherAI(
      this.world,
      this.player,
      this.audio,
      this.config,
      (reason) => this.catchPlayer(reason),
    );
    this.objectives = new ObjectiveSystem($("#objective"));
    this.cinematics = new CinematicSystem(this);
    this.capture = new CaptureSystem(this);
    this.story = new StorySystem(this);
    this.cheats = new CheatSystem(this);
    this.inventory = new InventorySystem(this);
    this.resources = new ResourceSystem(this);
    this.ambushes = new AmbushSystem(this);
    this.hauntings = new HauntingSystem(this);
    this.settings = new SettingsSystem(this);
    this.atmosphere = new AtmosphereSystem(this);
    this.environmentSounds = new EnvironmentSoundSystem(this);
    this.echoes = new EchoSystem(this);
    this.flashlight=new FlashlightSystem(this);
    this.player.canLook = () =>
      this.started &&
      !this.paused &&
      !this.ended &&
      !this.interactions.reader &&
      !this.recovering &&
      !this.cinematics.active &&
      !this.ambushes.blocking;
    this.player.teleport(0.4, 8, -0.08);
    this.bindUI();
    this.clock = new THREE.Clock();
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
    window.addEventListener("resize", () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }
  bindUI() {
    $("#preset").value = this.config.preset;
    $("#preset").onchange = () => {
      $("#presetHint").textContent =
        PRESETS[$("#preset").value].hint +
        " Each preset has a different item layout.";
    };
    $("#preset").onchange();
    $("#cheatsButton").onclick = () => this.openCheats();
    $("#closeCheats").onclick = () => this.resume();
    for (const [flag, label] of Object.entries({
      invincible: "Cannot be caught",
      infiniteStamina: "Infinite stamina",
      infiniteSanity: "Infinite sanity",
      freezeTeacher: "Freeze The Teacher",
      disableMonsters: "Disable room ambushes",
      allKeys: "Use any key or tool",
    })) {
      const row = document.createElement("label");
      row.className = "option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "cheat_" + flag;
      input.onchange = () => {
        this.cheats[flag] = input.checked;
        this.drawCheats();
      };
      row.append(input, document.createTextNode(label));
      $("#cheatFlags").append(row);
    }
    for (const [id, data] of Object.entries(STAGES)) {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = data.name;
      $("#cheatStage").append(option);
    }
    $("#resetMonsters").onclick = () => {
      this.cheats.disableMonsters = false;
      this.ambushes.rearm();
      this.drawCheats();
    };
    $("#resetHauntings").onclick = () => {
      this.hauntings.reset();
      this.story.save();
    };
    $("#peekDemo").onclick = async () => {
      await this.story.start("locker", { jump: true });
      this.hauntings.reset();
      this.player.teleport(0, -6);
      this.player.yaw = Math.atan2(2.79, 12.06);
      this.player.pitch = 0;
      this.player.syncCamera(0);
      this.resume();
    };
    $("#giveItems").onclick = () => this.cheats.grantItems();
    $("#unlockAll").onclick = () => {
      this.cheats.unlockAll();
      this.drawCheats();
    };
    $("#refill").onclick = () => this.cheats.refill();
    $("#teleportButton").onclick = () =>
      this.cheats.teleport($("#teleport").value);
    $("#jumpStage").onclick = () => {
      this.story.start($("#cheatStage").value, { jump: true });
      this.resume();
    };
    $("#begin").onclick = () => this.begin(false);
    $("#continue").onclick = () => this.begin(true);
    $("#resume").onclick = () => this.resume();
    $("#retry").onclick = () => this.retry();
    $("#restartCheckpoint").onclick = () => {
      this.resume();
      this.story.start(this.story.checkpoint(), { retry: true });
    };
    $("#again").onclick = () => {
      try {
        localStorage.removeItem("after-hours-save");
      } catch {}
      this.ended = false;
      $("#ending").classList.add("hidden");
      this.begin(false);
    };
    document.querySelectorAll("[data-digit]").forEach(button => {
      button.onclick = () => this.interactions.pressDigit(button.dataset.digit);
    });
    $("#closeReader").onclick = () => this.interactions.close();
    $("#voiceToggle").onchange = (e) => {
      this.audio.voice = e.target.checked;
      if (!this.audio.voice) this.audio.stopLine();
      this.config.spokenDialogue = this.audio.voice;
      this.settings.save();
    };
    $("#volume").oninput = (e) => {
      this.config.audioVolume = Number(e.target.value);
      this.settings.save();
    };
    $("#tuningButton").onclick = () => {
      this.drawTuning();
      $("#pause").classList.add("hidden");
      $("#tuning").classList.remove("hidden");
    };
    $("#closeTuning").onclick = () => {
      $("#tuning").classList.add("hidden");
      $("#pause").classList.remove("hidden");
      this.saveTuning();
    };
    $("#resetTuning").onclick = () => {
      Object.assign(this.config, DEFAULTS);
      applyPreset(this.config, this.config.preset);
      this.settings.apply();
      this.drawTuning();
      this.saveTuning();
    };
    try {
      if (STAGES[JSON.parse(localStorage.getItem("after-hours-save"))?.stage])
        $("#continue").classList.remove("hidden");
    } catch {}
    document.addEventListener("keydown", (e) => {
      if (!$("#settings").classList.contains("hidden") && e.code === "Escape") {
        this.settings.close();
        return;
      }
      if (!this.started || this.ended) return;
      if (e.code === "F2" && !this.recovering) {
        e.preventDefault();
        if (!$("#cheats").classList.contains("hidden")) this.resume();
        else this.openCheats();
        return;
      }
      if (e.code === "Escape") {
        if (!$("#settings").classList.contains("hidden")) {
          this.settings.close();
          return;
        }
        if (this.recovering) return;
        if (this.interactions.reader) {
          this.interactions.close();
          return;
        }
        if (!$("#tuning").classList.contains("hidden")) {
          $("#closeTuning").click();
          return;
        }
        if (this.paused) this.resume();
        else this.pause();
        return;
      }
      if (this.recovering) {
        if (e.code === "KeyR" && !this.cinematics.active) this.retry();
        return;
      }
      if (this.paused) return;
      if (this.ambushes.blocking) {
        this.ambushes.tap(e);
        return;
      }
      if (this.interactions.keypadTarget && !this.paused) {
        if (e.code === "KeyE" && !e.repeat) this.interactions.close();
        if (/^Digit[0-9]$/.test(e.code) || /^Numpad[0-9]$/.test(e.code)) { e.preventDefault(); if(!e.repeat)this.interactions.pressDigit(e.code.slice(-1)); }
        if (e.code === "Backspace") { e.preventDefault();this.interactions.pressDigit("clear"); }
        if (e.code === "Enter") { e.preventDefault();if(!e.repeat)this.interactions.pressDigit("enter"); }
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyJ" && !this.paused && !this.cinematics.active && !this.ambushes.blocking) {
        this.interactions.openJournal();return;
      }
      if (this.cinematics.active) {
        if (e.code === "Space") this.cinematics.skip();
        return;
      }
      if (e.code === "Tab") {
        e.preventDefault();
        $("#inventory").classList.toggle("hidden");
      }
      if (e.code === "KeyH" && !this.interactions.reader)
        this.inventory.useGroundingKit();
      if(e.code==='KeyF'&&!this.interactions.reader)this.flashlight.toggle();
      if (e.code === "KeyE") this.interactions.use();
      if (
        e.code === "Space" &&
        !this.interactions.reader &&
        this.story.sitTime <= 0
      )
        this.player.jump();
      if (e.code === "KeyQ" && !this.interactions.reader) this.dialogue.skip();
    });
    document.addEventListener("pointerlockchange", () => {
      if (
        !document.pointerLockElement &&
        this.started &&
        !this.paused &&
        !this.ended &&
        !this.interactions.reader &&
        !this.recovering &&
        !this.dragFallback
      )
        this.pause();
    });
    window.addEventListener("blur", () => {
      if (
        this.started &&
        !this.ended &&
        !this.interactions.reader &&
        !this.recovering
      )
        this.pause();
    });
    $("#game").addEventListener("click", () => {
      if (this.started && !this.paused && !this.interactions.reader)
        this.requestLock();
    });
  }
  configurePreset(id) {
    applyPreset(this.config, id);
    try {
      const tuning = JSON.parse(localStorage.getItem("after-hours-tuning"));
      if (tuning?.revision === 4 && tuning.preset === id)
        for (const [key, [min, max]] of Object.entries(TUNING))
          if (Number.isFinite(tuning[key]))
            this.config[key] = Math.max(min, Math.min(max, tuning[key]));
    } catch {}
    this.settings?.apply();
  }
  saveTuning() {
    this.config.revision = 4;
    try {
      localStorage.setItem("after-hours-tuning", JSON.stringify(this.config));
    } catch {}
  }
  drawTuning() {
    const fields = $("#tuningFields");
    fields.replaceChildren();
    for (const [key, [min, max, label]] of Object.entries(TUNING)) {
      const row = document.createElement("label");
      row.textContent = label;
      const input = document.createElement("input");
      Object.assign(input, {
        type: "number",
        min,
        max,
        step: 0.05,
        value: this.config[key],
      });
      input.oninput = () => {
        const n = Number(input.value);
        if (Number.isFinite(n))
          this.config[key] = Math.max(min, Math.min(max, n));
      };
      row.append(input);
      fields.append(row);
    }
  }
  async requestLock() {
    if (new URLSearchParams(location.search).has("test")) return;
    try {
      await $("#game").requestPointerLock();
      this.dragFallback = false;
    } catch {
      this.dragFallback = true;
      $("#pauseDetail").textContent =
        "Pointer lock is unavailable. Hold the mouse button and drag to look, or use arrow keys.";
    }
  }
  async begin(restore) {
    $("#title").classList.add("hidden");
    $("#hud").classList.remove("hidden");
    $("#hud").classList.remove("menu-covered");
    $("#pause").classList.add("hidden");
    this.started = true;
    this.paused = false;
    this.ended = false;
    this.recovering = false;
    this.attempts = 0;
    if (!restore) {
      this.configurePreset($("#preset").value);
      this.cheats = new CheatSystem(this);
      this.drawCheats();
    }
    await this.audio.start();
    this.requestLock();
    this.story.start(restore ? this.story.checkpoint() : "arrival", {
      fresh: !restore,
    });
  }
  drawCheats() {
    const rooms = [
      ["office-shape", "Office"],
      ["phone-shape", "Classroom 08"],
      ["archive-shape", "Archive"],
    ];
    $("#monsterStatus").textContent = rooms
      .map(
        ([id, label]) =>
          label + ": " + (this.ambushes.cleared.has(id) ? "escaped" : "ready"),
      )
      .join(" · ");
    for (const flag of [
      "invincible",
      "infiniteStamina",
      "infiniteSanity",
      "freezeTeacher",
      "disableMonsters",
      "allKeys",
    ])
      $("#cheat_" + flag).checked = this.cheats[flag];
    $("#cheatIndicator").classList[
      Object.values(this.cheats).some((v) => v === true) ? "remove" : "add"
    ]("hidden");
  }
  openCheats() {
    this.pause();
    $("#pause").classList.add("hidden");
    $("#cheats").classList.remove("hidden");
    $("#cheatStage").value = this.story.stage;
    this.drawCheats();
  }
  pause() {
    this.paused = true;
    this.player.keys.clear();
    $("#hud").classList.add("menu-covered");
    $("#pause").classList.remove("hidden");
    document.exitPointerLock?.();
    this.audio.suspend();
  }
  resume() {
    this.paused = false;
    $("#hud").classList.remove("menu-covered");
    $("#pause").classList.add("hidden");
    $("#tuning").classList.add("hidden");
    $("#cheats").classList.add("hidden");
    $("#settings").classList.add("hidden");
    this.audio.resume();
    this.requestLock();
  }
  catchPlayer(reason, attacker = null) {
    this.hauntings.cancel();
    return this.capture.catchPlayer(reason, attacker);
  }
  retry() {
    return this.capture.retry();
  }
  finish(ending = "story") {
    const secret=ending === "secret";
    $("#endingEyebrow").textContent=secret ? "THE SEALED WING · ALTERNATE ENDING" : "ONE NEW VOICEMAIL";
    $("#endingStory").textContent=secret
      ? "You step out with Mrs. Vale’s last record. The hidden rooms were a rescue route. She left every tool for someone to follow, then went back for Mara. The school’s doors are open. Her promise is still waiting inside."
      : "Some people don’t haunt places because they died there. They haunt them because they were waiting for someone to come back.";
    $("#endingDetail").textContent=secret ? "Escaped with the truth · Return to the beginning to follow Mara’s story." : "End of playable prototype · Eli & Mara’s story";
    this.ended = true;
    this.teacher.deactivate();
    this.ambushes.reset();
    this.hauntings.reset();
    this.audio.stopLine();
    $("#hud").classList.add("hidden");
    $("#ending").classList.remove("hidden");
    document.exitPointerLock?.();
  }
  fail(error) {
    console.error(error);
    $("#errorText").textContent =
      error.message +
      " — Run with “npm start” in a desktop browser with WebGL enabled.";
    $("#error").classList.remove("hidden");
    this.paused = true;
  }
  tick() {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.06);
    this.time += dt;
    const live =
      this.started &&
      !this.paused &&
      !this.ended &&
      !this.interactions.reader &&
      !this.recovering;
    if (live) {
      this.player.update(
        dt,
        this.story.sitTime <= 0 &&
          !this.cinematics.active &&
          !this.ambushes.blocking,
      );
      this.audio.update(this.player);
      this.atmosphere.update();
      this.environmentSounds.update(dt);
      this.dialogue.update(dt);
      if (
        !this.cinematics.active &&
        !this.ambushes.blocking &&
        this.config.enemy &&
        !this.cheats.freezeTeacher
      )
        this.teacher.update(dt);
      this.resources.update(dt);
      if (!this.ambushes.blocking) this.story.update(dt, this.time);
      this.ambushes.update(dt, this.time);
      this.hauntings.update(dt, this.time);
      if (!this.cinematics.active && !this.ambushes.blocking)
        this.interactions.update(dt);
    } else if (!this.started) {
      this.camera.position.set(0.4, 1.68, 8);
      this.camera.rotation.set(0, -0.08 + Math.sin(this.time * 0.05) * 0.04, 0);
    }
    this.echoes.update(live?dt:0,this.time);
    if (!this.paused) this.cinematics.update(dt);
    const speaker = this.dialogue.current?.line?.speaker || "";
    this.world.mara.userData.speaking =
      live && speaker.includes("MARA") && this.audio.isSpeaking;
    this.world.teacher.userData.speaking =
      live && speaker.includes("TEACHER") && this.audio.isSpeaking;
    this.world.env.update(dt, this.time);
    this.world.update(dt, this.time, this.player);
    this.flashlight.update(live?dt:0,this.time);
    this.presentation.render(this.world, this.camera, this.time);
    $("#film").classList.toggle(
      "friendly",
      ["normal", "memory"].includes(this.world.env.state),
    );
  }
}
try {
  $("#begin").disabled = true;
  await Promise.all([
    loadMaraModel(),
    loadSchoolArt(),
    loadHorrorMaterials(),
    loadHandSurface(),
  ]);
  $("#begin").disabled = false;
  const game = new Game();
  // Explicit test mode exposes inspection/teleport tools for automated playthroughs, never in normal play.
  if (new URLSearchParams(location.search).has("test"))
    window.__test = {
      game,
      snapshot: () => ({
        stage: game.story.stage,
        busy: game.story.triggers.busy,
        position: game.player.position.toArray(),
        teacher: game.teacher.state,
        teacherActive: game.teacher.active,
        hidden: Boolean(game.player.hidden),
        environment: game.world.env.state,
        reader: game.interactions.reader,
        objective: $("#objective").textContent,
        ended: game.ended,
      }),
      use: (id) =>
        game.interactions.use(
          game.world.interactables.find((t) => t.id === id),
        ),
      teleport: (x, z, yaw = 0) => game.player.teleport(x, z, yaw),
      signal: (type, target) => game.story.signal(type, target),
      close: () => game.interactions.close(),
      start: (stage) => game.story.start(stage),
      accelerate: () => {
        game.config.dialogueTiming = 0.035;
        game.config.triggerTiming = 0.025;
        game.config.transitionDuration = 0.1;
      },
    };
} catch (e) {
  console.error(e);
  $("#errorText").textContent =
    e.message +
    " — This prototype needs a desktop browser with WebGL. Start its local server with npm start.";
  $("#error").classList.remove("hidden");
}
