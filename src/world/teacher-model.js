import { createScareFace, horrorMaterial } from "./horror-detail.js";
import { applyScarePose } from "./scare-motion.js";
import * as THREE from "../../vendor/three.module.js";
import { createMara, animateMara } from "./mara.js";
import { dressTeacher } from "./teacher-body.js";
const material = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
// Accessories are attached in school units, then converted to the authored bone's local space.
function accessory(root, bone, geometry, mat, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.fromArray(position);
  mesh.scale.fromArray(scale);
  mesh.castShadow = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  bone?.attach(mesh);
  return mesh;
}
function charred(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vBurnPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvBurnPosition = position;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vBurnPosition;
        float valeHash(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
        float valeNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(valeHash(i),valeHash(i+vec3(1,0,0)),f.x),mix(valeHash(i+vec3(0,1,0)),valeHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(valeHash(i+vec3(0,0,1)),valeHash(i+vec3(1,0,1)),f.x),mix(valeHash(i+vec3(0,1,1)),valeHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float scar = valeNoise(vBurnPosition*17.0)*.65+valeNoise(vBurnPosition*61.0)*.25+valeNoise(vBurnPosition*139.0)*.1;
        float ash = smoothstep(.26,.73,scar);
        diffuseColor.rgb *= mix(vec3(.12,.095,.085),vec3(.78,.72,.64),ash);`,
      );
  };
  mat.customProgramCacheKey = () => "vale-charred-v5";
  return mat;
}
/** Mrs Vale now uses an independent authored, skinned human mesh, with a formal outfit and bone animation. */
export function createTeacher(kind = "teacher") {
  const burned = kind === "teacher",
    root = createMara(),
    r = root.userData;
  root.name = burned ? "The Teacher / Mrs Vale" : "Mrs Vale / memory";
  r.kind = kind;
  r.teacher = burned;
  const bones = (name) => r.model.getObjectByName(name);
  r.joints = {
    arms: [bones("UpperArmL"), bones("UpperArmR")],
    legs: [bones("UpperLegL"), bones("UpperLegR")],
  };
  animateMara(root, 0.01, 0);
  root.updateMatrixWorld(true);
  r.model.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material.name;
    o.material = o.material.clone(); // Never recolor Mara or the normal classroom teacher.
    const palette = {
      Skin: burned ? 0xb8ada0 : 0xd3b6a0,
      Hair_Brown: 0x5c5b56,
      Brown: 0x1b1c1a,
      White: burned ? 0x8b8779 : 0xd3d1bd,
      LightGreen: 0x525548,
      Green: 0x34382f,
      Brown2: 0x252723,
      Brown_02: 0x2a2c29,
      Gold: 0x757269,
    };
    o.material.color.setHex(palette[name] ?? 0x42453b);
    o.material.roughness = 0.92;
    if (burned) {
      const detail = horrorMaterial(name === "Skin" ? "skin" : "cloth");
      o.material.map = detail.map;
      o.material.bumpMap = detail.bumpMap;
      o.material.bumpScale = detail.bumpScale;
      charred(o.material);
      if (o.isSkinnedMesh && o.geometry.index) {
        // Replace the original low-detail head, preserving the independent body rig and neck.
        const headIndex = o.skeleton.bones.indexOf(r.head),
          indices = o.geometry.index;
        const joints = o.geometry.attributes.skinIndex,
          weights = o.geometry.attributes.skinWeight;
        if (headIndex >= 0 && joints && weights) {
          const influence = (v) => {
            let sum = 0;
            for (let j = 0; j < 4; j++)
              if (joints.getComponent(v, j) === headIndex)
                sum += weights.getComponent(v, j);
            return sum;
          };
          const keep = [];
          for (let i = 0; i < indices.count; i += 3) {
            const a = indices.getX(i),
              b = indices.getX(i + 1),
              c = indices.getX(i + 2);
            if ((influence(a) + influence(b) + influence(c)) / 3 < 0.5)
              keep.push(a, b, c);
          }
          o.geometry = o.geometry.clone();
          o.geometry.setIndex(keep);
          if (!keep.length) o.visible = false;
        }
      }
    }
  });
  const dark = material(burned ? 0x252321 : 0x3c4642),
    ivory = material(0xbbb6a4),
    wire = material(0x9a9486, { metalness: 0.75, roughness: 0.32 });
  if (burned) {
    r.model.traverse((o) => {
      if (o.isSkinnedMesh) o.visible = false;
    });
    dressTeacher(root);
  }
  // A continuous tailored skirt replaces adventurer shorts and covers the top of the boots.
  const profile = [
    [0.23, 0.0],
    [0.245, 0.04],
    [0.228, 0.3],
    [0.19, 0.57],
    [0.18, 0.61],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const skirtGeometry = new THREE.LatheGeometry(profile, 64);
  const folds = skirtGeometry.attributes.position;
  for (let i = 0; i < folds.count; i++) {
    const a = Math.atan2(folds.getZ(i), folds.getX(i));
    const pleat = 1 + Math.sin(a * 18) * 0.024 * (1 - folds.getY(i));
    folds.setX(i, folds.getX(i) * pleat);
    folds.setZ(i, folds.getZ(i) * pleat);
  }
  skirtGeometry.computeVertexNormals();
  if (burned) {
    const vertices = skirtGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++)
      if (vertices.getY(i) < 0.075) {
        const a = Math.atan2(vertices.getZ(i), vertices.getX(i));
        vertices.setY(
          i,
          vertices.getY(i) - 0.035 - 0.045 * (0.5 + 0.5 * Math.sin(a * 9)),
        );
      }
    skirtGeometry.computeVertexNormals();
  }
  r.skirt = accessory(
    root,
    bones("Hips"),
    skirtGeometry,
    burned ? charred(dark) : dark,
    [0, 0.38, -0.055],
    [1, 1, 0.78],
  );
  for (const side of [-1, 1]) {
    const lens = accessory(
      root,
      r.head,
      new THREE.TorusGeometry(0.026, 0.0017, 10, 36),
      wire,
      [
        side * (burned ? 0.032 : 0.037),
        burned ? 1.513 : 1.545,
        burned ? -0.18 : -0.169,
      ],
      [1, 0.73, 1],
    );
    if (burned && side === 1) lens.rotation.z += 0.22;
  }
  accessory(root, r.head, new THREE.BoxGeometry(0.023, 0.003, 0.004), wire, [
    0,
    burned ? 1.513 : 1.545,
    burned ? -0.18 : -0.17,
  ]);
  for (const side of [-1, 1]) {
    const collar = accessory(
      root,
      bones("Chest"),
      new THREE.BoxGeometry(0.065, 0.12, 0.016),
      ivory,
      [side * 0.044, 1.27, -0.125],
    );
    collar.rotation.z += side * 0.3;
    const strap = accessory(
      root,
      bones("Chest"),
      new THREE.BoxGeometry(0.01, 0.25, 0.009),
      material(0x1d2b2e),
      [side * 0.033, 1.13, -0.149],
    );
    strap.rotation.z += side * 0.22;
  }
  for (let i = 0; i < 4; i++) {
    const button = accessory(
      root,
      bones("Chest"),
      new THREE.CylinderGeometry(0.009, 0.009, 0.004, 20),
      wire,
      [0, 1.08 + i * 0.045, -0.145],
    );
    button.rotation.x += Math.PI / 2;
  }
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#bdb9a7";
  ctx.fillRect(0, 0, 128, 160);
  ctx.fillStyle = "#273330";
  ctx.font = "bold 24px Arial";
  ctx.fillText("STAFF", 18, 38);
  ctx.font = "18px Arial";
  ctx.fillText("MRS VALE", 12, 135);
  ctx.fillRect(37, 51, 54, 56);
  const badge = accessory(
    root,
    bones("Chest"),
    new THREE.BoxGeometry(0.085, 0.115, 0.009),
    material(0xbab5a0),
    [0, 0.99, -0.155],
  );
  const label = accessory(
    root,
    bones("Chest"),
    new THREE.PlaneGeometry(0.079, 0.109),
    material(0xffffff, { map: new THREE.CanvasTexture(c) }),
    [0, 0.99, -0.161],
  );
  label.rotation.y += Math.PI;
  r.badge = badge;
  if (burned) {
    // Sculpted overlay follows the existing Head bone; memory actors keep their original face.
    const face = createScareFace("teacher");
    face.position.set(0, 1.49, -0.11);
    face.scale.set(0.69, 0.7, 0.83);
    root.add(face);
    root.updateMatrixWorld(true);
    r.head.attach(face);
    r.face = face;
    bones("WristL")?.scale.set(1, 1.04, 1);
    bones("WristR")?.scale.set(1, 1.04, 1);
    root.scale.setScalar(1.14);
  } else root.scale.setScalar(1.06);
  return root;
}
export function animateTeacher(root, dt, time) {
  // Undo the previous overlay before evaluating the next clip. Untracked bones
  // otherwise accumulate the head/chest tilt every frame and spin out of pose.
  for (const [bone, pose] of root.userData.teacherBasePose || [])
    bone.quaternion.copy(pose);
  animateMara(root, dt, time);
  const r = root.userData;
  if (!root.visible || !r.head) return;
  if (r.teacher) {
    if (r.current === r.actions.Walk)
      r.current.setEffectiveTimeScale(
        THREE.MathUtils.clamp((r.motionSpeed || 1.55) / 1.55, 0.7, 3),
      );
    r.teacherBasePose = [
      r.head,
      r.model.getObjectByName("Chest"),
      ...r.joints.arms,
    ]
      .filter(Boolean)
      .map((bone) => [bone, bone.quaternion.clone()]);
    r.head.rotateZ(0.1 + Math.sin(time * 0.63) * 0.008);
    r.head.rotateX(-0.12);
    r.model.getObjectByName("Chest")?.rotateZ(0.045);
    r.joints.arms[0]?.rotateZ(0.09);
    r.joints.arms[1]?.rotateZ(-0.14);
    if (r.mouth)
      r.mouth.scale.y =
        0.029 * (r.speaking ? 1.4 + Math.sin(time * 14) * 0.3 : 1);
  }
  applyScarePose(root, time);
}
