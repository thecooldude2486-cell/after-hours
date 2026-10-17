import {CLUES} from "../data/clues.js";
import {MARA_PAGES} from "../data/echoes.js";
import { SCHOOL_ART } from "../world/school-art.js";
import * as THREE from "../../vendor/three.module.js";
import { lineClear } from "./navigation.js";
import { ITEMS } from "../data/items.js";
import { NOTES } from "../data/notes.js";
export class InteractionSystem {
  constructor(game) {
    this.game = game;
    this.focus = null;
    this.reader = false;
    this.readCallback = null;
    this.readOpened = 0;
    this.hold = null;
    this.ray = new THREE.Raycaster();
    this.prompt = document.querySelector("#prompt");
  }
  update(dt = 1 / 60) {
    const { player, world, camera, config } = this.game;
    this.game.inventory?.syncStorage();
    if (this.reader) {
      this.prompt.textContent = "";
      return;
    }
    if (player.hidden) {
      this.prompt.textContent = "E  /  Leave hiding place";
      this.focus = null;
      return;
    }
    let best = null,
      score = Infinity;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    for (const t of world.interactables) {
      if (t.enabled === false || !t.mesh.visible) continue;
      if (t.id === "mara") {
        t.position.copy(world.mara.position);
        t.position.y += 1.3;
      }
      const delta = t.position.clone().sub(camera.position),
        distance = delta.length();
      if (distance > config.interactionDistance) continue;
      const angle = direction.dot(delta.normalize());
      if (angle < (t.type === "pickup" ? 0.94 : t.type === "note" ? 0.9 : 0.76))
        continue;
      const o = t.mesh.userData.obstacle;
      const walls = world.obstacles.filter(
        (v) =>
          v !== o &&
          v !== t.door?.obstacle &&
          !(
            t.position.x >= v.minX &&
            t.position.x <= v.maxX &&
            t.position.z >= v.minZ &&
            t.position.z <= v.maxZ
          ),
      );
      if (!lineClear(player.position, t.position, walls)) continue;
      this.ray.set(camera.position, direction);
      const hit = this.ray
        .intersectObject(t.mesh, true)
        .some((h) => h.distance <= config.interactionDistance);
      // Small keys/tools can have a hole under the reticle. A precise aim still selects them over the open drawer face.
      const s =
        distance +
        (1 - angle) * 5 -
        (hit ? 5 : 0) -
        (t.type === "pickup" && angle > 0.985 ? 6 : 0);
      if (s < score) {
        score = s;
        best = t;
      }
    }
    this.focus = best;
    if (this.hold) {
      const h = this.hold;
      if (best !== h.target || !player.keys.has("KeyE")) this.hold = null;
      else {
        h.elapsed += dt;
        this.prompt.textContent = `HOLD E / FORCE DOOR ${Math.min(100, Math.round((h.elapsed / 1.35) * 100))}%`;
        if (h.elapsed >= 1.35) {
          world.releaseDoor(h.target.door, player.position);
          this.game.story.save?.();
          this.game.audio.cue("door", h.target.position);
          this.hold = null;
        }
        return;
      }
    }
    this.prompt.textContent = best
      ? "E  /  " + this.game.story.label(best)
      : "";
  }
  async use(target = this.focus) {
    const g = this.game;
    if (g.ambushes?.blocking || g.recovering) return;
    if (this.reader) {
      if (performance.now() - this.readOpened > 300) this.close();
      return;
    }
    if (g.player.hidden) {
      g.player.leaveHide();
      return;
    }
    if (!target || target.enabled === false || !target.mesh.visible) return;
    if(target.type==='lockerDoor'){
      const l=target.locker;g.flashlight?.reachDoor(l,'open');l.playing=false;l.manualOpen=!l.manualOpen;
      if(l.manualOpen)g.inventory.opened.add(target.id);else g.inventory.opened.delete(target.id);
      g.audio.cue(l.manualOpen?'doorOpen':'doorClose',target.position);g.story.save?.();return;
    }
    if(target.type==='schoolBell'){
      if(!g.inventory.check(target))return;
      g.echoes?.ringBell();return;
    }
    if(target.type==='evidence'){
      if(!this.canRead()||!g.inventory.check(target))return;
      if(target.reward){
        g.inventory.items.add(target.reward);
        g.inventory.draw();
        target.open=true;
      }
      g.inventory.discover(target);g.audio.cue('paper',target.position);
      this.read(target.note,()=>g.story.signal('interact',target.id));return;
    }
    if (target.type === "container") {
      if (target.crtLocked) { this.notify("THE DESK LATCH IS WIRED TO THE MONITOR"); g.audio.cue("locked",target.position); return; }
      if (!g.inventory.check(target)) return;
      g.flashlight?.reachDoor(target,"open");
      g.inventory.toggleStorage(target);
      return;
    }
    if (target.type === "clue") {
      if (!this.canRead()) return;
      g.inventory.discover(target);
      this.read(target.note);
      return;
    }
    if (target.type === "valve") {
      if(target.open)return;
      if(!g.inventory.has("valveWheel")){this.notify("VALVE WHEEL MISSING");return;}
      g.inventory.items.delete("valveWheel");g.inventory.opened.add(target.id);
      g.world.annex.sync(g.inventory.opened);g.audio.cue("switch",target.position);g.inventory.draw();g.story.save?.();return;
    }
    if (target.type === "projector") {
      if (!this.canRead()) return;
      if (!g.inventory.has("crank")) { this.notify("MISSING CRANK"); return; }
      if (!g.inventory.power) { this.notify("NO POWER"); return; }
      g.inventory.opened.add(target.id);
      target.projected.visible = true;
      target.screen.visible = false;
      const slide = {id:"clue_slide",note:{type:"PROJECTED EVACUATION SLIDE",...CLUES.clue_slide}};
      g.inventory.discover(slide);
      g.audio.cue("switch", target.position);
      this.read(slide.note);
      return;
    }
    if (target.type === "secretExit") {
      if (!g.inventory.notes.has("clue_truth")) { this.notify("EVACUATION RECORD MISSING"); return; }
      if (!g.inventory.check(target)) return;
      g.world.releaseDoor(target,g.player.position);
      g.story.save?.();
      return;
    }
    if (target.type === "secretDoor") {
      if (target.code && !g.inventory.unlocked.has(target.id)) {
        if (!this.canRead()) return;
        if (!g.inventory.power) { this.notify("KEYPAD HAS NO POWER / REPAIR THE MAINTENANCE FUSE BOX"); return; }
        this.openKeypad(target);
        return;
      }
      if (!g.inventory.check(target)) return;
      g.inventory.unlocked.add(target.id);
      g.world.releaseDoor(target, g.player.position);
      g.audio.cue("door", target.position);
      g.inventory.draw();
      g.story.save?.();
      return;
    }
    if (target.type === "crtService") {
      if (!g.world.crt.open) { this.notify("TURN THE MONITOR ON"); return; }
      if (!g.inventory.power) { this.notify("NO SERVICE SIGNAL / REPAIR THE MAINTENANCE FUSE"); return; }
      if (!g.inventory.has("secretKey")) { this.notify("THE SELECTOR NEEDS ITS CRT SERVICE KEY"); g.audio.cue("locked",target.position); return; }
      if (g.inventory.unlocked.has(target.id)) return;
      g.inventory.unlocked.add(target.id);
      g.inventory.opened.add("cache_crt");
      g.world.crtSecret.sync(g.inventory);
      g.inventory.discover(target);
      g.audio.cue("unlock",target.position);g.audio.cue("crtTune",target.position);
      g.interactions.notify("A LATCH CLICKS UNDER THE DESK");
      g.inventory.draw();g.story.save?.();return;
    }
    if (target.type === "grounding") {
      g.resources.beginGrounding(target);
      return;
    }
    if (target.type === "pickup") {
      g.inventory.collect(target);
      return;
    }
    if (target.type === "gallery") {
      if (
        g.teacher.active &&
        g.config.enemy &&
        !g.cheats?.freezeTeacher &&
        (g.teacher.state === "Chase" ||
          g.teacher.distance(g.player.position) < 6)
      )
        return;
      const state =
        g.world.env.roomStates.get(target.room) || g.world.env.state;
      this.read({
        type: "SCHOOL PHOTOGRAPH",
        title: "School photographs",
        aged: target.aged && !["normal", "memory"].includes(state),
        body: "",
        image: ["normal", "memory"].includes(state)
          ? SCHOOL_ART.friendly
          : target.horrorImage || SCHOOL_ART.haunted,
        alt: "An unsettling school photograph.",
      });
      return;
    }
    if (target.type === "power") {
      g.inventory.repairPower();
      return;
    }
    if (target.id === "fault" && !g.inventory?.power && g.inventory) {
      this.prompt.textContent =
        "RESTORE POWER / FIND A FUSE AND REPAIR THE FUSE BOX";
      return;
    }
    if (g.inventory && !g.inventory.check(target)) return;
    if (target.type === "hide") {
      g.teacher.noticeHide(target);
      g.player.hide(target);
      g.story.signal("hide", target.id);
      return;
    }
    if (target.type === "note" || target.type === "drawer") {
      // Reading cannot freeze a pursuer at arm's length. Break contact before picking a document up.
      if(!this.canRead())return;
      if (target.id === "bracelet" && !target.open) {
        if (target.hinge) target.hinge.rotation.y = target.openAngle;
        target.open = true;
        g.audio.cue("door", target.position);
      }
      if (target.type === "drawer"&&!target.drawerTray)
        target.mesh.position.x += target.open ? -0.18 : 0.18;
      if (target.type === "drawer") target.open = !target.open;
      const note=typeof target.note==='string'?NOTES[target.note]:target.note;
      if(note&&!note.image)g.inventory.discover({id:typeof target.note==='string'?target.note:target.id,note});
      this.read(target.note, () => g.story.signal("interact", target.id));
      return;
    }
    if (target.type === "door") {
      if (target.id === "escapeDoor") {
        if (target.door.unlatched) return;
        if (['vale','fault'].includes(g.story.stage)) {
          this.hold = { target, elapsed: 0 };
          g.audio.cue("door", target.position);
        }
        return;
      }
      if (target.door.requires||target.manual) {
        g.inventory.unlocked.add(target.id);
        if (target.door.open || target.door.motorTarget === 1) {
          if(!g.world.closeDoor(target.door,g.player.position,g.config.playerRadius)) {this.notify("DOORWAY BLOCKED");return;}
          g.inventory.opened.delete(target.id);
        } else {
          g.world.animateDoor(target.door, g.player.position, true);
          g.inventory.opened.add(target.id);
        }
        g.story.save?.();
        return;
      }
      g.story.signal("interact", target.id);
      return;
    }
    if (target.type === "switch") {
      g.audio.cue("switch", target.position);
      if (target.id === "crt") {
        g.inventory.setCRT(!target.open);
        g.world.crtSecret?.sync(g.inventory);
        g.story.save?.();
      } else {
        if(g.inventory.powerFailure){this.notify('THE MAINTENANCE FUSE HAS TRIPPED');return;}
        target.open = !target.open;
        g.player.lightsOut = !g.player.lightsOut;
      }
      return;
    }
    g.story.signal("interact", target.id);
  }
  notify(message) {
    const el = document.querySelector("#itemNotice");
    if (!el) return;
    el.textContent = message;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { el.textContent = ""; }, 3300);
    this.noticeTimer.unref?.();
  }
  canRead() {
    const g=this.game;
    if(g.echoes?.blocksReading()){
      this.notify('THE HEADMASTER IS WATCHING');return false;
    }
    if (g.teacher.active && g.config.enemy !== false && !g.cheats?.freezeTeacher && !g.cheats?.invincible &&
      (g.teacher.state === "Chase" || g.teacher.distance(g.player.position)<6)) {
      this.notify("BREAK SIGHT BEFORE READING"); return false;
    }
    return true;
  }
  openJournal() {
    if (this.reader) { this.close(); return; }
    if (!this.canRead()) return;
    const inv=this.game.inventory;
    const carried=[...inv.items].map(id=>ITEMS[id]?.name || id);
    const found=[...inv.notes].map(id=>{
      const note=this.game.world.interactables.find(t=>t.id===id)?.note;
      return typeof note==='string'?NOTES[note]:note || CLUES[id] || MARA_PAGES[id] || NOTES[id];
    })
      .filter(Boolean);
    const tools=carried.join('\n') || 'Your pockets are empty.';
    const notes=found.map(n=>`${n.title.toUpperCase()}\n${n.body}`).join('\n\n');
    this.read({presentation:"journal",type:"AFTER HOURS / FIELD JOURNAL",title:"Field journal",body:`CARRIED ITEMS\n\n${tools}\n\nDISCOVERED CLUES\n\n${notes || "No clues recorded."}`});
    const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    document.querySelector('#journalItems').innerHTML=carried.length
      ? carried.map(item=>`<li>${escape(item)}</li>`).join('') : '<li class="journal-empty">Your pockets are empty.</li>';
    document.querySelector('#journalClues').innerHTML=found.length
      ? found.map(note=>`<article class="journal-entry"><h3>${escape(note.title)}</h3><p>${escape(note.body)}</p></article>`).join('')
      : '<p class="journal-empty">No scraps collected yet.</p>';
  }
  openKeypad(target) {
    this.read({type:"RECORD VAULT · THREE-DIGIT LOCK",presentation:"keypad",title:"Record vault",body:"Three worn keys. A dark display. The metal around it is polished by old hands."});
    this.keypadTarget=target;this.pin="";
    document.querySelector("#keypad")?.classList.remove("hidden");
    this.drawPin();
  }
  drawPin(message="") {
    const el=document.querySelector("#pinDisplay");
    if(el) el.textContent=message || this.pin.padEnd(3,"_").split("").join(" ");
  }
  pressDigit(value) {
    if(!this.keypadTarget) return;
    if(value==='clear'){this.pin="";this.drawPin();return;}
    if(value==='enter'){this.submitCode(this.pin);return;}
    if(this.pin.length<3 && /^\d$/.test(value)){this.pin+=value;this.drawPin();}
  }
  submitCode(code) {
    const t=this.keypadTarget,g=this.game;
    if(!t || !g.inventory.power || (t.secretKey&&!g.inventory.has(t.secretKey))) return false;
    if(code!==t.code){this.pin="";this.drawPin("WRONG CODE");g.audio.cue("switch");return false;}
    g.inventory.unlocked.add(t.id);g.world.releaseDoor(t,g.player.position);
    g.audio.cue("door",t.position);g.inventory.draw();g.story.save?.();
    this.close();this.notify("VAULT UNLOCKED");return true;
  }
  read(id, callback = null) {
    this.keypadTarget=null;
    document.querySelector("#keypad")?.classList.add("hidden");
    const n = typeof id === "object" ? id : NOTES[id];
    if (!n) return;
    const paper=document.querySelector('#reader .paper');
    for(const [name,enabled] of [
      ['journal',n.presentation==='journal'],['keypad-view',n.presentation==='keypad'],
      ['aged-note',!n.image&&!n.presentation],
    ])paper.classList[enabled?'add':'remove'](name);
    document.querySelector('#closeReader').innerHTML=n.presentation==='journal'
      ? 'CLOSE JOURNAL <span>J / ESC</span>' : n.presentation==='keypad'
      ? 'STEP BACK <span>E / ESC</span>' : 'PUT IT DOWN <span>E / ESC</span>';
    this.game.hauntings?.cancel();
    this.game.audio.cue("paper");
    this.reader = true;
    document.querySelector("#hud")?.classList.add("reading");
    this.readCallback = callback;
    this.readOpened = performance.now();
    document.querySelector("#readType").textContent = n.type;
    document.querySelector("#readTitle").textContent = n.title;
    document.querySelector("#readBody").textContent = n.body;
    const image = document.querySelector("#readImage");
    image.classList[n.image ? "remove" : "add"]("hidden");
    image.src = n.image || "";
    image.classList[n.aged ? "add" : "remove"]("aged-photo");
    image.alt = n.alt || "";
    document
      .querySelector("#reader .paper")
      .classList[n.image ? "add" : "remove"]("visual");
    document.querySelector("#reader").classList.remove("hidden");
    document.exitPointerLock?.();
    this.game.player.keys.clear();
  }
  close() {
    if (!this.reader) return;
    this.reader = false;
    document.querySelector("#hud")?.classList.remove("reading");
    this.keypadTarget=null;
    document.querySelector("#reader").classList.add("hidden");
    const cb = this.readCallback;
    this.readCallback = null;
    cb?.();
    this.game.requestLock();
  }
}
