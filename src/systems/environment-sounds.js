import { ENVIRONMENT_SOUNDS } from "../data/environment-sounds.js";
import { EXPLORATION_STAGES } from "../data/hauntings.js";

/** A sparse positional layer. Its clock freezes with gameplay, and yields to dialogue and encounters. */
export class EnvironmentSoundSystem {
  constructor(game, random = Math.random) {
    this.game = game;
    this.random = random;
    this.reset();
  }
  reset() {
    this.remaining = 7;
    this.last = null;
    this.game.world.resetAmbientLockers?.();
  }
  eligible() {
    const g = this.game;
    return (
      g.started &&
      !g.paused &&
      !g.ended &&
      !g.recovering &&
      !g.interactions.reader &&
      !g.dialogue.current &&
      !g.story.triggers.busy &&
      !g.cinematics.active &&
      !g.ambushes?.active &&
      !g.story.companion &&
      !(g.teacher.active && g.config.enemy) &&
      !["normal", "memory"].includes(g.world.env.state) &&
      EXPLORATION_STAGES.includes(g.story.stage)
    );
  }
  update(dt) {
    if (!this.eligible()) return;
    this.remaining -= dt;
    if (this.remaining > 0) return;
    const p = this.game.player.position;
    const nearby = ENVIRONMENT_SOUNDS.filter(
      (s) =>
        s.id !== this.last &&
        Math.hypot(p.x - s.at[0], p.z - s.at[2]) < s.radius &&
        Math.hypot(p.x - s.at[0], p.z - s.at[2]) > 2.5,
    );
    this.remaining = 13 + this.random() * 14;
    if (!nearby.length) return;
    const s = nearby[Math.floor(this.random() * nearby.length)];
    this.last = s.id;
    this.game.audio.cue(s.cue, { x: s.at[0], y: s.at[1], z: s.at[2] });
    if (s.cue === "emptyLocker")
      this.game.world.disturbLocker?.({ x: s.at[0], z: s.at[2] });
  }
}
