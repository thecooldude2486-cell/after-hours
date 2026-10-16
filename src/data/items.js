export const ITEMS = {
  flashlight:{name:'Emergency flashlight',type:'flashlight',clue:'F · switch the beam on or off'},
  diaryKey:{name:"Mara’s tiny diary key",type:"key",clue:"A small brass clasp"},
  bellClapper:{name:"Office bell clapper",type:"tool",clue:"A bell with no voice"},
  headmasterKey:{name:"Headmaster’s file key",type:"key",clue:"A seal that was never broken"},
  attendanceRoll:{name:"Class 08 attendance roll",type:"document",clue:"Departures before the alarm"},
  secretKey:{name:"CRT service key",type:"key",clue:"Office monitor service selector"},
  clinicKey:{name:"Infirmary key",type:"key",clue:"West-wing infirmary"},
  workshopKey:{name:"Workshop key",type:"key",clue:"West-wing workshop"},
  valveWheel:{name:"Steam valve wheel",type:"tool",clue:"Boiler steam shutoff"},
  pliers:{name:"Insulated pliers",type:"tool",clue:"Twisted wire fasteners"},
  screwdriver: {name: "Flathead screwdriver", type: "tool", clue: "Remove the screws from the office MAP STORE panel"},
  crowbar: {name: "Steel crowbar", type: "tool", clue: "Pry the boards off PROJECTION in the archive"},
  crank: {name: "Projector crank", type: "tool", clue: "Fit to the projection-booth projector; requires school power"},
  rescueKey: {name: "Red emergency key", type: "key", clue: "Unlock the fire exit inside the record vault"},
  serviceKey: { name: "Brass service key", type: "key", clue: "Lost-property chest · concealed service panel and toolbox" },
  groundingKit: { name: "Grounding kit", type: "calm", clue: "H · restore 25 sanity" },
  lockerKey: {
    name: "Locker 17 key",
    type: "key",
    clue: "Reception · Mara’s locker",
  },
  classroomKey: {
    name: "Classroom 04 key",
    type: "key",
    clue: "Office · Classroom 04",
  },
  staffKey: {
    name: "Classroom 08 key",
    type: "key",
    clue: "Classroom 04 · Classroom 08",
  },
  recordsKey: {
    name: "Staff cabinet key",
    type: "key",
    clue: "Classroom 08 · Mrs Vale’s record",
  },
  fuse: {
    name: "Ceramic fuse",
    type: "fuse",
    clue: "East maintenance · fuse box",
  },
  cutters: {
    name: "Bolt cutters",
    type: "tool",
    clue: "Staff archive · gym padlocks",
  },
};
// Rotation faces each container into its room. Position is cabinet centre, not a loose surface.
export const STORAGE = {
  lockerKey: {
    room: "lobby",
    kind: "locker",
    rotation: -Math.PI / 2,
    slots: [
      [6.15, 4],
      [6.15, 5.65],
      [6.15, 7.3],
      [6.15, 8.95],
      [6.15, 10.6],
    ],
  },
  classroomKey: {
    room: "office",
    kind: "drawer",
    rotation: 0,
    slots: [
      [5, -24.15],
      [7, -24.15],
      [9, -24.15],
      [11, -24.15],
      [13, -24.15],
    ],
  },
  staffKey: {
    room: "classroom",
    kind: "drawer",
    rotation: Math.PI,
    slots: [
      [-13, -12.8],
      [-11, -12.8],
      [-9, -12.8],
      [-7, -12.8],
      [-5, -12.8],
    ],
  },
  recordsKey: {
    room: "phone",
    kind: "drawer",
    rotation: 0,
    slots: [
      [5, -44.2],
      [7, -44.2],
      [9, -44.2],
      [11, -44.2],
      [13, -44.2],
    ],
  },
  fuse: {
    room: "maintenance",
    kind: "locker",
    rotation: -Math.PI / 2,
    slots: [
      [19.1, -41],
      [19.1, -43],
      [19.1, -45],
      [19.1, -57],
      [19.1, -59],
    ],
  },
  cutters: {
    room: "archive",
    kind: "drawer",
    rotation: 0,
    slots: [
      [-13, -44.2],
      [-11, -44.2],
      [-9, -44.2],
      [-7, -44.2],
      [-5, -44.2],
    ],
  },
};
export const ITEM_LAYOUTS = Object.fromEntries(
  Object.entries(STORAGE).map(([item, s]) => [
    item,
    s.slots.map(([x, z]) => [x, s.kind === "locker" ? 0.91 : 0.67, z]),
  ]),
);
