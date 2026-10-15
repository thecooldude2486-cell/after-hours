import { segmentBlocked } from "../world/push-doors.js";
export function blocked(x, z, obstacles, radius = 0.23) {
  return obstacles.some(
    (o) =>
      o.enabled !== false &&
      (o.segment ? segmentBlocked(x,z,o.segment,radius) :
      x + radius > o.minX && x - radius < o.maxX &&
      z + radius > o.minZ && z - radius < o.maxZ),
  );
}
export function slide(position, dx, dz, obstacles, radius = 0.23) {
  // Substeps keep sprinting and low-frame-rate movement from tunnelling through thin walls.
  const count = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.12),
  );
  for (let i = 0; i < count; i++) {
    if (!blocked(position.x + dx / count, position.z, obstacles, radius))
      position.x += dx / count;
    if (!blocked(position.x, position.z + dz / count, obstacles, radius))
      position.z += dz / count;
  }
  return position;
}
export function lineClear(a, b, obstacles) {
  const dist = Math.hypot(b.x - a.x, b.z - a.z),
    steps = Math.ceil(dist / 0.22);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y =
      Number.isFinite(a.y) && Number.isFinite(b.y)
        ? a.y + (b.y - a.y) * t
        : null;
    const occluders =
      y === null
        ? obstacles
        : obstacles.filter(
            (o) => y > (o.minY ?? -Infinity) && y < (o.maxY ?? Infinity),
          );
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, occluders, 0.02))
      return false;
  }
  return true;
}
export class Navigation {
  constructor(obstacles) {
    this.obstacles = obstacles;
    this.cell = 0.5;
    this.bounds = { minX: -44, maxX: 34, minZ: -80, maxZ: 22 };
  }
  key(x, z) {
    return `${x},${z}`;
  }
  cellOf(p) {
    return { x: Math.round(p.x / this.cell), z: Math.round(p.z / this.cell) };
  }
  world(p) {
    return { x: p.x * this.cell, z: p.z * this.cell };
  }
  valid(p) {
    const w = this.world(p),
      b = this.bounds;
    return (
      w.x > b.minX &&
      w.x < b.maxX &&
      w.z > b.minZ &&
      w.z < b.maxZ &&
      !blocked(w.x, w.z, this.obstacles.filter(o => (o.minY ?? 0) < 2.1), 0.29)
    );
  }
  path(start, end) {
    const s = this.cellOf(start),
      goal = this.cellOf(end),
      key = this.key.bind(this),
      front = [s],
      cost = new Map([[key(s.x, s.z), 0]]),
      parent = new Map();
    const h = (p) => Math.abs(p.x - goal.x) + Math.abs(p.z - goal.z);
    // Cache within one route only: door changes must be visible to the next route.
    const walkable = new Map();
    const canWalk = (p) => {
      const k = key(p.x, p.z);
      if (!walkable.has(k)) walkable.set(k, this.valid(p));
      return walkable.get(k);
    };
    const stopDistance = canWalk(goal) ? 0 : 1;
    let found = null,
      iterations = 0;
    while (front.length && iterations++ < 14000) {
      front.sort(
        (a, b) =>
          cost.get(key(a.x, a.z)) + h(a) - (cost.get(key(b.x, b.z)) + h(b)),
      );
      const p = front.shift();
      if (h(p) === stopDistance) {
        found = p;
        break;
      }
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const n = { x: p.x + dx, z: p.z + dz },
          k = key(n.x, n.z),
          v = cost.get(key(p.x, p.z)) + 1;
        if (!canWalk(n) || (cost.has(k) && cost.get(k) <= v)) continue;
        cost.set(k, v);
        parent.set(k, p);
        front.push(n);
      }
    }
    if (!found) return [];
    const route = [];
    let p = found;
    while (key(p.x, p.z) !== key(s.x, s.z)) {
      route.push(this.world(p));
      p = parent.get(key(p.x, p.z));
      if (!p) break;
    }
    return route.reverse();
  }
}
