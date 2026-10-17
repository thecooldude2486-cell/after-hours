import { scareFeedback, clearScareFeedback } from "./scare-effects.js";
import { animateRoomMonster } from "../world/room-monster.js";
import { animateTeacher } from "../world/teacher-model.js";
import { faceTarget } from "../world/scare-motion.js";
import * as THREE from "../../vendor/three.module.js";
import {createYoungEli,animateYoungEli} from "../world/young-eli.js";
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
    const pending=new Promise((resolve) => {
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
    if(data.conversation){
      const shot=this.active,m=g.world.mara;
      if(!this.youngEli){this.youngEli=createYoungEli();g.world.scene.add(this.youngEli);}
      shot.maraState={position:m.position.clone(),rotation:m.rotation.clone(),scale:m.scale.clone(),visible:m.visible};
      shot.memoryFigures=(g.world.memoryFigures||[]).map(actor=>[actor,actor.visible]);
      shot.memoryFigures.forEach(([actor])=>{actor.visible=false;actor.userData.conversationHidden=true;});
      m.position.set(-13.25,0,-17.25);m.scale.setScalar(.72);m.rotation.set(0,0,0);m.visible=true;
      this.youngEli.position.set(-13.25,0,-19.1);this.youngEli.rotation.y=Math.PI;this.youngEli.visible=true;
      document.querySelector('#cinematicHint').textContent='SPACE / NEXT LINE';
      void g.dialogue.play(data.dialogue).then(()=>{if(this.active===shot)this.cancel();});
    }
    return pending;
  }
  update(dt) {
    const shot = this.active;
    if (!shot) return;
    const g = this.game,
      { data } = shot;
    shot.elapsed += dt;
    if(data.conversation){
      const speaker=g.dialogue.current?.line?.speaker||'',talking=Boolean(g.dialogue.current?.line?.text)&&(g.dialogue.current.time||0)<(g.dialogue.current.line.speechDuration||g.dialogue.current.line.duration||4);
      const eli=speaker.includes('ELI'),m=g.world.mara;
      m.userData.speaking=!eli&&talking;m.userData.conversation=true;
      animateYoungEli(this.youngEli,g.time||shot.elapsed,eli&&talking);
      const distance=2.7/Math.min(1,g.camera.aspect/1.35),bias=eli?-.20:.20;
      const target=new THREE.Vector3(-13.25,1.02,-18.175+bias);
      const position=new THREE.Vector3(-13.25+distance,1.32,-18.175+Math.sin(shot.elapsed*.17)*.05);
      g.camera.position.copy(position);g.camera.lookAt(target);g.camera.fov=data.fov;g.camera.updateProjectionMatrix();
      // Move only the film camera. The player's exploration position remains intact.
      return;
    }
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
    const aim = g.camera.clone(false);
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
    if (data.scare)
      scareFeedback(g, this.revealLight, shot.elapsed, {
        power: 1.2,
        fovBase: g.camera.fov,
      });
    if (shot.elapsed >= data.duration) this.cancel();
  }
  skip() {
    if(this.active?.data.conversation){this.game.dialogue.skip();return;}
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
    if(shot.data.conversation){
      this.youngEli.visible=false;
      const m=this.game.world.mara,state=shot.maraState;
      m.position.copy(state.position);m.rotation.copy(state.rotation);m.scale.copy(state.scale);m.visible=state.visible;
      m.userData.speaking=false;m.userData.conversation=false;
      shot.memoryFigures.forEach(([actor,visible])=>{actor.visible=visible;delete actor.userData.conversationHidden;});
      this.game.dialogue.reset();
    }
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
