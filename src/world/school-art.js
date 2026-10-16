import * as THREE from "../../vendor/three.module.js";
import { paperGeometry, paperMask } from "./aged-paper.js";
export const SCHOOL_ART = {
  haunted: "assets/images/staff-photograph-v81.png",
  hauntedRooms: "assets/images/school-contact-haunted-v8.png",
  friendly: "assets/images/school-contact-friendly-v8.png",
  classroom: "assets/images/classroom-photo-v9.png",
  stairs: "assets/images/stairwell-photo-v9.png",
  window: "assets/images/window-photo-v9.png",
  gym: "assets/images/gym-photo-v9.png",
};
const textures = new Map(
  Object.keys(SCHOOL_ART).map((id) => [id, new THREE.Texture()]),
);
export const BLOOD_ART = {
  "YOU LEFT HER": "assets/images/blood-left-v9.png",
  "SHE WAITED": "assets/images/blood-waited-v9.png",
  "YOU WENT HOME": "assets/images/blood-home-v9.png",
};
const bloodTextures = new Map(
  Object.keys(BLOOD_ART).map((id) => [id, new THREE.Texture()]),
);
export async function loadSchoolArt() {
  const loader = new THREE.TextureLoader();
  await Promise.all([
    ...Object.entries(SCHOOL_ART).map(async ([id, path]) =>
      textures.set(id, await loader.loadAsync(path)),
    ),
    ...Object.entries(BLOOD_ART).map(async ([id, path]) =>
      bloodTextures.set(id, await loader.loadAsync(path)),
    ),
  ]);
  for (const t of [...textures.values(), ...bloodTextures.values()]) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
  }
}
export function schoolArtTexture(id) {
  return textures.get(id);
}
const horror = {
  ruined: { visible: true },
  burned: { visible: true },
  distorted: { visible: true },
  normal: { visible: false },
  memory: { visible: false },
};
export function addSchoolArt({ scene, env, textPlane, box, interactables }) {
  const photos = [],
    writing = [],
    friendlyProps = [];
  for (const [id, x, z, rotation, room, art] of [
    ["office", 14.85, -20, -Math.PI / 2, "office", "classroom"],
    ["archive", -14.85, -38, Math.PI / 2, "archive", "gym"],
    ["phone", 14.85, -43, -Math.PI / 2, "phone", "window"],
    ["entrance", -6.66, 6.4, Math.PI / 2, "school", "haunted"],
    ["corridor", 2.85, -29.1, -Math.PI / 2, "school", "stairs"],
    ["classroom", -13.4, -24.85, 0, "classroom", "hauntedRooms"],
  ]) {
    const image = textures.get(art),
      friendly = textures.get("friendly"),
      damaged = paperGeometry(2.25, 1.5, photos.length + 1),
      clean = new THREE.PlaneGeometry(2.25, 1.5),
      mask = paperMask(photos.length + 1);
    const panel = new THREE.Mesh(
      damaged,
      new THREE.MeshStandardMaterial({
        map: image,
        alphaMap: mask,
        alphaTest: 0.35,
        emissive: 0xffffff,
        emissiveMap: image,
        emissiveIntensity: 0.15,
        roughness: 0.91,
        side: THREE.DoubleSide,
      }),
    );
    panel.position.set(x, 1.9, z);
    panel.rotation.y = rotation;
    scene.add(panel);
    const variants = {};
    for (const state of ["ruined", "burned", "distorted", "normal", "memory"])
      variants[state] = {
        color: ["normal", "memory"].includes(state) ? 0xffffff : 0xd7cbb7,
        geometry: ["normal", "memory"].includes(state) ? clean : damaged,
        material: {
          map: ["normal", "memory"].includes(state) ? friendly : image,
          emissiveMap: ["normal", "memory"].includes(state) ? friendly : image,
          alphaMap: ["normal", "memory"].includes(state) ? null : mask,
          roughness: ["normal", "memory"].includes(state) ? 0.58 : 0.91,
        },
      };
    env.register(panel, "photograph", room, variants);
    photos.push(panel);
    interactables.push({
      id: "gallery_" + id,
      label: "Inspect school photographs",
      mesh: panel,
      position: panel.position.clone(),
      room,
      type: "gallery",
      horrorImage: SCHOOL_ART[art],
      aged: true,
      enabled: true,
    });
  }
  for (const [text, x, y, z, rotation, room, width=2.2, height=.55] of [
    ["YOU LEFT HER", 2.86, 3.12, -23, -Math.PI / 2, "school"],
    ["SHE WAITED", -2.86, 1.9, -47, Math.PI / 2, "school"],
    ["YOU WENT HOME", 14.84, 1.9, -34.5, -Math.PI / 2, "phone"],
    ["SHE WAITED", -2.86, 3.12, -10.5, Math.PI / 2, "school"],
    ["YOU LEFT HER", 2.86, 1.9, -31.65, -Math.PI / 2, "school"],
    ["YOU LEFT HER", -9, 2.05, -24.82, 0, "classroom",4.5,1.1],
    ["YOU WENT HOME", 9, 2.05, -44.82, 0, "phone",4.5,1.1],
  ]) {
    const ink = bloodTextures.get(text);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        map: ink,
        emissive: 0xffffff,
        emissiveMap: ink,
        emissiveIntensity: 0.12,
        transparent: true,
        depthWrite: false,
        roughness: 0.43,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    );
    panel.position.set(x, y, z);
    panel.rotation.y = rotation;
    scene.add(panel);
    panel.userData.writing=text;
    env.register(panel, "wall-writing", room, horror);
    writing.push(panel);
  }
  for (const [text, x, z, rotation] of [
    ["BE KIND", 2.84, -8, -Math.PI / 2],
    ["WELCOME TO SCHOOL", -2.84, -27, Math.PI / 2],
    ["ART CLUB · MUSIC · SPORT", 2.84, -50, -Math.PI / 2],
  ]) {
    const poster = textPlane(
      text,
      x,
      2,
      z,
      1.75,
      0.7,
      rotation,
      "#28463c",
      "#e5d4a2",
      36,
    );
    env.register(poster, "friendly-poster", "school", {
      normal: { visible: true },
      memory: { visible: true },
      ruined: { visible: false },
      burned: { visible: false },
      distorted: { visible: false },
    });
    friendlyProps.push(poster);
  }
  return { photos, writing, friendlyProps };
}
