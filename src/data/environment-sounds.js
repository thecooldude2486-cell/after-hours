// Independent empty-school noises, never tied to room-monster spawn or danger warnings.
export const ENVIRONMENT_SOUNDS = [
  {
    id: "west-lockers",
    cue: "emptyLocker",
    at: [-2.24, 1.4, -11.7],
    radius: 19,
  },
  {
    id: "east-lockers",
    cue: "emptyLocker",
    at: [2.24, 1.4, -24.5],
    radius: 19,
  },
  { id: "empty-classroom", cue: "emptySteps", at: [-7, 0.3, -20], radius: 16 },
  { id: "empty-office", cue: "emptySteps", at: [10, 0.3, -22], radius: 16 },
  { id: "records-floor", cue: "emptySteps", at: [-9, 0.3, -42], radius: 15 },
  {
    id: "maintenance-locker",
    cue: "emptyLocker",
    at: [18.8, 1.4, -46],
    radius: 15,
  },
  { id: "gym-floor", cue: "emptySteps", at: [-5, 0.3, -67], radius: 17 },
];
