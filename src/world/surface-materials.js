import * as THREE from "../../vendor/three.module.js";
const banks = new Map();
const roleKinds = {
  wall: "paint",
  ceiling: "paint",
  floor: "tile",
  desk: "wood",
  locker: "metal",
  trim: "metal",
};
/** Colour, relief and roughness vary with environment state; physical UVs keep surface scale consistent. */
function maps(kind, clean = false, burned = false) {
  const key = kind + clean + burned;
  if (banks.has(key)) return banks.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d");
  c.fillStyle = burned
    ? "#68645e"
    : kind === "wood"
      ? "#b5a999"
      : kind === "metal"
        ? "#cacdd0"
        : "#cececa";
  c.fillRect(0, 0, 512, 512);
  let seed = 1123 + kind.length * 71;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 16000; i++) {
    const v = Math.floor(95 + rng() * 100),
      a = clean ? 0.04 : 0.15;
    c.fillStyle = `rgba(${v},${v},${v},${rng() * a})`;
    c.fillRect(rng() * 512, rng() * 512, 1 + rng() * 3, 1 + rng() * 3);
  }
  if (kind === "tile") {
    c.strokeStyle = clean ? "#969c9840" : "#626965";
    c.lineWidth = 2;
    for (let i = 0; i < 512; i += 128) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 512);
      c.moveTo(0, i);
      c.lineTo(512, i);
      c.stroke();
    }
  } else if (kind === "wood") {
    c.strokeStyle = "#5b514629";
    c.lineWidth = 0.7;
    for (let y = 0; y < 512; y += 4) {
      c.beginPath();
      for (let x = 0; x <= 512; x += 12)
        c.lineTo(x, y + Math.sin(x * 0.025 + y * 0.08) * 1.5);
      c.stroke();
    }
  }
  if (!clean) {
    for (let i = 0; i < 85; i++) {
      c.fillStyle = burned ? "rgba(12,10,8,.28)" : "rgba(57,54,39,.13)";
      c.beginPath();
      c.ellipse(
        rng() * 512,
        rng() * 512,
        3 + rng() * 30,
        8 + rng() * 90,
        rng() * 3,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    if (kind === "paint")
      for (let i = 0; i < 20; i++) {
        let x = rng() * 512,
          y = rng() * 512;
        c.strokeStyle = "#3c3e3b60";
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x, y);
        for (let j = 0; j < 9; j++) {
          x += (rng() - 0.5) * 16;
          y += rng() * 17;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    if (kind === "metal")
      for (let i = 0; i < 60; i++) {
        c.fillStyle = "#69544455";
        c.fillRect(rng() * 512, rng() * 512, 1 + rng() * 3, 3 + rng() * 40);
      }
  }
  const color = new THREE.CanvasTexture(canvas);
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.colorSpace = THREE.SRGBColorSpace;
  const relief = color.clone();
  relief.colorSpace = THREE.NoColorSpace;
  relief.needsUpdate = true;
  const result = {
    map: color,
    bumpMap: relief,
    bumpScale: clean ? 0.0005 : kind === "paint" ? 0.008 : 0.0025,
    roughness:
      kind === "metal"
        ? 0.43
        : kind === "tile"
          ? clean
            ? 0.34
            : 0.48
          : kind === "wood"
            ? 0.64
            : 0.91,
    metalness: kind === "metal" ? 0.46 : 0,
  };
  banks.set(key, result);
  return result;
}
export function surfaceVariants(role) {
  const kind = roleKinds[role];
  if (!kind) return null;
  if (role === 'locker') {
    const enamel = {map:null,bumpMap:null,bumpScale:0,roughness:.93,metalness:.08,envMapIntensity:.04};
    return Object.fromEntries(['ruined','normal','memory','burned','distorted'].map(state=>[state,{material:enamel}]));
  }
  const dirty = maps(kind),
    clean = maps(kind, true),
    burned = maps(kind, false, true);
  return {
    ruined: { material: dirty },
    normal: { material: clean },
    memory: { material: clean },
    burned: { material: burned },
    distorted: { material: dirty },
  };
}
export function physicalBoxGeometry(base, w, h, d, role) {
  if (!roleKinds[role]) return base;
  const g = base.clone(),
    p = g.attributes.position,
    n = g.attributes.normal,
    uv = g.attributes.uv;
  const tile =
    role === "floor" ? 1.5 : role === "wall" || role === "ceiling" ? 2 : 0.7;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getX(i)) > 0.5)
      uv.setXY(
        i,
        ((p.getZ(i) + 0.5) * d) / tile,
        ((p.getY(i) + 0.5) * h) / tile,
      );
    else if (Math.abs(n.getY(i)) > 0.5)
      uv.setXY(
        i,
        ((p.getX(i) + 0.5) * w) / tile,
        ((p.getZ(i) + 0.5) * d) / tile,
      );
    else
      uv.setXY(
        i,
        ((p.getX(i) + 0.5) * w) / tile,
        ((p.getY(i) + 0.5) * h) / tile,
      );
  }
  return g;
}
