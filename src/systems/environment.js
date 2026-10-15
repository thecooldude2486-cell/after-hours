import * as THREE from "../../vendor/three.module.js";
export const PALETTES = {
  ruined: {
    wall: 0x666d65,
    window: 0x496573,
    trim: 0x223c35,
    floor: 0x373e3d,
    desk: 0x493f30,
    locker: 0x314944,
    ceiling: 0x646a62,
    fog: 0x080f13,
    ambient: 0x637a8c,
    intensity: 0.075,
  },
  normal: {
    wall: 0xe1dfcb,
    window: 0xc3e0e5,
    trim: 0x477061,
    floor: 0x7d8171,
    desk: 0x927344,
    locker: 0x638176,
    ceiling: 0xf0edde,
    fog: 0xc4d3ce,
    ambient: 0xffe4b2,
    intensity: 2.0,
  },
  memory: {
    wall: 0xe1d9b8,
    window: 0xc3e0e5,
    trim: 0x647560,
    floor: 0x7f7561,
    desk: 0x9a7545,
    locker: 0x778575,
    ceiling: 0xc9b996,
    fog: 0xc8c5af,
    ambient: 0xffd19b,
    intensity: 2.1,
  },
  burned: {
    wall: 0x3b352f,
    window: 0x4b514f,
    trim: 0x282522,
    floor: 0x292827,
    desk: 0x372b24,
    locker: 0x302e2b,
    ceiling: 0x3c3630,
    fog: 0x180e0a,
    ambient: 0xd07548,
    intensity: 0.065,
  },
  distorted: {
    wall: 0x524b41,
    window: 0x496573,
    trim: 0x383c33,
    floor: 0x292d2b,
    desk: 0x453928,
    locker: 0x374039,
    ceiling: 0x4b4841,
    fog: 0x131311,
    ambient: 0xd4a37a,
    intensity: 0.085,
  },
};
export class EnvironmentSystem {
  constructor(scene, ambient, config) {
    this.scene = scene;
    this.ambient = ambient;
    this.config = config;
    this.entries = [];
    this.state = "ruined";
    this.mix = 1;
    this.roomStates = new Map();
    this.change = null;
    this.reflectionMaps = null;
  }
  register(mesh, role, room = "school", variants = null) {
    this.entries.push({
      mesh,
      role,
      room,
      variants,
      basePosition: mesh.position.clone(),
      baseScale: mesh.scale.clone(),
      from: mesh.material?.color?.clone(),
      target: new THREE.Color(PALETTES.ruined[role] || 0xffffff),
    });
    return mesh;
  }
  set(state, room = "school", immediate = false) {
    if (!PALETTES[state]) throw new Error("Unknown environment state " + state);
    if (room === "school") {
      this.state = state;
      this.roomStates.clear();
    } else this.roomStates.set(room, state);
    this.mix = immediate ? 1 : 0;
    if (this.reflectionMaps)
      this.scene.environment =
        this.reflectionMaps[
          ["normal", "memory"].includes(this.state) ? "friendly" : "ruined"
        ];
    for (const e of this.entries) {
      const active = this.roomStates.get(e.room) || this.state;
      e.from = e.mesh.material?.color?.clone();
      e.target.setHex(PALETTES[active][e.role] || 0xffffff);
      if (e.variants) {
        const v = e.variants[active] || {};
        if (v.color !== undefined) e.target.setHex(v.color);
        e.mesh.visible = !e.mesh.userData.collisionOnly && v.visible !== false;
        if (v.geometry) e.mesh.geometry = v.geometry;
        if (v.material && e.mesh.material) {
          Object.assign(e.mesh.material, v.material);
          e.mesh.material.needsUpdate = true;
        }
        e.mesh.scale.copy(e.baseScale).multiplyScalar(v.scale || 1);
      }
    }
    this.fromDensity = this.scene.fog.density;
    this.targetDensity = ["normal", "memory"].includes(this.state)
      ? 0.004
      : 0.022;
    this.fromFog = this.scene.fog.color.clone();
    this.targetFog = new THREE.Color(PALETTES[this.state].fog);
    this.fromAmbient = this.ambient.color.clone();
    this.targetAmbient = new THREE.Color(PALETTES[this.state].ambient);
    this.startIntensity = this.ambient.intensity;
    this.fromReflection = this.scene.environmentIntensity;
    this.targetReflection = ["normal", "memory"].includes(this.state) ? 1 : 0.075;
    this.targetIntensity = PALETTES[this.state].intensity;
    this.apply();
  }
  apply() {
    const t = this.mix * this.mix * (3 - 2 * this.mix);
    for (const e of this.entries)
      if (e.from && e.mesh.material?.color)
        e.mesh.material.color.lerpColors(e.from, e.target, t);
    if (this.targetFog) {
      this.scene.fog.color.lerpColors(this.fromFog, this.targetFog, t);
      this.scene.background.copy(this.scene.fog.color);
      this.scene.fog.density = THREE.MathUtils.lerp(
        this.fromDensity,
        this.targetDensity,
        t,
      );
      this.ambient.color.lerpColors(this.fromAmbient, this.targetAmbient, t);
      this.scene.environmentIntensity = THREE.MathUtils.lerp(this.fromReflection, this.targetReflection, t);
      this.ambient.intensity = THREE.MathUtils.lerp(
        this.startIntensity,
        this.targetIntensity,
        t,
      );
    }
  }
  update(dt, time) {
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / this.config.transitionDuration);
      this.apply();
    }
    for (const e of this.entries) {
      if (e.role === "ceiling") {
        e.mesh.position.copy(e.basePosition);
        if (this.state === "distorted")
          e.mesh.position.y += Math.sin(time + e.basePosition.z) * 0.05;
      }
    }
  }
}
