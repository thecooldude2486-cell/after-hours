/** Contact-driven hinged doors. Interaction releases the latch; only body motion opens it. */
const MAX_ANGLE = Math.PI * 0.48;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function doorShape(door) {
  const a = door.angle || 0, c = Math.cos(a), s = Math.sin(a);
  const x = door.baseAxis.x * c + door.baseAxis.z * s;
  const z = -door.baseAxis.x * s + door.baseAxis.z * c;
  const ax = door.hinge.position.x, az = door.hinge.position.z;
  const bx = ax + x * door.width, bz = az + z * door.width;
  return {ax, az, bx, bz, half: door.thickness / 2};
}
export function updatePushDoor(door) {
  door.angle = (door.swing || 1) * door.amount * MAX_ANGLE;
  door.hinge.rotation.y = (door.rotation || 0) + door.angle;
  const shape = doorShape(door), o = door.obstacle;
  o.segment = shape;
  o.minX = Math.min(shape.ax, shape.bx) - shape.half;
  o.maxX = Math.max(shape.ax, shape.bx) + shape.half;
  o.minZ = Math.min(shape.az, shape.bz) - shape.half;
  o.maxZ = Math.max(shape.az, shape.bz) + shape.half;
  o.enabled = true;
  door.open = door.amount > 0.32;
  door.hinge.updateWorldMatrix(true, true);
}
export function releaseDoor(door, position) {
  door.pushable = true;
  door.unlatched = true;
  if (!door.amount) {
    const normal = {x:-door.baseAxis.z, z:door.baseAxis.x};
    const side = (position.x-door.hinge.position.x)*normal.x + (position.z-door.hinge.position.z)*normal.z;
    door.swing = side >= 0 ? 1 : -1;
    door.amount = 0.065;
  }
  updatePushDoor(door);
}
export function pushDoors(doors, position, dx, dz, radius) {
  const movement = Math.hypot(dx, dz);
  if (movement < 1e-8) return [];
  const moved = [];
  for (const door of doors) {
    if (!door.pushable || !door.unlatched || door.amount >= 1) continue;
    const shape = doorShape(door), vx = shape.bx-shape.ax, vz = shape.bz-shape.az;
    const t = clamp(((position.x-shape.ax)*vx+(position.z-shape.az)*vz)/(door.width*door.width),0,1);
    const qx=shape.ax+t*vx, qz=shape.az+t*vz;
    const distance=Math.hypot(position.x+dx-qx,position.z+dz-qz);
    if (distance > radius + shape.half + 0.12) continue;
    const nx=-vz/door.width, nz=vx/door.width;
    const side=(position.x-qx)*nx+(position.z-qz)*nz;
    if ((dx*nx+dz*nz)*Math.sign(side || 1) >= -1e-7) continue;
    // Choose the swing from the side actually being pushed, including after a save reload.
    if (door.amount <= 0.07) {
      const closedSide=(position.x-shape.ax)*(-door.baseAxis.z)+(position.z-shape.az)*door.baseAxis.x;
      door.swing=closedSide>=0?1:-1;
    }
    door.amount=Math.min(1,door.amount+movement*2.8*(.3+.7*t));
    updatePushDoor(door);
    moved.push(door);
  }
  return moved;
}
export function segmentBlocked(x,z,segment,radius) {
  const {ax,az,bx,bz,half}=segment, vx=bx-ax,vz=bz-az;
  const t=clamp(((x-ax)*vx+(z-az)*vz)/(vx*vx+vz*vz),0,1);
  return Math.hypot(x-(ax+t*vx),z-(az+t*vz)) < radius+half;
}
