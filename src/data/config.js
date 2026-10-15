export const DEFAULTS = {
  walkSpeed: 2.35,
  gravity: 18,
  jumpSpeed: 6,
  playerRadius: 0.23,
  sprintSpeed: 4.8,
  crouchSpeed: 1.15,
  mouseSensitivity: 0.0021,
  eyeHeight: 1.65,
  crouchHeight: 0.94,
  interactionDistance: 2.5,
  flashlightIntensity: 18,
  flashlightRange: 27,
  flashlightAngle: 0.39,
  visionRange: 17,
  visionAngle: 1.15,
  hearingRange: 19,
  chaseSpeed: 4.45,
  patrolSpeed: 1.55,
  teacherTurnSpeed: 5,
  searchDuration: 24,
  suspicionTime: 0.3,
  sprintCapacity: 4.5,
  sprintRecovery: 0.65,
  lostSightDuration: 3,
  hideCheckDuration: 2.4,
  encounterGrace: 1.8,
  audioVolume: 0.7,
  dialogueTiming: 1,
  transitionDuration: 2.1,
  triggerTiming: 1,
  footstepInterval: 0.56,
  pixelRatio: 1.4,
  batteryDrain: 0.14,
  sanityDrain: 0.22,
  startBattery: 70,
  monsterSanityDrain: 8,
  monsterRevealDuration: 0.75,
  struggleWindow: 1,
  preset: "normal",
};
export const TUNING = {
  monsterRevealDuration: [0.3, 1.5, "Minimum room monster reveal (seconds)"],
  monsterSanityDrain: [1, 20, "Room monster sanity drain per second"],
  struggleWindow: [0.5, 2, "Room struggle time multiplier"],
  gravity: [8, 30, "Gravity"],
  jumpSpeed: [3, 8, "Jump impulse"],
  walkSpeed: [0.8, 5, "Walking speed"],
  sprintSpeed: [2, 9, "Sprint speed"],
  crouchSpeed: [0.4, 3, "Crouch speed"],
  interactionDistance: [1, 5, "Interaction distance"],
  flashlightIntensity: [1, 40, "Flashlight brightness"],
  flashlightRange: [5, 50, "Flashlight reach"],
  flashlightAngle: [0.15, 0.8, "Flashlight cone"],
  visionRange: [3, 25, "Teacher vision"],
  hearingRange: [2, 30, "Teacher hearing"],
  chaseSpeed: [1, 7, "Chase speed"],
  patrolSpeed: [0.5, 3, "Patrol speed"],
  teacherTurnSpeed: [1, 10, "Teacher turn speed (radians per second)"],
  searchDuration: [3, 40, "Search duration"],
  sprintCapacity: [2, 12, "Sprint reserve (seconds)"],
  sprintRecovery: [0.2, 2, "Breath recovery"],
  lostSightDuration: [1, 8, "Chase persistence"],
  hideCheckDuration: [1, 6, "Time to search a witnessed hiding place"],
  batteryDrain: [0.01, 0.5, "Flashlight drain (% per second)"],
  sanityDrain: [0.02, 2, "Sanity drain in darkness"],
  audioVolume: [0, 1, "Master volume"],
  dialogueTiming: [0.35, 2, "Dialogue duration"],
  triggerTiming: [0.5, 2, "Sequence timing"],
  transitionDuration: [0.3, 6, "Environment fade"],
};
export function loadConfig(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem("after-hours-tuning") || "{}");
    // Earlier releases saved every default when changing volume. Migrate old encounter defaults.
    if (![3, 4].includes(saved.revision)) {
      for (const key of [
        "visionRange",
        "hearingRange",
        "chaseSpeed",
        "patrolSpeed",
        "searchDuration",
        "suspicionTime",
      ])
        delete saved[key];
    }
    return {
      ...DEFAULTS,
      ...saved,
      revision: 3,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
