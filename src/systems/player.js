import * as THREE from "../../vendor/three.module.js";
import { PlayerPhysics } from "./physics.js";
export class Player {
  constructor(camera, world, audio, config) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.config = config;
    this.position = new THREE.Vector3(0, config.eyeHeight, 8);
    this.physics = new PlayerPhysics(this);
    this.landingNoise = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.hidden = null;
    this.crouched = false;
    this.sanity = 100;
    this.moving = false;
    this.sprinting = false;
    this.stamina = config.sprintCapacity;
    this.exhausted = false;
    this.wasSeen = false;
    this.noise = 0;
    this.stepTime = 0;
    this.bob = 0;
    this.locked = false;
    this.lightsOut = false;
    this.boundary = null;
    this.dragging = false;
    this.lastMouse = null;
    document.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    document.addEventListener("mousemove", (e) => {
      if (!this.canLook?.()) return;
      if (document.pointerLockElement) {
        this.look(e.movementX, e.movementY);
      } else if (this.dragging) {
        this.look(e.clientX - this.lastMouse.x, e.clientY - this.lastMouse.y);
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    document.querySelector("#game").addEventListener("mousedown", (e) => {
      this.dragging = true;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener("mouseup", () => (this.dragging = false));
  }
  look(dx, dy) {
    this.yaw -= dx * this.config.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * this.config.mouseSensitivity,
      -1.25,
      1.25,
    );
  }
  teleport(x, z, yaw = this.yaw) {
    this.physics.reset();
    this.position.set(x, this.config.eyeHeight, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.hidden = null;
    this.stamina = this.config.sprintCapacity;
    this.exhausted = false;
    this.keys.clear();
    this.syncCamera(0);
  }
  jump() {
    return !this.hidden && this.physics.jump();
  }
  hide(spot) {
    this.physics.reset();
    this.hidden = {
      spot,
      returnPosition: this.position.clone(),
      returnYaw: this.yaw,
    };
    this.position.set(spot.hide.x, spot.hide.y, spot.hide.z);
    this.yaw = spot.hide.yaw;
    this.pitch = 0;
    this.keys.clear();
    this.audio.cue("door", this.position);
  }
  leaveHide() {
    if (!this.hidden) return;
    this.position.copy(this.hidden.returnPosition);
    this.yaw = this.hidden.returnYaw;
    this.hidden = null;
    this.physics.reset();
    this.audio.cue("door", this.position);
  }
  update(dt, canMove = true) {
    this.crouched = this.keys.has("KeyC") || this.keys.has("ControlLeft");
    this.moving = false;
    this.sprinting = false;
    this.noise = 0;
    this.pushingDoor = null;
    if (this.exhausted && this.stamina > this.config.sprintCapacity * 0.4)
      this.exhausted = false;
    if (canMove && !this.hidden) {
      if (this.keys.has("ArrowLeft")) this.yaw += dt * 1.5;
      if (this.keys.has("ArrowRight")) this.yaw -= dt * 1.5;
      if (this.keys.has("ArrowUp"))
        this.pitch = Math.min(1.25, this.pitch + dt);
      if (this.keys.has("ArrowDown"))
        this.pitch = Math.max(-1.25, this.pitch - dt);
      let f = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
        r = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
      const mag = Math.hypot(f, r);
      let dx = 0,
        dz = 0;
      if (mag) {
        f /= mag;
        r /= mag;
        this.sprinting =
          this.keys.has("ShiftLeft") &&
          !this.crouched &&
          !this.exhausted &&
          this.stamina > 0;
        const speed = this.crouched
          ? this.config.crouchSpeed
          : this.sprinting
            ? this.config.sprintSpeed
            : this.config.walkSpeed;
        dx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * dt * speed;
        dz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * r) * dt * speed;
      }
      const before = this.position.clone();
      this.physics.update(dt, dx, dz, this.crouched);
      if (this.boundary != null)
        this.position.z = Math.max(this.position.z, this.boundary);
      this.moving =
        Math.hypot(this.position.x - before.x, this.position.z - before.z) >
        0.001;
      this.landingNoise = Math.max(0, this.landingNoise - dt * 2);
      this.noise = Math.max(
        this.landingNoise,
        this.moving ? (this.crouched ? 0.12 : this.sprinting ? 1 : 0.42) : 0,
      );
    }
    if (this.pushingDoor) {
      this.sprinting = false;
      this.noise = Math.max(this.noise,.5);
      if (this.stamina === 0 && !this.exhausted) { this.exhausted=true; this.audio.cue("breath"); }
    } else if (this.sprinting && this.moving) {
      this.stamina = Math.max(0, this.stamina - dt);
      if (this.stamina === 0) {
        this.exhausted = true;
        this.audio.cue("breath");
      }
    } else
      this.stamina = Math.min(
        this.config.sprintCapacity,
        this.stamina +
          dt * this.config.sprintRecovery * (this.moving ? 0.55 : 1),
      );
    if (this.moving && this.physics.grounded) {
      this.stepTime += dt;
      const interval =
        this.config.footstepInterval *
        (this.sprinting ? 0.68 : this.crouched ? 1.45 : 1);
      if (this.stepTime > interval) {
        const wood =
          this.position.z < -62 ||
          (Math.abs(this.position.x) > 3 && this.position.x < 15);
        this.audio.cue(wood ? "footstepWood" : "footstep", {
          x: this.position.x,
          y: this.physics.feet + 0.06,
          z: this.position.z,
        });
        this.stepTime = 0;
      }
      this.bob += dt * (this.sprinting ? 12 : 8);
    } else this.bob = THREE.MathUtils.lerp(this.bob, 0, dt * 5);
    this.syncCamera(dt);
  }
  syncCamera(dt) {
    this.camera.position.copy(this.position);
    this.camera.position.y +=
      (this.moving && this.physics.grounded
        ? Math.sin(this.bob) * 0.026 * (this.config.cameraShake ?? 0.7)
        : 0) -
      this.physics.landing * (this.config.cameraShake ?? 1);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
