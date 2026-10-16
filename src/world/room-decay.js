import * as THREE from "../../vendor/three.module.js";
import { paperGeometry } from "./aged-paper.js";
const variants = {
  ruined: { visible: true },
  burned: { visible: true },
  distorted: { visible: true },
  normal: { visible: false },
  memory: { visible: false },
};
/** Decorative relief only; never shifts furniture, colliders or story artifacts. */
export function addRoomDecay(scene, env) {
  const result = [];
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  for (let i = 0; i < 150; i++) {
    c.fillStyle = `rgba(27,31,22,${0.05 + (i % 7) * 0.025})`;
    c.beginPath();
    c.ellipse(
      (i * 137) % 512,
      (i * 79) % 256,
      12 + (i % 23),
      7 + (i % 19),
      i,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = 512;
  boardCanvas.height = 256;
  const chalk = boardCanvas.getContext("2d");
  for (let i = 0; i < 55; i++) {
    chalk.strokeStyle = `rgba(186,187,151,${0.07 + (i % 6) * 0.025})`;
    chalk.lineWidth = 1 + (i % 3);
    chalk.beginPath();
    chalk.moveTo((i * 43) % 512, (i * 89) % 256);
    chalk.lineTo(
      ((i * 43) % 512) + 14 + (i % 30),
      ((i * 89) % 256) + Math.sin(i) * 12,
    );
    chalk.stroke();
  }
  const chalkMap = new THREE.CanvasTexture(boardCanvas);
  chalkMap.colorSpace = THREE.SRGBColorSpace;
  const stain = new THREE.CanvasTexture(canvas);
  stain.colorSpace = THREE.SRGBColorSpace;
  for (const [cx, cz, room] of [
    [-9, -18, "classroom"],
    [9, -38, "phone"],
  ]) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(5.7, 1.4),
      new THREE.MeshStandardMaterial({
        map: chalkMap,
        transparent: true,
        depthWrite: false,
        roughness: 1,
      }),
    );
    board.position.set(cx, 2.05, room==='classroom'?-24.825:-44.825);
    scene.add(board);
    env.register(board, "chalk-residue", room, variants);
    result.push(board);
    for (const [dx, y, w, h] of [
      [-3, 2.4, 1.5, 1.8],
      [3.8, 2.4, 1.8, 2],
      [0, 3.3, 4.5, 0.7],
    ]) {
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: stain,
          transparent: true,
          depthWrite: false,
          roughness: 1,
        }),
      );
      p.position.set(cx + dx, y, cz - 6.85);
      scene.add(p);
      env.register(p, "damp-stain", room, variants);
      result.push(p);
    }
    for (let i = 0; i < 7; i++) {
      const p = new THREE.Mesh(
        paperGeometry(0.16, 0.22, i + 2),
        new THREE.MeshStandardMaterial({
          color: 0x8c8160,
          roughness: 1,
          side: THREE.DoubleSide,
        }),
      );
      p.rotation.set(-Math.PI / 2, 0, i * 0.9);
      p.position.set(cx - 4.3 + (i % 3) * 0.22, 0.018, cz - 3.5 + i * 0.3);
      scene.add(p);
      env.register(p, "old-paper", room, {
        ...variants,
        ruined: { visible: true, color: 0xada083 },
        burned: { visible: true, color: 0x665342 },
        distorted: { visible: true, color: 0x998d74 },
      });
      result.push(p);
    }
  }
  return result;
}
