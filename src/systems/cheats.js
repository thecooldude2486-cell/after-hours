import { ITEMS } from "../data/items.js";
export class CheatSystem {
  constructor(game) {
    this.game = game;
    this.invincible = false;
    this.infiniteStamina = false;
    this.infiniteSanity = false;
    this.allKeys = false;
    this.freezeTeacher = false;
    this.disableMonsters = false;
  }
  grantItems() {
    for (const id of Object.keys(ITEMS))
      if (id !== "groundingKit") this.game.inventory.items.add(id);
    this.game.inventory.groundingKits = 99;
    this.game.inventory.draw();
  }
  unlockAll() {
    this.allKeys = true;
    for (const d of this.game.world.doors) this.game.world.openDoor(d, true);
    for (const t of this.game.world.interactables)
      if (t.requires) this.game.inventory.unlocked.add(t.id);
    this.game.inventory.draw();
  }
  refill() {
    const p = this.game.player;
    p.sanity = 100;
    p.stamina = this.game.config.sprintCapacity;
    p.exhausted = false;
    this.game.resources.draw();
  }
  teleport(region) {
    const destinations = {
      westWing:[-29,-50],library:[-32,-39],infirmary:[-32,-55],workshop:[-26,-56],boiler:[-26,-40],
      reception: [0, 7],
      classroom: [-5, -17],
      phone: [8, -37],
      maintenance: [17.5, -44],
      archive: [-9, -37],
      gym: [0, -66],
    };
    const place = destinations[region];
    if (place) {
      this.game.player.leaveHide();
      this.game.player.teleport(...place);
    }
  }
}
