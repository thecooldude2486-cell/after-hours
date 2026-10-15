import { syncSecrets } from "../world/secrets.js";
import { ITEMS, ITEM_LAYOUTS, BATTERY_STORES } from "../data/items.js";
import { PRESETS } from "../data/presets.js";
import { STAGE_ORDER } from "../data/beats.js";
import { itemIcon } from "../ui/item-icons.js";

export class InventorySystem {
  constructor(game) {
    this.game = game;
    this.reset();
    game.world.onSecretExit=()=>{if(this.notes.has("clue_truth"))game.finish?.("secret");};
    game.world.onDoorPushed = (door) => {
      if (this.opened.has(door.id)) return;
      this.opened.add(door.id);
      this.draw();
      game.story.save?.();
    };
  }
  reset() {
    this.items = new Set();
    this.batteries = 0;
    this.groundingKits = 0;
    this.collected = new Set();
    this.unlocked = new Set();
    this.power = false;
    this.opened = new Set();
    this.notes = new Set();
  }
  has(id) {
    return this.items.has(id) || Boolean(this.game.cheats?.allKeys);
  }
  snapshot() {
    return {
      pushDoorRevision: 1,
      items: [...this.items],
      batteries: this.batteries,
      groundingKits: this.groundingKits,
      collected: [...this.collected],
      unlocked: [...this.unlocked],
      power: this.power,
      opened: [...this.opened],
      notes: [...this.notes],
      preset: this.game.config.preset,
    };
  }
  restore(save = {}) {
    this.items = new Set(save.items || []);
    this.batteries = save.batteries || 0;
    this.groundingKits = save.groundingKits || 0;
    this.collected = new Set(save.collected || []);
    this.unlocked = new Set(save.unlocked || []);
    this.power = !!save.power;
    this.opened = new Set(save.opened || []);
    this.notes = new Set(save.notes || []);
    if(save.pushDoorRevision!==1) for(const door of this.game.world.doors||[])
      if(this.unlocked.has(door.id))this.opened.add(door.id);
    this.applyLayout();
    this.applyLocks();
    this.draw();
  }
  applyLayout() {
    const { world, config } = this.game,
      layout = PRESETS[config.preset]?.layout ?? 2;
    for (const c of world.storage || []) {
      c.open = this.opened.has(c.id);
      c.amount = c.open ? 1 : 0;
    }
    syncSecrets(world, this.opened, this.unlocked, this.notes);
    world.exitTriggered=false;
    world.annex?.sync(this.opened);
    for (const target of world.interactables)
      if (target.type === "pickup") {
        if (target.fixed) {
          target.available = !this.collected.has(target.id);
          continue;
        }
        let item = target.item,
          index = layout;
        if (item === "battery") {
          [item, index] = BATTERY_STORES[target.slot];
          // A spare sits in a different drawer from the required item, in every layout.
          if (index === layout) index = (index + 1) % 5;
        }
        const container = world.storage?.find(
          (c) => c.storageItem === item && c.index === index,
        );
        if (container) {
          container.tray.add(target.mesh);
          target.mesh.position.set(
            target.item === "battery" ? 0.22 : 0,
            0.045,
            0,
          );
          target.mesh.rotation.set(0, 0, 0);
          target.mesh.scale.setScalar(1.2);
          if (container.kind === "locker") {
            if (ITEMS[target.item]?.type === "key") {
              // Hang keys at eye level on the open cavity's backboard.
              target.mesh.position.set(0.06, 0.57, -0.18);
              target.mesh.rotation.set(Math.PI / 2, 0, -0.35);
              target.mesh.scale.setScalar(1.55);
            } else {
              target.mesh.position.set(target.item === "battery" ? 0.19 : -0.04, 0.045, 0.13);
              target.mesh.scale.setScalar(1.45);
            }
          }
          target.container = container;
          container.root.updateMatrixWorld(true);
          target.mesh.getWorldPosition(target.position);
        } else target.mesh.position.fromArray(ITEM_LAYOUTS[item][index]);
        const limit =
          config.preset === "nightmare" ? 5 : config.preset === "hard" ? 6 : 8;
        target.available =
          !this.collected.has(target.id) &&
          (target.item !== "battery" || target.slot < limit);
      }
    this.syncStorage();
  }
  storageAccessible(container) {
    return !container || (container.open && container.amount > 0.85 && this.storageAccessible(container.parentContainer));
  }
  storageVisible(container) {
    return !container || (container.amount > 0.08 && this.storageVisible(container.parentContainer));
  }
  syncStorage() {
    for (const c of this.game.world.storage || []) {
      if (!c.fixed) continue;
      c.enabled = this.storageAccessible(c.parentContainer);
      c.root.visible = c.enabled;
      c.root.updateWorldMatrix(true, true);
      c.mesh.getWorldPosition(c.position);
    }
    for (const t of this.game.world.interactables)
      if (t.type === "pickup") {
        t.enabled =
          !!t.available &&
          this.storageAccessible(t.container);
        t.mesh.visible = !!t.available && this.storageVisible(t.container);
        t.mesh.updateWorldMatrix(true, false);
        t.mesh.getWorldPosition(t.position);
      }
  }
  toggleStorage(target) {
    target.open = !target.open;
    if (target.open) this.opened.add(target.id);
    else this.opened.delete(target.id);
    this.game.audio.cue(
      target.kind === "drawer" ? "drawer" : "door",
      target.position,
    );
    this.syncStorage();
    this.game.story.save?.();
  }
  collect(target) {
    if (
      this.collected.has(target.id) ||
      target.enabled === false ||
      !this.storageAccessible(target.container)
    )
      return;
    this.collected.add(target.id);
    if (target.item === "battery") this.batteries++;
    else if (target.item === "groundingKit") this.groundingKits++;
    else this.items.add(target.item);
    target.available = false;
    target.mesh.visible = false;
    target.enabled = false;
    this.game.audio.cue("switch");
    this.game.interactions.notify?.(`FOUND / ${ITEMS[target.item]?.name || target.item}`);
    this.draw();
    this.game.story.refreshObjective?.();
    this.game.story.save?.();
  }
  check(target) {
    if (!target.requires || this.unlocked.has(target.id)) return true;
    if (!this.has(target.requires)) {
      const message = `LOCKED / NEED ${ITEMS[target.requires]?.name.toUpperCase() || target.requires}`;
      this.game.interactions.prompt.textContent = message;
      this.game.interactions.notify?.(message);
      return false;
    }
    this.unlocked.add(target.id);
    this.game.audio.cue(
      target.kind === "drawer" ? "drawer" : "door",
      target.position,
    );
    this.game.story.save?.();
    this.draw();
    return true;
  }
  applyLocks() {
    for (const door of this.game.world.doors) if (door.requires||door.manual) {
      const unlocked=this.unlocked.has(door.id)||this.game.cheats?.allKeys;
      if(unlocked && !this.opened.has(door.id) && this.game.world.releaseDoor) {
        this.game.world.openDoor(door,false);
        this.game.world.releaseDoor(door,this.game.player.position);
      } else this.game.world.openDoor(door,!!unlocked);
    }
  }
  useBattery() {
    if (this.batteries <= 0) {
      this.game.interactions.prompt.textContent =
        "NO SPARE BATTERIES / FIND A BATTERY OR POWERED CHARGER";
      return false;
    }
    if (this.game.player.battery >= 99) return false;
    this.batteries--;
    this.game.player.battery = Math.min(100, this.game.player.battery + 70);
    this.game.audio.cue("switch");
    this.draw();
    this.game.story.refreshObjective?.();
    this.game.story.save?.();
    return true;
  }
  useGroundingKit() {
    const g = this.game;
    if (this.groundingKits <= 0 || g.player.sanity >= 100) return false;
    this.groundingKits--;
    g.player.sanity = Math.min(100, g.player.sanity + 25);
    g.audio.cue("breath");
    this.draw();
    g.resources?.draw();
    g.story.save?.();
    return true;
  }
  repairPower() {
    if (!this.power && !this.has("fuse")) {
      this.game.interactions.prompt.textContent =
        "FUSE MISSING / SEARCH THE MAINTENANCE LOCKERS";
      return false;
    }
    const firstRepair = !this.power;
    this.power = true;
    this.items.delete("fuse");
    this.game.player.battery = 100;
    if (firstRepair) this.game.player.sanity = Math.min(100, this.game.player.sanity + 15);
    this.game.audio.cue("switch");
    this.draw();
    this.game.story.refreshObjective?.();
    this.game.story.save?.();
    return true;
  }
  hydrateStage(stage) {
    // Old saves and manual checkpoint jumps receive already-completed prerequisites, never future ones.
    const at = STAGE_ORDER.indexOf(stage);
    const completed = {
      lockerKey: "drawing",
      classroomKey: "cassette",
      staffKey: "phone",
      fuse: "vale",
      recordsKey: "waiting",
      cutters: "reunion",
    };
    for (const [item, beat] of Object.entries(completed))
      if (at >= STAGE_ORDER.indexOf(beat)) this.items.add(item);
    if (at >= STAGE_ORDER.indexOf("vale")) {
      this.power = true;
      this.items.delete("fuse");
    }
    const passed = {
      classroomGate: "cassette",
      phoneGate: "phone",
      classDoor: "reunion",
      eastGymGate: "reunion",
      bracelet: "drawing",
      vale: "waiting",
    };
    for (const [door, beat] of Object.entries(passed))
      if (at >= STAGE_ORDER.indexOf(beat)) {
        this.unlocked.add(door);this.opened.add(door);
      }
    this.applyLayout();
    this.applyLocks();
    this.draw();
  }
  discover(target) {
    const fresh = !this.notes.has(target.id);
    this.notes.add(target.id);
    if (fresh) this.game.interactions.notify?.("CLUE SAVED / J TO OPEN JOURNAL");
    this.draw();
    this.game.story.save?.();
  }
  draw() {
    const progress = document.querySelector("#secretProgress");
    if (progress) {
      const count = (this.game.world.secrets || []).filter(p => this.opened.has(p.id)).length;
      progress.textContent = `THE SEALED WING · ${count}/5 ROOMS · J JOURNAL`;
    }
    const el = document.querySelector("#inventoryItems");
    el.textContent =
      [...this.items].map((id) => ITEMS[id]?.name || id).join("\n\n") ||
      "No tools or keys";
    document.querySelector("#batteryCount").textContent = String(
      this.batteries,
    );
    const corner = document.querySelector("#pocketSlots");
    if (!corner) return;
    const slot = (type, label, key, extra = "") =>
      `<div class="pocket-slot" title="${label}" aria-label="${label}">${itemIcon(type)}<small>${key}</small>${extra}</div>`;
    const carried = [...this.items];
    corner.innerHTML =
      slot(
        "flashlight",
        "Flashlight · F",
        "F",
        '<i class="pocket-charge"><b id="pocketCharge"></b></i>',
      ) +
      slot(
        "battery",
        `${this.batteries} spare batteries · B`,
        "B",
        `<em>${this.batteries}</em>`,
      ) +
      slot("calm", `${this.groundingKits} grounding kits · H · +25 sanity`, "H", `<em>${this.groundingKits}</em>`) +
      carried
        .slice(-3)
        .map((id) =>
          slot(
            ITEMS[id]?.type || "key",
            ITEMS[id]?.name || id,
            {
              lockerKey: "17",
              classroomKey: "04",
              staffKey: "08",
              recordsKey: "STAFF",
              fuse: "FUSE",
              cutters: "GYM",
            }[id] || "",
          ),
        )
        .join("") +
      (carried.length > 3
        ? `<div class="pocket-more">+${carried.length - 3}<small>TAB</small></div>`
        : "");
    const charge = document.querySelector("#pocketCharge");
    if (charge) charge.style.height = `${this.game.player?.battery ?? 70}%`;
  }
}
