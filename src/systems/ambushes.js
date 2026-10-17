import {createShadowFigure,animateShadow} from "../world/shadow-figure.js";
import { lineClear } from "./navigation.js";
import { faceTarget } from "../world/scare-motion.js";
import { scareFeedback, clearScareFeedback } from "./scare-effects.js";
import * as THREE from "../../vendor/three.module.js";
import {
  ROOM_AMBUSHES,
  STRUGGLE_PRESETS,
  AMBUSH_REVISION,
} from "../data/ambushes.js";
import {
  createRoomMonster,
  animateRoomMonster,
} from "../world/room-monster.js";
const inside = (p, b) => p.x > b[0] && p.x < b[1] && p.z > b[2] && p.z < b[3];
// Keep a grab visible when the player enters facing a wall or cabinet.
export function scareDirection(camera, position, room, obstacles = []) {
  const forward = camera.getWorldDirection(new THREE.Vector3());
  forward.y = 0;
  forward.normalize();
  const center = new THREE.Vector3(
    (room.bounds[0] + room.bounds[1]) / 2 - position.x,
    0,
    (room.bounds[2] + room.bounds[3]) / 2 - position.z,
  ).normalize();
  const candidates = [
    forward,
    center,
    ...[0.7, -0.7, 1.5, -1.5, Math.PI].map((angle) =>
      forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle),
    ),
  ];
  return (
    candidates.find((dir) =>
      lineClear(
        camera.position,
        camera.position.clone().addScaledVector(dir, 1),
        obstacles,
      ),
    ) || center
  );
}
/** Immediate room grab -> struggle -> escape or death. Runs only during unpaused exploration. */
export class AmbushSystem {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.cleared = new Set();
    this.cooldown = 0;
    this.monsters = new Map(
      ROOM_AMBUSHES.map((room) => {
        const model = createRoomMonster(room.variant);
        model.name = room.id;
        game.world.scene.add(model);
        return [room.id, model];
      }),
    );
    this.shadow=createShadowFigure("grab");
    game.world.grabShadow=this.shadow;
    game.world.scene.add(this.shadow);
    this.monster = this.monsters.values().next().value;
    game.world.monster = this.monster;
    this.light = new THREE.PointLight(0xccb398, 0, 4, 2);
    game.world.scene.add(this.light);
    this.ui = document.querySelector("#ambush");
  }
  get blocking() {
    return this.active?.phase === "struggle";
  }
  snapshot() {
    return { revision: AMBUSH_REVISION, cleared: [...this.cleared] };
  }
  reset(save = {}) {
    this.shadow.visible=false;
    this.stopVoice();
    this.active = null;
    this.cleared = new Set(
      save.revision === AMBUSH_REVISION ? save.cleared || [] : [],
    );
    this.cooldown = 0;
    for (const model of this.monsters.values()) {
      model.visible = false;
      model.userData.scareAmount = 0;
    }
    clearScareFeedback(this.game, this.light);
    this.ui.classList.add("hidden");
    document.querySelector("#scareFlash").style.opacity = "0";
  }
  stopVoice() {
    for (const room of ROOM_AMBUSHES)
      this.game.audio.stopSfx?.(room.variant + "Monster");
  }
  rearm() {
    this.reset();
    this.game.story.save?.();
  }
  tap(event) {
    const a = this.active;
    if (!this.blocking || event.code !== "KeyE") return false;
    event.preventDefault?.();
    if (event.repeat) {
      a.holding = true;
      this.draw();
      return true;
    }
    if (a.elapsed - a.lastTap < 0.07) return true;
    a.holding = false;
    a.lastTap = a.elapsed;
    a.taps++;
    this.game.audio.cue("struggle");
    this.draw();
    if (
      a.taps >= a.rules.taps &&
      a.elapsed >= (this.game.config.monsterRevealDuration ?? 0.75)
    )
      this.escape();
    return true;
  }
  update(dt, time) {
    const g = this.game;
    if (g.paused || g.recovering || g.ended || g.interactions.reader) return;
    if (g.cheats?.disableMonsters) {
      if (this.active) this.escape();
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.active) {
      if (
        this.cooldown ||
        g.cinematics.active ||
        g.story.triggers.busy ||
        g.dialogue.current ||
        (g.teacher.active && g.config.enemy && !g.cheats?.freezeTeacher) ||
        g.player.hidden
      )
        return;
      const room = ROOM_AMBUSHES.find(
        (r) =>
          !this.cleared.has(r.id) &&
          r.stages.includes(g.story.stage) &&
          inside(g.player.position, r.bounds) &&
          !["normal", "memory"].includes(
            g.world.env?.roomStates?.get(r.room) || g.world.env?.state,
          ),
      );
      if (!room) return;
      this.monster = this.monsters.get(room.id);
      g.world.monster = this.monster;
      this.active = {
        room,
        phase: "struggle",
        elapsed: 0,
        taps: 0,
        lastTap: -1,
        holding: false,
        direction: scareDirection(
          g.camera,
          g.player.position,
          room,
          g.world.obstacles || [],
        ),
        rules: STRUGGLE_PRESETS[g.config.preset] || STRUGGLE_PRESETS.normal,
      };
      g.player.keys.clear();
      g.interactions.hold = null;
      g.audio.stopLine();
      if (!g.cheats?.infiniteSanity)
        g.player.sanity = Math.max(0, g.player.sanity - 14);
      g.audio.cue(room.variant + "Monster");
      this.monster.visible = true;
      this.ui.classList.remove("hidden");
    }
    const a = this.active;
    a.elapsed += dt;
    if (!g.cheats?.infiniteSanity)
      g.player.sanity = Math.max(
        0,
        g.player.sanity - dt * g.config.monsterSanityDrain,
      );
    if (
      a.taps >= a.rules.taps &&
      a.elapsed >= (g.config.monsterRevealDuration ?? 0.75)
    ) {
      this.escape();
      return;
    }
    const dir = a.direction;
    const lunge =
      0.83 -
      Math.min(1, a.elapsed / 0.23) * 0.28 +
      (a.taps / a.rules.taps) * 0.13;
    this.monster.position.copy(g.player.position).addScaledVector(dir, lunge);
    this.monster.position.y = g.camera.position.y - 1.73;
    this.monster.rotation.y = g.player.yaw + Math.PI;
    this.monster.userData.scareAmount =
      Math.min(1, a.elapsed / 0.22) * (1 - (a.taps / a.rules.taps) * 0.6);
    animateRoomMonster(this.monster, dt, a.elapsed);
    const focus = faceTarget(this.monster, g.camera.position.y);
    this.monster.position.y += g.camera.position.y - focus.y;
    focus.y = g.camera.position.y;
    g.camera.lookAt(focus);
    scareFeedback(g, this.light, a.elapsed, {
      sustained: true,
      fovBase: g.config.cameraFov ?? 68,
    });
    // A brief faceless impact gives way to the readable struggle and its escape prompt.
    this.shadow.visible=a.elapsed<.28;
    this.monster.visible=!this.shadow.visible;
    if(this.shadow.visible){
      this.shadow.position.copy(this.monster.position);this.shadow.position.y=g.camera.position.y-1.72;
      this.shadow.rotation.set(-.12,this.monster.rotation.y,Math.sin(a.elapsed*43)*.09);
      this.shadow.scale.set(1.4,1.1,1);animateShadow(this.shadow,time,1);
    }
    this.draw();
    if (a.elapsed >= a.rules.seconds * g.config.struggleWindow) {
      if (!a.rules.lethal || g.cheats?.invincible) this.escape();
      else {
        const actor = this.monster;
        this.stopVoice();
        this.active = null;
        this.ui.classList.add("hidden");
        clearScareFeedback(this.game, this.light);
        void g.catchPlayer("ambush", actor);
      }
    }
  }
  escape() {
    if (!this.active) return;
    this.shadow.visible=false;
    this.cleared.add(this.active.room.id);
    this.stopVoice();
    this.active = null;
    this.cooldown = 2;
    for (const model of this.monsters.values()) {
      model.visible = false;
      model.userData.scareAmount = 0;
    }
    clearScareFeedback(this.game, this.light);
    this.ui.classList.add("hidden");
    document.querySelector("#scareFlash").style.opacity = "0";
    this.game.player.keys.clear();
    this.game.audio.cue("escape");
    this.game.story.save?.();
  }
  draw() {
    const a = this.active;
    if (!a) return;
    const text = (selector, value) => {
      const element = document.querySelector(selector);
      if (element.textContent !== value) element.textContent = value;
    };
    const remaining = Math.max(0,
      a.rules.seconds * this.game.config.struggleWindow - a.elapsed);
    const urgent = remaining < a.rules.seconds * this.game.config.struggleWindow * 0.35;
    for (const [name, enabled] of [
      ["pressed", !a.holding && a.elapsed - a.lastTap < 0.1],
      ["urgent", urgent],
    ]) this.ui.classList[enabled ? "add" : "remove"](name);
    text("#ambushTitle", "IT'S GOT YOU");
    text("#ambushInstruction", "SPAM E TO BREAK FREE");
    text("#ambushHelp", a.holding
      ? "RELEASE E, THEN KEEP TAPPING!"
      : "Press, release, repeat. Don't hold.");
    text("#struggleProgress", `${Math.min(a.taps, a.rules.taps)} / ${a.rules.taps} PRESSES`);
    document.querySelector("#struggleFill").style.width =
      Math.min(100, (a.taps / a.rules.taps) * 100) + "%";
    text("#struggleTime", remaining.toFixed(1) + "s LEFT");
  }
}
