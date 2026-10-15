import * as THREE from "../../vendor/three.module.js";
/** Paper relief stays outside the wall; state variants restore a flat clean sheet. */
export function paperGeometry(width = 2.25, height = 1.5, seed = 1) {
  const g = new THREE.PlaneGeometry(width, height, 32, 20),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      u = x / width + 0.5,
      v = y / height + 0.5;
    const edge = Math.pow(
      Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2,
      8,
    );
    const fold =
      Math.exp(-Math.pow((u - 0.44) / 0.028, 2)) * 0.009 +
      Math.exp(-Math.pow((v - 0.58) / 0.026, 2)) * 0.006;
    p.setZ(
      i,
      0.004 +
        edge * (0.014 + 0.009 * Math.sin(u * 24 + v * 17 + seed)) +
        fold +
        Math.sin(u * 21 + seed) * Math.sin(v * 29) * 0.002,
    );
  }
  g.computeVertexNormals();
  return g;
}
export function paperMask(seed = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#fff";
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(3 + Math.abs(Math.sin(i * 4.7 + seed)) * 4, t * 256);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(t * 256, 250 - Math.abs(Math.sin(i * 2.3 + seed)) * 5);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo(250 - Math.abs(Math.sin(i * 3.8 + seed)) * 5, (1 - t) * 256);
  }
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    g.lineTo((1 - t) * 256, 3 + Math.abs(Math.sin(i * 3.1 + seed)) * 4);
  }
  g.closePath();
  g.fill();
  const texture = new THREE.CanvasTexture(c);
  return texture;
}
