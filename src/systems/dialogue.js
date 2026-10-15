import { DIALOGUE } from "../data/dialogue.js";
export class DialogueSystem {
  constructor(audio, config) {
    this.audio = audio;
    this.config = config;
    this.current = null;
    this.queue = [];
    this.speaker = document.querySelector("#speaker");
    this.text = document.querySelector("#line");
  }
  play(id, position = null) {
    const lines = typeof id === "string" ? DIALOGUE[id] : id;
    this.audio.prepareLines?.(lines);
    return new Promise((resolve) => {
      this.queue.push({
        lines,
        position,
        resolve,
      });
      this.next();
    });
  }
  next() {
    if (this.current || !this.queue.length) return;
    this.current = this.queue.shift();
    this.current.index = -1;
    this.advance();
  }
  advance() {
    if (!this.current) return;
    const c = this.current;
    c.index++;
    if (c.index >= c.lines.length) {
      this.clear();
      c.resolve();
      this.next();
      return;
    }
    c.line = c.lines[c.index];
    c.time = 0;
    this.speaker.textContent = c.line.speaker;
    this.text.textContent = c.line.text;
    this.audio.line(c.line, c.position);
  }
  update(dt) {
    if (!this.current) return;
    this.current.time += dt;
    if (
      this.current.time >=
        this.current.line.duration * this.config.dialogueTiming &&
      !this.audio.isSpeaking
    )
      this.advance();
  }
  skip() {
    if (this.current?.time >= Math.min(1.3, this.current.line.duration))
      this.advance();
  }
  clear() {
    this.current = null;
    this.speaker.textContent = "";
    this.text.textContent = "";
    this.audio.stopLine();
  }
  reset() {
    const jobs = [...(this.current ? [this.current] : []), ...this.queue];
    this.queue = [];
    this.clear();
    jobs.forEach((j) => j.resolve());
  }
}
