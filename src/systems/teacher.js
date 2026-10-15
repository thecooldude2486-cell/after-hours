import { Navigation, slide, lineClear, blocked } from "./navigation.js";
export const AI_STATES = [
  "Patrol",
  "Suspicious",
  "Investigate",
  "Search",
  "Chase",
  "Return",
];
export class TeacherAI {
  constructor(world, player, audio, config, onCatch) {
    this.world = world;
    this.player = player;
    this.audio = audio;
    this.config = config;
    this.onCatch = onCatch;
    this.mesh = world.teacher;
    this.nav = new Navigation(world.obstacles);
    this.active = false;
    this.state = "Patrol";
    this.timer = 0;
    this.suspicion = 0;
    this.path = [];
    this.pathTimer = 0;
    this.stepTimer = 0;
    this.lastKnown = null;
    this.target = null;
    this.patrol = [
      { x: 0, z: -31 },
      { x: 0, z: -42 },
      { x: 0, z: -5 },
    ];
    this.patrolIndex = 0;
    this.home = { x: 0, z: -38 };
    this.grace = 0;
    this.scripted = false;
    this.caught = false;
    this.lostSight = 0;
    this.witnessedHide = null;
    this.hideCheck = 0;
    this.lastCaptureReason = "caught";
  }
  activate(x = 0, z = -38, scripted = false) {
    this.active = true;
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
    this.home = { x, z };
    this.caught = false;
    this.scripted = scripted;
    this.grace = this.config.encounterGrace;
    this.lostSight = 0;
    this.suspicion = 0;
    this.witnessedHide = null;
    this.hideCheck = 0;
    this.patrolIndex = 0;
    this.change("Patrol");
  }
  deactivate() {
    this.active = false;
    this.mesh.visible = false;
    this.path = [];
    this.caught = false;
  }
  change(state, target = null) {
    this.state = state;
    this.timer = 0;
    this.path = [];
    this.pathTimer = 0;
    if (target) this.target = { x: target.x, z: target.z };
  }
  sees() {
    const p = this.player;
    if (p.hidden) return false;
    const dx = p.position.x - this.mesh.position.x,
      dz = p.position.z - this.mesh.position.z,
      dist = Math.hypot(dx, dz);
    if (
      dist >
      this.config.visionRange *
        (p.crouched ? 0.65 : 1) *
        (p.flashlight && (p.battery ?? 100) > 0 ? 1 : 0.8)
    )
      return false;
    const look = Math.atan2(-dx, -dz),
      diff = Math.atan2(
        Math.sin(look - this.mesh.rotation.y),
        Math.cos(look - this.mesh.rotation.y),
      );
    return (
      (Math.abs(diff) < this.config.visionAngle || dist < 2) &&
      lineClear(
        { x: this.mesh.position.x, y: 2.2, z: this.mesh.position.z },
        p.position,
        this.world.obstacles,
      )
    );
  }
  hears() {
    const p = this.player;
    return (
      !p.hidden &&
      p.noise > 0 &&
      Math.hypot(
        p.position.x - this.mesh.position.x,
        p.position.z - this.mesh.position.z,
      ) <
        this.config.hearingRange * p.noise
    );
  }
  noticeHide(spot) {
    // A locker is protection only if she did not watch you enter it.
    if (!this.active || this.grace > 0) return;
    const approach = { x: this.player.position.x, z: this.player.position.z };
    if (this.sees()) {
      this.witnessedHide = { id: spot.id, approach };
      this.lastKnown = approach;
      this.hideCheck = 0;
      this.change("Search", approach);
    } else if (this.distance(approach) < this.config.hearingRange * 0.5) {
      this.lastKnown = approach;
      this.change("Investigate", approach);
    }
  }
  capture(reason = "caught") {
    if (this.caught) return;
    this.caught = true;
    this.lastCaptureReason = reason;
    this.onCatch(reason);
  }
  update(dt) {
    if (!this.active || this.caught) return;
    this.timer += dt;
    this.grace = Math.max(0, this.grace - dt);
    const sees = this.sees(),
      hears = this.hears(),
      p = this.player;
    if (this.witnessedHide && p.hidden?.spot.id === this.witnessedHide.id) {
      this.moveTo(
        this.witnessedHide.approach,
        dt,
        this.config.patrolSpeed * 1.5,
      );
      if (this.distance(this.witnessedHide.approach) < 1.25) {
        if (this.hideCheck === 0) this.audio.cue("door", this.mesh.position);
        this.hideCheck += dt;
        if (this.hideCheck > this.config.hideCheckDuration)
          this.capture("witnessed");
      }
      return;
    }
    if (this.witnessedHide && !p.hidden) this.witnessedHide = null;
    if (this.grace <= 0 && sees) {
      this.lostSight = 0;
      this.suspicion += dt;
      if (this.suspicion > this.config.suspicionTime) {
        if (this.state !== "Chase")
          this.audio.cue("breath", this.mesh.position);
        this.changeIf("Chase");
        this.lastKnown = { x: p.position.x, z: p.position.z };
        this.target = this.lastKnown;
      } else this.changeIf("Suspicious");
    } else {
      this.suspicion = Math.max(0, this.suspicion - dt);
      if (this.state === "Chase") {
        this.lostSight += dt;
        if (this.lostSight > this.config.lostSightDuration)
          this.change("Search", this.lastKnown || this.home);
      } else if (hears && this.grace <= 0 && this.state !== "Search") {
        this.lastKnown = { x: p.position.x, z: p.position.z };
        this.changeIf("Investigate", this.lastKnown);
      }
    }
    if (this.state === "Suspicious") {
      if (!sees && this.timer > 2)
        this.change("Investigate", this.lastKnown || this.home);
      return;
    }
    if (this.state === "Patrol") {
      this.target = this.patrol[this.patrolIndex % this.patrol.length];
      if (this.distance(this.target) < 0.6) {
        this.patrolIndex++;
        this.target = this.patrol[this.patrolIndex % this.patrol.length];
      }
    }
    if (
      this.state === "Investigate" &&
      (this.distance(this.target) < 0.7 || this.timer > 10)
    )
      this.change("Search", this.target);
    if (this.state === "Search") {
      if (this.timer > this.config.searchDuration)
        this.change("Return", this.home);
      else if (!this.target || this.distance(this.target) < 0.5) {
        const a = this.timer * 1.7;
        this.target = {
          x: (this.lastKnown?.x || this.home.x) + Math.sin(a) * 2,
          z: (this.lastKnown?.z || this.home.z) + Math.cos(a) * 2,
        };
      }
    }
    if (this.state === "Return" && this.distance(this.home) < 0.6)
      this.change("Patrol");
    // Continue to the last seen position instead of forgetting the player as soon as sight breaks.
    this.moveTo(
      this.target,
      dt,
      this.state === "Chase" ? this.config.chaseSpeed : this.config.patrolSpeed,
    );
    const dist = Math.hypot(
      p.position.x - this.mesh.position.x,
      p.position.z - this.mesh.position.z,
    );
    if (this.state === "Chase" && dist < 0.78 && !p.hidden && this.grace <= 0) {
      this.capture(p.exhausted ? "exhausted" : "caught");
    }
  }
  changeIf(state, target = null) {
    if (this.state !== state) this.change(state, target);
    else if (target) this.target = target;
  }
  distance(t) {
    return t
      ? Math.hypot(t.x - this.mesh.position.x, t.z - this.mesh.position.z)
      : Infinity;
  }
  moveTo(target, dt, speed) {
    if (!target) return;
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      this.path = this.nav.path(this.mesh.position, target);
      const center = this.nav.world(this.nav.cellOf(this.mesh.position));
      // Only recenter when a corner actually obstructs the next leg. Unconditional
      // recentering on every refresh made the Teacher walk backwards mid-stride.
      const next = this.path[0];
      const legClear = next && this.clearLeg(this.mesh.position, next);
      if (
        !legClear &&
        this.distance(center) > 0.04 &&
        !blocked(center.x, center.z, this.world.obstacles, 0.25)
      )
        this.path.unshift(center);
      this.pathTimer = this.state === "Chase" ? 0.5 : 1.6;
    }
    let next = this.path[0];
    if (!next) return;
    let dx = next.x - this.mesh.position.x,
      dz = next.z - this.mesh.position.z,
      d = Math.hypot(dx, dz);
    while (d < 0.04) {
      this.path.shift();
      next = this.path[0];
      if (!next) return;
      dx = next.x - this.mesh.position.x;
      dz = next.z - this.mesh.position.z;
      d = Math.hypot(dx, dz);
    }
    const amount = Math.min(speed * dt, d);
    slide(
      this.mesh.position,
      (dx / d) * amount,
      (dz / d) * amount,
      this.world.obstacles,
      0.25,
    );
    const desired = Math.atan2(-dx, -dz);
    const turn = Math.atan2(
      Math.sin(desired - this.mesh.rotation.y),
      Math.cos(desired - this.mesh.rotation.y),
    );
    const turnLimit = (this.config.teacherTurnSpeed ?? 5) * dt;
    this.mesh.rotation.y += Math.max(-turnLimit, Math.min(turnLimit, turn));
    this.stepTimer += dt;
    if (this.stepTimer > (this.state === "Chase" ? 0.47 : 0.92)) {
      this.audio.cue("teacherStep", this.mesh.position);
      this.stepTimer = 0;
    }
    this.mesh.position.y = 0;
  }
  clearLeg(start, end) {
    const steps = Math.ceil(
      Math.hypot(end.x - start.x, end.z - start.z) / 0.08,
    );
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (
        blocked(
          start.x + (end.x - start.x) * t,
          start.z + (end.z - start.z) * t,
          this.world.obstacles,
          0.25,
        )
      )
        return false;
    }
    return true;
  }
}
