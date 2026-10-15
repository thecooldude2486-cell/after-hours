import { scareFeedback, clearScareFeedback } from "./scare-effects.js";
import { animateRoomMonster } from "../world/room-monster.js";
import { animateTeacher } from "../world/teacher-model.js";
import { faceTarget } from "../world/scare-motion.js";
import * as THREE from "../../vendor/three.module.js";
import { CINEMATICS } from "../data/cinematics.js";

/** Owns the camera while a short shot plays. Cancel resolves pending sequencing before a retry. */
export class CinematicSystem {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.revealLight = new THREE.PointLight(0xe2dcc9, 0, 4, 2);
    game.world.scene?.add(this.revealLight);
  }
  play(id) {
    this.cancel();
    const data = CINEMATICS[id];
    if (!data) return Promise.resolve();
    const g = this.game,
      camera = g.camera;
    g.player.keys.clear();
    document.querySelector("#cinematic").classList.remove("hidden");
    document.querySelector("#hud").classList.add("cinematic-mode");
    document.querySelector("#prompt").textContent = "";
    document.querySelector("#cinematicHint").textContent = [
      "capture",
      "ambushCapture",
    ].includes(id)
      ? ""
      : "SPACE / CONTINUE";
    if (data.cue) g.audio.cue(data.cue);
    return new Promise((resolve) => {
      this.active = {
        id,
        data,
        elapsed: 0,
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        resolve,
        fov: camera.fov,
        actor: data.scare ? g.world[data.target] : null,
        actorPosition: data.scare
          ? g.world[data.target]?.position.clone()
          : null,
      };
    });
  }
  update(dt) {
    const shot = this.active;
    if (!shot) return;
    const g = this.game,
      { data } = shot;
    shot.elapsed += dt;
    const t = Math.min(1, shot.elapsed / data.duration);
    const ease = t * t * (3 - 2 * t);
    if (shot.actor && shot.actorPosition) {
      const dir = shot.actorPosition.clone().sub(shot.position);
      dir.y = 0;
      dir.normalize();
      const windup = Math.min(1, shot.elapsed / 0.14),
        attack = THREE.MathUtils.smoothstep(shot.elapsed, 0.12, 0.32);
      const recoil = Math.exp(-Math.max(0, shot.elapsed - 0.32) * 5);
      const distance =
        data.target === "teacher"
          ? shot.id === "teacherArrival"
            ? 0.65
            : 0.62
          : 0.28;
      shot.actor.position
        .copy(shot.actorPosition)
        .addScaledVector(dir, 0.08 * windup - distance * attack);
      shot.actor.userData.scareAmount = attack * (0.65 + 0.35 * recoil);
      if (data.target === "teacher" && shot.actor.userData.authored) {
        animateTeacher(shot.actor, dt, g.time || shot.elapsed);
        const eye = faceTarget(shot.actor, 1.73);
        shot.actor.position.y +=
          (shot.position.y - eye.y) * Math.min(1, dt * 18);
      }
      if (
        data.target === "monster" &&
        (shot.actor.userData.authored || shot.actor.userData.procedural)
      )
        animateRoomMonster(shot.actor, dt, g.time || shot.elapsed);
    }
    const aim = g.camera.clone();
    aim.position.copy(shot.position);
    let target;
    if (["teacher", "mara", "monster"].includes(data.target)) {
      const actor = g.world[data.target];
      target = faceTarget(
        actor,
        data.target === "teacher"
          ? 2.1
          : data.target === "monster"
            ? g.camera.position.y
            : 1.48,
      );
    } else if (data.target === "front") target = new THREE.Vector3(0, 2.15, 12);
    if (target) aim.lookAt(target);
    else {
      aim.quaternion.copy(shot.quaternion);
      aim.rotateY(data.yaw || 0);
      aim.rotateX(data.pitch || 0);
    }
    g.camera.position.copy(shot.position);
    g.camera.position.y += (data.lift || 0) * ease;
    g.camera.quaternion
      .copy(shot.quaternion)
      .slerp(aim.quaternion, Math.min(1, ease * 2.5));
    const shake = g.config?.cameraShake ?? 0.7;
    if (data.shake) {
      g.camera.position.x +=
        Math.sin(shot.elapsed * 61) * data.shake * shake * (1 - t);
      g.camera.position.y +=
        Math.sin(shot.elapsed * 79) * data.shake * shake * (1 - t);
    }
    g.camera.fov = THREE.MathUtils.lerp(shot.fov, data.fov, ease);
    g.camera.updateProjectionMatrix();
    g.player.syncFlashlight?.();
    if (data.scare)
      scareFeedback(g, this.revealLight, shot.elapsed, {
        power: 1.2,
        fovBase: g.camera.fov,
      });
    if (shot.elapsed >= data.duration) this.cancel();
  }
  skip() {
    if (
      this.active &&
      this.active.elapsed > 0.45 &&
      !["capture", "ambushCapture"].includes(this.active.id)
    )
      this.cancel();
  }
  cancel() {
    const shot = this.active;
    this.active = null;
    clearScareFeedback(this.game, this.revealLight);
    document.querySelector("#cinematic").classList.add("hidden");
    document.querySelector("#hud").classList.remove("cinematic-mode");
    document.querySelector("#scareFlash").style.opacity = "0";
    if (!shot) return;
    if (shot.actor) {
      shot.actor.userData.scareAmount = 0;
      if (shot.actorPosition) shot.actor.position.copy(shot.actorPosition);
    }
    this.game.camera.fov = this.game.config?.cameraFov || shot.fov;
    this.game.camera.updateProjectionMatrix();
    this.game.player.syncCamera(0);
    shot.resolve();
  }
}
