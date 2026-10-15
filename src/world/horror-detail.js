import { loadFaceSurfaces, createFaceSurface } from "./face-surface.js";
import * as THREE from "../../vendor/three.module.js";
const maps = new Map();
export const HORROR_SKIN = "assets/images/horror-skin-v9.png";
let paintedSkin = null;
export async function loadHorrorMaterials() {
  const color = await new THREE.TextureLoader().loadAsync(HORROR_SKIN);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.anisotropy = 4;
  const bump = color.clone();
  bump.colorSpace = THREE.NoColorSpace;
  bump.needsUpdate = true;
  paintedSkin = { color, bump };
  await loadFaceSurfaces();
}
/** Deterministic material detail. Shared textures, independent materials, no network assets. */
export function horrorMaterial(kind = "skin", color = 0x77736a) {
  if (!maps.has(kind)) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = kind === "cloth" ? "#777777" : "#aaaaaa";
    ctx.fillRect(0, 0, 256, 256);
    let seed = kind === "cloth" ? 371 : 917;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 6500; i++) {
      const value = 70 + Math.floor(random() * 110);
      ctx.fillStyle = `rgba(${value},${value},${value},${0.1 + random() * 0.35})`;
      const x = random() * 256,
        y = random() * 256;
      ctx.fillRect(
        x,
        y,
        kind === "cloth" ? 1 : 1 + random() * 3,
        kind === "cloth" ? 6 : 1 + random() * 3,
      );
    }
    for (let i = 0; i < 55; i++) {
      ctx.strokeStyle =
        kind === "cloth" ? "rgba(22,22,22,.3)" : "rgba(33,26,23,.45)";
      ctx.lineWidth = 0.4 + random();
      let x = random() * 256,
        y = random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 7; j++) {
        x += (random() - 0.5) * 16;
        y += random() * 9;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    maps.set(kind, texture);
  }
  const material = new THREE.MeshPhysicalMaterial({
    color,
    map: kind === "skin" && paintedSkin ? paintedSkin.color : maps.get(kind),
    bumpMap: kind === "skin" && paintedSkin ? paintedSkin.bump : maps.get(kind),
    bumpScale: kind === "cloth" ? 0.001 : 0.003,
    roughness: kind === "cloth" ? 0.94 : 0.71,
    metalness: 0,
    clearcoat: kind === "skin" ? 0.12 : 0,
    clearcoatRoughness: 0.5,
  });
  return material;
}
export function mesh(
  parent,
  geometry,
  material,
  position = [0, 0, 0],
  scale = [1, 1, 1],
) {
  const o = new THREE.Mesh(geometry, material);
  o.position.fromArray(position);
  o.scale.fromArray(scale);
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
}
export function ellipsoid(parent, material, p, s, detail = 28) {
  return mesh(parent, new THREE.SphereGeometry(1, detail, 20), material, p, s);
}
export function cord(parent, material, points, radius = 0.002) {
  return mesh(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      18,
      radius,
      5,
      false,
    ),
    material,
  );
}
/** Sculpted face with recessed sockets, separate eyeballs, lips, individual teeth and hinged jaw. Faces -Z. */
export function createScareFace(variant = "shadow") {
  const face = new THREE.Group();
  face.name = "Sculpted scare face";
  const skin = horrorMaterial(
    "skin",
    variant === "teacher" ? 0xc4baa5 : 0xb4b6a8,
  );
  const surface = createFaceSurface(variant, skin);
  if (surface) return surface;
  const crease = horrorMaterial("skin", 0x3c352e),
    black = new THREE.MeshStandardMaterial({
      color: 0x080807,
      roughness: 0.88,
    });
  const skull = new THREE.SphereGeometry(1, 64, 44),
    v = skull.attributes.position;
  for (let i = 0; i < v.count; i++) {
    const x = v.getX(i) * 0.113,
      y = v.getY(i) * 0.155,
      z = v.getZ(i) * 0.093;
    const front = Math.max(0, -v.getZ(i));
    const gauss = (cx, cy, sx, sy) =>
      Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
    const sockets =
      gauss(-0.043, 0.053, 0.026, 0.029) + gauss(0.043, 0.053, 0.026, 0.029);
    const nose = gauss(0, 0.015, 0.019, 0.052),
      cheeks =
        gauss(-0.071, -0.011, 0.023, 0.04) + gauss(0.071, -0.011, 0.023, 0.04);
    const mouth = gauss(0, -0.055, 0.047, 0.052);
    v.setXYZ(
      i,
      x * (1 + 0.07 * Math.sin(y * 65)) + front * Math.sin(y * 22) * 0.003,
      y + front * Math.sin(x * 23) * 0.004,
      z +
        front *
          (0.028 * sockets - 0.024 * nose - 0.01 * cheeks + 0.037 * mouth) +
        Math.sin(x * 240 + y * 135) * 0.0015 * front,
    );
  }
  skull.computeVertexNormals();
  mesh(face, skull, skin);
  // Deep cavities cover the recesses; wet eyeballs sit inside, rather than glowing dots on a flat face.
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xb9baa4,
    roughness: 0.1,
    clearcoat: 1,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x111612,
    roughness: 0.35,
  });
  for (const side of [-1, 1]) {
    const x = side * 0.043;
    ellipsoid(face, black, [x, 0.055, -0.081], [0.027, 0.022, 0.019]);
    ellipsoid(face, eyeMat, [x, 0.052, -0.096], [0.009, 0.0085, 0.007]);
    ellipsoid(
      face,
      pupilMat,
      [x + side * 0.002, 0.052, -0.104],
      [0.0036, 0.005, 0.002],
    );
    cord(
      face,
      skin,
      [
        [x - 0.025, 0.076, -0.084],
        [x, 0.081, -0.092],
        [x + 0.025, 0.075, -0.081],
      ],
      0.006,
    );
    cord(
      face,
      crease,
      [
        [x - side * 0.031, 0.039, -0.097],
        [x, 0.03, -0.096],
        [x + side * 0.024, 0.044, -0.092],
      ],
      0.0015,
    );
    for (let j = 0; j < 3; j++)
      cord(
        face,
        crease,
        [
          [x + side * 0.019, 0.032 - j * 0.009, -0.087],
          [x + side * 0.036, 0.018 - j * 0.009, -0.078],
          [x + side * 0.045, 0.004 - j * 0.006, -0.07],
        ],
        0.0005,
      );
  }
  ellipsoid(face, skin, [0, 0.003, -0.11], [0.014, 0.018, 0.013]);
  for (const side of [-1, 1])
    ellipsoid(
      face,
      black,
      [side * 0.009, -0.012, -0.111],
      [0.004, 0.003, 0.002],
    );
  ellipsoid(face, black, [0, -0.062, -0.081], [0.041, 0.052, 0.026]);
  const lip = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    lip.push([
      Math.sin(a) * 0.043,
      -0.061 + Math.cos(a) * 0.05,
      -0.099 + Math.abs(Math.sin(a)) * 0.012,
    ]);
  }
  cord(face, crease, lip, 0.003);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.034, -0.06);
  face.add(jaw);
  ellipsoid(jaw, skin, [0, -0.067, -0.014], [0.05, 0.023, 0.024]);
  const toothMat = new THREE.MeshStandardMaterial({
    color: 0xb0a786,
    roughness: 0.63,
  });
  const teeth = [];
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.0081,
      z = -0.095 + Math.abs(i - 4) * 0.002;
    const tooth = mesh(
      face,
      new THREE.CapsuleGeometry(0.0034, 0.007 + (i % 3) * 0.002, 4, 10),
      toothMat,
      [x, -0.028, z],
    );
    tooth.rotation.z = Math.PI + (i - 4) * 0.04;
    teeth.push(tooth);
    const lower = mesh(
      jaw,
      new THREE.CapsuleGeometry(0.0033, 0.006 + (i % 2) * 0.003, 4, 10),
      toothMat,
      [x, -0.04, z + 0.06],
    );
    lower.rotation.z = (i - 4) * 0.055;
    teeth.push(lower);
  }
  for (const side of [-1, 1]) {
    ellipsoid(face, skin, [side * 0.11, 0.009, -0.008], [0.018, 0.03, 0.012]);
    cord(
      face,
      crease,
      [
        [side * 0.087, 0.027, -0.05],
        [side * 0.07, -0.04, -0.092],
        [side * 0.058, -0.102, -0.063],
      ],
      0.003,
    );
  }
  const hair = horrorMaterial("cloth", 0x171b18);
  for (let i = 0; i < 32; i++) {
    const a = (i / 31) * Math.PI * 1.8 - 0.9,
      x = Math.sin(a) * 0.109,
      z = Math.cos(a) * 0.08;
    cord(
      face,
      hair,
      [
        [x * 0.45, 0.146, z * 0.3],
        [x, 0.093, z],
        [x * 1.1, -0.013 - (i % 4) * 0.013, z - 0.012],
        [x * 0.98, -0.084 - (i % 3) * 0.018, z - 0.025],
      ],
      0.0011 + (i % 3) * 0.0003,
    );
  }
  face.userData = { jaw, teeth, skin };
  return face;
}
export function animateScareFace(face, amount, time) {
  if (!face) return;
  if (face.userData.photographic) {
    face.userData.jawOpen.value = Math.min(1, Math.max(0, amount)) * 0.8;
    face.userData.jaw.rotation.x = amount * 0.24;
    return;
  }
  face.userData.jaw.rotation.x =
    0.06 + amount * 0.42 + Math.sin(time * 19) * 0.013 * amount;
  face.userData.jaw.rotation.z = Math.sin(time * 11) * 0.025 * amount;
}
