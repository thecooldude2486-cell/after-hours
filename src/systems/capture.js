import * as THREE from "../../vendor/three.module.js";
import { faceTarget } from "../world/scare-motion.js";
const $ = (s) => document.querySelector(s);

/** Capture cancels the active story, shows failure, then restores the encounter on explicit retry. */
export class CaptureSystem {
  constructor(game) {
    this.game = game;
  }
  async catchPlayer(reason = "caught", attacker = null) {
    const g = this.game;
    // Story disables Teacher captures only; room monsters retain their own lethal rules.
    if (g.cheats?.invincible || (!g.config.enemy && reason !== "ambush")) {
      g.teacher.caught = false;
      return;
    }
    if (g.recovering) return;
    g.recovering = true;
    g.attempts++;
    g.retryStage = g.story.stage;
    g.story.epoch++;
    g.story.triggers.reset();
    g.dialogue.reset();
    g.teacher.active = false;
    g.player.keys.clear();
    g.player.leaveHide();
    g.player.syncCamera(0);
    $("#film").classList.remove("hiding");
    const dir = g.camera.getWorldDirection(new THREE.Vector3());
    dir.y = 0;
    dir.normalize();
    const actor = attacker || g.world.teacher;
    g.world.teacher.visible = false;
    actor.visible = true;
    actor.position
      .copy(g.player.position)
      .addScaledVector(dir, attacker ? 0.86 : 1.15);
    actor.position.y = 0;
    actor.rotation.y = g.player.yaw + Math.PI;
    actor.userData.scareAmount = 0;
    actor.position.y += g.camera.position.y - faceTarget(actor, 1.73).y;
    await g.cinematics.play(attacker ? "ambushCapture" : "capture");
    actor.visible = false;
    $("#deathCount").textContent = `ATTEMPT ${g.attempts} / CHECKPOINT SAVED`;
    $("#deathTip").textContent = {
      ambush:
        "Room shapes appear without warning and drain sanity while holding you. Release and tap E repeatedly before the escape time runs out. Holding the key does not count. Escaped rooms stay cleared at the checkpoint.",
      witnessed:
        "She saw you enter. Break line of sight before hiding; leave if she starts checking the door.",
      exhausted:
        "You ran out of breath. Sprint between cover, then stop to recover. Save a burst for the warped door.",
      caught:
        g.retryStage === "vale"
          ? "Force the warped door into Classroom 08. Turn behind the desks to break sight before heading for the staff records."
          : "Listen to her footsteps. Crouch out of view, let her pass, then cross to Classroom 08. A lit torch makes you easier to see.",
    }[reason];
    $("#death").classList.remove("hidden");
    document.exitPointerLock?.();
  }
  async retry() {
    const g = this.game;
    if (!g.recovering || g.cinematics.active) return;
    $("#death").classList.add("hidden");
    $("#transition").style.opacity = "0";
    g.paused = false;
    $("#pause").classList.add("hidden");
    await g.story.start(g.retryStage || g.story.checkpoint(), { retry: true });
    g.recovering = false;
    g.audio.resume();
    g.requestLock();
  }
}
