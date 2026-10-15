import * as THREE from "../../vendor/three.module.js";
export const FACE_ASSETS = {
  teacher: "assets/images/teacher-face-v13.png",
  teacherAttack: "assets/images/teacher-capture-v13.png",
  shadow: "assets/images/shadow-face-v10.png",
};
const textures = new Map();
export async function loadFaceSurfaces() {
  await Promise.all(
    Object.entries(FACE_ASSETS).map(async ([id, path]) => {
      const texture = await new THREE.TextureLoader().loadAsync(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      textures.set(id, texture);
    }),
  );
}
/** A real curved skull with a diffuse photographic projection and restrained jaw deformation. */
export function createFaceSurface(variant, skin) {
  const texture = textures.get(variant === "teacher" ? "teacher" : "shadow");
  if (!texture?.image) return null;
  const root = new THREE.Group(),
    geometry = new THREE.SphereGeometry(1, 80, 56);
  const p = geometry.attributes.position;
  const gauss = (x, y, cx, cy, sx, sy) =>
    Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 0.125,
      y = p.getY(i) * 0.165,
      front = Math.max(0, -p.getZ(i));
    const nose = gauss(x, y, 0, -0.018, 0.02, 0.056) * 0.045;
    const sockets =
      (gauss(x, y, -0.043, 0.033, 0.028, 0.023) +
        gauss(x, y, 0.043, 0.033, 0.028, 0.023)) *
      0.016;
    const cheeks =
      (gauss(x, y, -0.062, -0.025, 0.04, 0.035) +
        gauss(x, y, 0.062, -0.025, 0.04, 0.035)) *
      0.01;
    p.setXYZ(
      i,
      x * (y < -0.04 ? 0.88 : 1),
      y,
      p.getZ(i) * 0.105 - front * (nose - sockets * 1.35 + cheeks * 0.45),
    );
  }
  geometry.computeVertexNormals();
  const uv = geometry.attributes.uv;
  for (let i = 0; i < p.count; i++)
    uv.setXY(
      i,
      Math.max(0.001, Math.min(0.999, p.getX(i) / 0.27 + 0.5)),
      Math.max(0.001, Math.min(0.999, p.getY(i) / 0.33 + 0.5)),
    );
  const jawOpen = { value: 0 };
  const attackTexture =
    variant === "teacher" ? textures.get("teacherAttack") || texture : texture;
  skin = skin.clone();
  skin.map = null;
  skin.bumpMap = texture.clone();
  skin.bumpMap.colorSpace = THREE.NoColorSpace;
  skin.bumpMap.needsUpdate = true;
  skin.bumpScale = 0.0008;
  skin.color.setHex(0xffffff);
  skin.roughness = 0.68;
  skin.clearcoat = 0.16;
  skin.clearcoatRoughness = 0.34;
  skin.onBeforeCompile = (shader) => {
    shader.uniforms.facePhoto = { value: texture };
    shader.uniforms.faceAttack = { value: attackTexture };
    shader.uniforms.faceJaw = jawOpen;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 faceUv;varying float faceFront;uniform float faceJaw;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      faceUv=vec2(position.x/.27+.5,position.y/.33+.5);faceFront=smoothstep(.012,.07,-position.z);
      transformed.y-=faceJaw*.018*(1.-smoothstep(-.14,-.055,position.y));
      transformed.z+=faceJaw*.008*(1.-smoothstep(-.14,-.055,position.y));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 faceUv;varying float faceFront;uniform sampler2D facePhoto;uniform sampler2D faceAttack;uniform float faceJaw;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      vec2 uv=clamp(faceUv,.001,.999);
      vec3 portrait=mix(texture2D(facePhoto,uv).rgb,texture2D(faceAttack,uv).rgb,smoothstep(.12,.65,faceJaw));
      diffuseColor.rgb*=mix(vec3(.36,.32,.29),portrait,faceFront);`,
      );
  };
  skin.customProgramCacheKey = () => "photographic-face-v12";
  const skull = new THREE.Mesh(geometry, skin);
  skull.castShadow = skull.receiveShadow = true;
  root.add(skull);
  const edge = new THREE.MeshPhysicalMaterial({
    color: variant === "teacher" ? 0x897b6e : 0x77726a,
    roughness: 0.78,
    clearcoat: 0.08,
  });
  const shape = (mat, position, scale) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), mat);
    m.position.fromArray(position);
    m.scale.fromArray(scale);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    return m;
  };
  for (const side of [-1, 1]) {
    shape(edge, [side * 0.122, -0.013, 0.018], [0.018, 0.042, 0.023]);
    shape(edge, [side * 0.132, -0.012, 0.013], [0.008, 0.026, 0.012]);
  }
  const hair = new THREE.MeshStandardMaterial({
    color: variant === "teacher" ? 0x292721 : 0x36342e,
    roughness: 0.96,
  });
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 28, 0, Math.PI * 2, 0, Math.PI * 0.53),
    hair,
  );
  cap.position.set(0, 0.063, 0.025);
  cap.scale.set(0.123, 0.109, 0.096);
  cap.castShadow = cap.receiveShadow = true;
  root.add(cap);
  if (variant === "teacher")
    shape(hair, [0, 0.065, 0.119], [0.062, 0.067, 0.042]);
  const jaw = new THREE.Group();
  root.add(jaw);
  // Keep a separate jaw anchor for the shared performance layer; no exaggerated chattering.
  root.userData = {
    skin,
    jaw,
    teeth: [],
    photographic: true,
    jawOpen,
    skull,
    texture,
    attackTexture,
    gazePoint: new THREE.Vector3(0, 0.025, -0.12),
  };
  return root;
}
