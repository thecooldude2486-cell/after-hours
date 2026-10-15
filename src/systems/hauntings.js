import { DistantFigure } from "../world/distant-figure.js";
import * as THREE from "../../vendor/three.module.js";
import {
  HAUNTINGS,
  HAUNTING_REVISION,
  EXPLORATION_STAGES,
  APPARITION_TUNING,
} from "../data/hauntings.js";
import {
  createRoomMonster,
  animateRoomMonster,
} from "../world/room-monster.js";
import { scareFeedback, clearScareFeedback } from "./scare-effects.js";
import { scareDirection } from "./ambushes.js";
import { faceTarget } from "../world/scare-motion.js";
import { lineClear } from "./navigation.js";
import { schoolArtTexture } from "../world/school-art.js";
/** One pooled actor and a screen overlay. Exploration continues during these nonlethal scares. */
export class HauntingSystem {
  constructor(game) {
    this.game = game;
    this.fired = new Set();
    this.announced = new Set();
    this.active = null;
    this.cooldown = 0;
    this.actor = createRoomMonster("phone");
    this.actor.name = "Pooled room rush actor";
    game.world.scene.add(this.actor);
    this.distant = new DistantFigure(game.world.scene);
    game.world.apparition = this.distant;
    this.light = new THREE.PointLight(0xc5cdbd, 0, 5, 2);
    game.world.scene.add(this.light);
    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.38),
      new THREE.MeshBasicMaterial({
        map: schoolArtTexture("window"),
        transparent: true,
        opacity: 1,
      }),
    );
    this.screen.position.set(5, 1.48, -20.645);
    this.screen.visible = false;
    game.world.scene.add(this.screen);
  }
  snapshot() {
    return { revision: HAUNTING_REVISION, fired: [...this.fired] };
  }
  rememberSeen() {
    const a = this.active;
    if (
      a?.event.type === "apparition" &&
      a.observed >= (a.event.minVisible ?? 1.1) &&
      !this.fired.has(a.event.id)
    ) {
      this.fired.add(a.event.id);
      this.game.story.save?.();
    }
  }
  reset(save = {}) {
    this.cancel();
    this.announced.clear();
    this.fired = new Set(
      save.revision === HAUNTING_REVISION ? save.fired || [] : [],
    );
    this.cooldown = 0;
  }
  cancel() {
    this.rememberSeen();
    if (this.active?.event.type === "apparition")
      this.game.audio.stopSfx?.("apparitionArrival");
    if (this.active && this.active.event.type !== "apparition")
      clearScareFeedback(this.game, this.light);
    if (this.active?.fovBase !== undefined) {
      this.game.camera.fov = this.game.config.cameraFov ?? this.active.fovBase;
      this.game.camera.updateProjectionMatrix();
    }
    this.active = null;
    this.actor.visible = false;
    this.distant.hide();
    this.actor.userData.scareAmount = 0;
    this.screen.visible = false;
    this.light.intensity = 0;
  }
  eligible() {
    const g = this.game;
    return (
      g.started !== false &&
      !g.ended &&
      !g.recovering &&
      !g.interactions.reader &&
      !g.dialogue.current &&
      !g.story.triggers.busy &&
      !g.cinematics.active &&
      !g.ambushes?.active &&
      !g.player.hidden &&
      !g.story.companion &&
      !(g.teacher.active && g.config.enemy && !g.cheats?.freezeTeacher) &&
      EXPLORATION_STAGES.includes(g.story.stage)
    );
  }
  roomState(event) {
    const e = this.game.world.env;
    return e.roomStates?.get(event.room || "school") || e.state;
  }
  visibleAt(event) {
    const g = this.game,
      point =
        event.type === "apparition"
          ? this.distant.sightPoint(event)
          : new THREE.Vector3(event.at[0], 1.8, event.at[1]),
      delta = point.clone().sub(g.camera.position);
    const distance = delta.length();
    if (event.type === "apparition") {
      const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        event.peekYaw || 0,
      );
      if (normal.dot(g.camera.position.clone().sub(point).normalize()) <= 0.06)
        return false;
    }
    if (
      !distance ||
      g.camera.getWorldDirection(new THREE.Vector3()).dot(delta.normalize()) <
        0.72 ||
      !lineClear(g.camera.position, point, g.world.obstacles || [])
    )
      return false;
    // Open doors stop blocking movement, but their animated leaves can still obscure a face.
    const occluders = [
      ...(g.world.obstacles || []).map((o) => o.mesh),
      ...(g.world.doors || []).map((d) => d.leaf),
    ].filter((m) => m?.visible);
    for (const mesh of occluders) mesh.updateWorldMatrix(true, false);
    const ray = new THREE.Raycaster(
      g.camera.position,
      delta,
      0,
      Math.max(0, distance - 0.2),
    );
    return ray.intersectObjects(occluders, false).length === 0;
  }
  start(event) {
    const g = this.game;
    this.active = { event, elapsed: 0, fading: 0, observed: 0 };
    if (event.type === "apparition") {
      this.actor.position.set(event.at[0], 0, event.at[1]);
      this.distant.setPeek(event, this.actor);
      if (!this.announced.has(event.id)) {
        g.audio.cue("apparitionArrival", this.distant.mesh.position);
        this.announced.add(event.id);
      }
      this.light.intensity = 0;
    } else {
      this.fired.add(event.id);
      g.story.save?.();
      this.active.fovBase = g.camera.fov;
      g.audio.cue(
        event.cue,
        event.origin
          ? { x: event.origin[0], y: event.origin[1], z: event.origin[2] }
          : undefined,
      );
      if (event.type === "screen") this.screen.visible = true;
      if (event.type === "rush") {
        this.actor.visible = true;
        this.actor.scale.setScalar(1);
        this.active.direction = scareDirection(
          g.camera,
          g.player.position,
          {
            bounds: [
              event.at[0] - 2,
              event.at[0] + 2,
              event.at[1] - 2,
              event.at[1] + 2,
            ],
          },
          g.world.obstacles || [],
        );
      }
    }
  }
  facePlayer() {
    const g = this.game;
    this.actor.rotation.y = Math.atan2(
      -(g.player.position.x - this.actor.position.x),
      -(g.player.position.z - this.actor.position.z),
    );
  }
  update(dt, time) {
    const g = this.game;
    if (g.paused) return;
    if (!this.eligible()) {
      this.cancel();
      return;
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (
      this.active &&
      ["normal", "memory"].includes(this.roomState(this.active.event))
    ) {
      this.cancel();
      return;
    }
    if (!this.active && !this.cooldown) {
      const event = HAUNTINGS.find((e) => {
        if (
          (e.type === "screen" && g.world.crt && !g.world.crt.open) ||
          this.fired.has(e.id) ||
          !e.stages.includes(g.story.stage) ||
          ["normal", "memory"].includes(this.roomState(e))
        )
          return false;
        if (e.door) {
          const door = g.world.doors?.find((d) => d.id === e.door);
          if (!door?.open || Math.abs(door.angle) < 1) return false;
        }
        const d = Math.hypot(
          g.player.position.x - e.at[0],
          g.player.position.z - e.at[1],
        );
        return e.type === "apparition"
          ? d <= e.revealRange && d > e.vanishRange + 0.8 && this.visibleAt(e)
          : d < e.radius;
      });
      if (event) this.start(event);
    }
    const a = this.active;
    if (!a) return;
    a.elapsed += dt;
    const e = a.event;
    if (e.type === "apparition") {
      const d = Math.hypot(
        g.player.position.x - e.at[0],
        g.player.position.z - e.at[1],
      );
      const visible = this.visibleAt(e);
      if (visible && !a.fading) a.observed += dt;
      a.unseen = visible ? 0 : (a.unseen || 0) + dt;
      const witnessed = a.observed >= (e.minVisible ?? 1.1);
      if (!witnessed && a.unseen > 1.25) {
        this.cancel();
        this.cooldown = 0.5;
        return;
      }
      if (
        d <= e.vanishRange ||
        a.elapsed >= e.duration ||
        a.observed >= (e.maxGaze ?? APPARITION_TUNING.maxGaze) ||
        (witnessed && !visible && a.observed >= 1.5)
      ) {
        if (!a.fading) {
          a.fading = 0.001;
          g.audio.cue(e.cue, this.distant.mesh.position);
        }
        a.fading += dt;
        this.distant.retreat(
          Math.min(1, a.fading / APPARITION_TUNING.retreatSeconds),
        );
      }
      // Do not let an unseen figure obstruct another apparition indefinitely.
      this.distant.update(
        g.camera,
        0.95 * (1 - Math.min(1, a.fading / APPARITION_TUNING.retreatSeconds)),
        time,
      );
      if (a.fading > APPARITION_TUNING.retreatSeconds) {
        this.cancel();
        this.cooldown = witnessed ? 3 : 1;
      }
      return;
    }
    if (e.type === "rush") {
      this.actor.position
        .copy(g.player.position)
        .addScaledVector(
          a.direction,
          1.5 - Math.sin((Math.min(1, a.elapsed / 0.25) * Math.PI) / 2) * 0.68,
        );
      this.actor.position.y = 0;
      this.facePlayer();
      this.actor.userData.scareAmount = Math.sin(
        Math.min(1, a.elapsed / e.duration) * Math.PI,
      );
      animateRoomMonster(this.actor, dt, time);
      const head = faceTarget(this.actor, 1.65);
      this.actor.position.y += g.camera.position.y - head.y;
    }
    if (e.type === "screen")
      this.screen.material.opacity =
        a.elapsed < 0.65 ? 1 : Math.max(0, (e.duration - a.elapsed) / 0.25);
    scareFeedback(g, this.light, a.elapsed, {
      power: e.type === "rattle" ? 0.55 : 0.85,
      fovBase: a.fovBase,
    });
    if (a.elapsed >= e.duration) {
      this.cancel();
      this.cooldown = 4;
    }
  }
}
