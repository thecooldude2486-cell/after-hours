import { atmosphereCue } from "../data/atmosphere.js";
/** Incongruous school music comes from empty rooms. Safe memories use its clean arrangement. */
export class AtmosphereSystem {
  constructor(game) {
    this.game = game;
    this.handle = null;
    this.key = null;
  }
  update() {
    const cue = atmosphereCue(this.game),
      key = cue ? cue.id + (cue.zone?.id || "") : null;
    if (key === this.key && (!key || this.handle?.playing)) {
      if (cue) this.handle?.setVolume?.(cue.gain);
      return;
    }
    this.handle?.stop();
    this.handle = null;
    this.key = key;
    if (cue)
      this.handle = this.game.audio.playMusic?.(cue.id, cue.position, cue.gain);
  }
  reset() {
    this.handle?.stop();
    this.handle = null;
    this.key = null;
  }
}
