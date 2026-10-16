const clamp = (v) => Math.max(0, Math.min(100, v));

export class ResourceSystem {
  constructor(game) {
    this.game = game;
    this.heartbeat = 0;
    this.restAt = null;
  }
  isDark() {
    const g = this.game;
    const memory = ['normal', 'memory'].includes(g.world.env.state) || g.story.companion;
    return !memory && (!!g.player.lightsOut || !!g.player.hidden);
  }
  update(dt) {
    const g = this.game, p = g.player, cheats = g.cheats || {};
    if (!g.cinematics.active) {
      const danger = g.teacher.active &&
        (g.teacher.state === 'Chase' || g.teacher.distance(p.position) < 7);
      const dark = this.isDark();
      const restTarget = g.world.interactables?.find(t => t.id === this.restAt);
      const resting = !!restTarget && !p.moving && !dark && !danger && !g.ambushes?.blocking &&
        Math.hypot(p.position.x - restTarget.position.x, p.position.z - restTarget.position.z) < 2;
      if (!resting) this.restAt = null;
      const memory = ['normal', 'memory'].includes(g.world.env.state) || g.story.companion;
      if (cheats.infiniteSanity) p.sanity = 100;
      else if (!g.ambushes?.blocking) p.sanity = clamp(p.sanity + dt *
        (memory ? 2.4 : danger ? -2.2 : dark ? -g.config.sanityDrain : resting ? 3 : !p.moving ? 0.7 : 0));
      if (cheats.infiniteStamina) { p.stamina = g.config.sprintCapacity; p.exhausted = false; }
      this.heartbeat += dt;
      if (p.sanity < 25 && this.heartbeat > 2.1) { g.audio.cue('heartbeat'); this.heartbeat = 0; }
    }
    this.draw();
  }
  beginGrounding(target) {
    const g = this.game;
    if (this.isDark() || g.ambushes?.blocking ||
      (g.teacher.active && (g.teacher.state === 'Chase' || g.teacher.distance(g.player.position) < 7))) {
      g.interactions.prompt.textContent = 'TURN THE SCHOOL LIGHTS ON AND BREAK CONTACT BEFORE RESTING';
      return false;
    }
    this.restAt = target.id;
    return true;
  }
  draw() {
    const g = this.game, p = g.player;
    for (const [id, value] of [['sanity', p.sanity], ['stamina', p.stamina / g.config.sprintCapacity * 100]]) {
      document.querySelector('#' + id + 'Fill').style.width = `${clamp(value)}%`;
      document.querySelector('#' + id + 'Value').textContent = `${Math.floor(value)}%`;
      document.querySelector('#' + id + 'Meter').classList[value < 25 ? 'add' : 'remove']('low');
    }
    document.querySelector('#sanityEffect').style.opacity = String(Math.max(0, (40 - p.sanity) / 90));
  }
  snapshot() { return { sanity: this.game.player.sanity }; }
  restore(save = {}, retry = false) {
    this.restAt = null;
    this.game.player.sanity = retry ? Math.max(55, save.sanity ?? 100) : (save.sanity ?? 100);
    this.draw();
  }
}
