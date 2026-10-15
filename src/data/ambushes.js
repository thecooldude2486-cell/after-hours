// Broad exploration windows avoid missing a room just because an item was collected early.
export const AMBUSH_REVISION = 9;
const exploration = [
  "locker",
  "drawing",
  "cassette",
  "phone",
  "afternoon",
  "fault",
  "vale",
  "waiting",
];
// Normal/memory states and emotional sequences remain excluded by AmbushSystem.
export const ROOM_AMBUSHES = [
  {
    id: "office-shape",
    stages: exploration,
    room: "office",
    variant: "office",
    bounds: [4.1, 14, -24.8, -13],
    origin: [12, 0, -23],
  },
  {
    id: "phone-shape",
    stages: exploration,
    room: "phone",
    variant: "phone",
    bounds: [4.6, 14, -44.8, -34],
    origin: [6, 0, -43],
  },
  {
    id: "archive-shape",
    stages: exploration,
    room: "archive",
    variant: "archive",
    bounds: [-14, -4.2, -44.8, -33],
    origin: [-13, 0, -43],
  },
];
export const STRUGGLE_PRESETS = {
  story: { taps: 6, seconds: 9, lethal: true },
  easy: { taps: 10, seconds: 7.5, lethal: true },
  normal: { taps: 16, seconds: 6.5, lethal: true },
  hard: { taps: 22, seconds: 6, lethal: true },
  nightmare: { taps: 26, seconds: 5.7, lethal: true },
};
