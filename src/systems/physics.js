import { slide } from "./navigation.js";
const overlaps = (p, o, r) =>
  p.x + r > o.minX && p.x - r < o.maxX && p.z + r > o.minZ && p.z - r < o.maxZ;
const bottom = (o) => o.minY ?? -Infinity,
  top = (o) => o.maxY ?? Infinity;
/** Kinematic upright body: swept horizontal collision, gravity, swept landing/head contact, and step-free support. */
export class PlayerPhysics {
  constructor(player) {
    this.player = player;
    this.reset();
  }
  reset() {
    this.feet = 0;
    this.velocity = 0;
    this.grounded = true;
    this.queued = false;
    this.eye = this.player.config.eyeHeight;
    this.landing = 0;
  }
  jump() {
    if (!this.grounded || this.queued) return false;
    this.queued = true;
    return true;
  }
  update(dt, dx, dz, crouched) {
    const p = this.player,
      c = p.config,
      obstacles = p.world.obstacles,
      r = c.playerRadius ?? 0.23;
    const desiredHeight = crouched ? c.crouchHeight + 0.12 : c.eyeHeight + 0.12;
    // Never stand up into a shelf/desk after crouching underneath it.
    const clearance = obstacles.some(
      (o) =>
        o.enabled !== false &&
        overlaps(p.position, o, r) &&
        bottom(o) > this.feet + 0.02 &&
        bottom(o) < this.feet + desiredHeight &&
        top(o) > this.feet + 0.02,
    );
    const height = clearance
      ? Math.min(this.eye, c.crouchHeight) + 0.12
      : desiredHeight;
    const targetEye = clearance
      ? Math.min(this.eye, c.crouchHeight)
      : crouched
        ? c.crouchHeight
        : c.eyeHeight;
    this.eye += (targetEye - this.eye) * (1 - Math.exp(-dt * 13));
    if (this.queued) {
      this.queued = false;
      if (this.grounded && !clearance) {
        this.velocity = c.jumpSpeed;
        this.grounded = false;
        p.audio.cue("jump", p.position);
      }
    }
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))),
      h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const movedDoors = p.world.pushDoors?.(p.position, dx/steps, dz/steps, r) || [];
      for (const door of movedDoors) {
        if (!door.creaked) { p.audio.cue("door", p.position); door.creaked=true; }
      }
      const active = obstacles.filter(
        (o) =>
          o.enabled !== false &&
          top(o) > this.feet + 0.035 &&
          bottom(o) < this.feet + height - 0.035,
      );
      slide(p.position, dx / steps, dz / steps, active, r);
      const before = this.feet;
      this.velocity -= c.gravity * h;
      let next = this.feet + this.velocity * h,
        ground = 0;
      for (const o of obstacles) {
        if (o.enabled === false || !overlaps(p.position, o, r * 0.88)) continue;
        const y = top(o);
        if (Number.isFinite(y) && y <= before + 0.04)
          ground = Math.max(ground, y);
        if (
          this.velocity > 0 &&
          Number.isFinite(bottom(o)) &&
          before + height <= bottom(o) + 0.02 &&
          next + height >= bottom(o)
        ) {
          next = bottom(o) - height - 0.001;
          this.velocity = 0;
        }
      }
      if (this.velocity <= 0 && next <= ground) {
        if (!this.grounded && this.velocity < -0.8) {
          p.audio.cue("land", p.position);
          this.landing = Math.min(0.1, Math.abs(this.velocity) * 0.012);
          p.landingNoise = 0.9;
        }
        this.feet = ground;
        this.velocity = 0;
        this.grounded = true;
      } else {
        this.feet = Math.max(0, next);
        this.grounded = false;
      }
    }
    this.landing *= Math.exp(-dt * 10);
    p.position.y = this.feet + this.eye;
  }
}
