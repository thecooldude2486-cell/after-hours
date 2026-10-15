const clamp = (v) => Math.max(0, Math.min(100, v));

export class ResourceSystem {
  constructor(game) {
    this.game = game;
    this.heartbeat = 0;
    this.restAt = null;
  }
  update(dt) {
    const g = this.game,
      p = g.player,
      state = g.world.env.state,
      cheats = g.cheats || {};
    if (!g.cinematics.active) {
      if (p.flashlight && !p.hidden && !cheats.infiniteLight)
        p.battery = clamp(p.battery - dt * g.config.batteryDrain);
      const danger =
        g.teacher.active &&
        (g.teacher.state === "Chase" || g.teacher.distance(p.position) < 7);
      const dark = !p.flashlight || p.battery <= 0;
      const restTarget = g.world.interactables?.find(t => t.id === this.restAt);
      const resting = !!restTarget && !p.moving && !dark && !danger && !g.ambushes?.blocking && !p.hidden &&
        Math.hypot(p.position.x - restTarget.position.x, p.position.z - restTarget.position.z) < 2;
      if (!resting) this.restAt = null;
      const memory =
        state === "normal" || state === "memory" || g.story.companion;
      if (cheats.infiniteSanity) p.sanity = 100;
      else if (!g.ambushes?.blocking)
        p.sanity = clamp(
          p.sanity +
            dt *
              (memory
                ? 2.4
                : danger
                  ? -2.2
                  : dark
                    ? -g.config.sanityDrain
                    : resting
                      ? 3
                      : !p.moving
                      ? 0.7
                      : 0),
        );
      if (cheats.infiniteStamina) {
        p.stamina = g.config.sprintCapacity;
        p.exhausted = false;
      }
      if (cheats.infiniteLight) p.battery = 100;
      this.heartbeat += dt;
      if (p.sanity < 25 && this.heartbeat > 2.1) {
        g.audio.cue("heartbeat");
        this.heartbeat = 0;
      }
    }
    p.lightFactor = this.flashlightFactor(g.time);
    p.syncFlashlight();
    this.draw();
  }
  beginGrounding(target) {
    const g = this.game;
    if (!g.player.flashlight || g.player.battery <= 0 || g.ambushes?.blocking ||
      (g.teacher.active && (g.teacher.state === "Chase" || g.teacher.distance(g.player.position) < 7))) {
      g.interactions.prompt.textContent = "FIND LIGHT AND BREAK CONTACT BEFORE RESTING";
      return false;
    }
    this.restAt = target.id;
    return true;
  }
  flashlightFactor(time) {
    const p = this.game.player;
    if (p.battery <= 0) return 0;
    if (p.battery >= 25) return 1;
    // A deterministic dropout pattern, increasingly frequent toward empty. Never modifies input.
    const period = Math.floor(time * 9),
      severity = (25 - p.battery) / 25;
    const pulse = Math.sin(period * 12.9898) * 43758.5453;
    const random = pulse - Math.floor(pulse);
    return random < 0.12 + severity * 0.4 ? 0.08 : 0.76 + random * 0.24;
  }
  draw() {
    const g = this.game,
      p = g.player;
    for (const [id, value] of [
      ["sanity", p.sanity],
      ["stamina", (p.stamina / g.config.sprintCapacity) * 100],
      ["flashlight", p.battery],
    ]) {
      document.querySelector("#" + id + "Fill").style.width =
        `${Math.max(0, Math.min(100, value))}%`;
      document.querySelector("#" + id + "Value").textContent =
        `${Math.floor(value)}%`;
      document
        .querySelector("#" + id + "Meter")
        .classList[value < 25 ? "add" : "remove"]("low");
    }
    document.querySelector("#sanityEffect").style.opacity = String(
      Math.max(0, (40 - p.sanity) / 90),
    );
    const charge = document.querySelector("#pocketCharge");
    if (charge) {
      charge.style.height = `${clamp(p.battery)}%`;
      charge.style.background = p.battery < 25 ? "#c68c65" : "#cec1a4";
    }
  }
  snapshot() {
    return {
      battery: this.game.player.battery,
      sanity: this.game.player.sanity,
    };
  }
  restore(save = {}, retry = false) {
    const p = this.game.player;
    this.restAt = null;
    p.battery = retry
      ? Math.max(30, save.battery ?? this.game.config.startBattery ?? 70)
      : (save.battery ?? this.game.config.startBattery ?? 70);
    p.sanity = retry ? Math.max(55, save.sanity ?? 100) : (save.sanity ?? 100);
    p.lightFactor = 1;
    this.draw();
  }
}
