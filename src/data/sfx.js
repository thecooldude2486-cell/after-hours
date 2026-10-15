const files = (...names) => names.map((n) => "assets/sfx/" + n + ".wav");
export const SFX = {
  laugh: {
    files: ["assets/audio/v11-lastVoicemail-0.wav"],
    volume: 0.28,
  },
  footstep: {
    files: files("step-tile-0", "step-tile-1", "step-tile-2", "step-tile-3"),
    volume: 0.78,
    rate: [0.95, 1.06],
  },
  footstepWood: {
    files: files("step-wood-0", "step-wood-1", "step-wood-2", "step-wood-3"),
    volume: 0.78,
    rate: [0.94, 1.04],
  },
  teacherStep: {
    files: files("heel-v10"),
    volume: 0.8,
    rate: [0.9, 1.04],
  },
  door: { files: files("door-close", "door-open"), volume: 0.6 },
  drawer: { files: files("creak", "wood"), volume: 0.42 },
  switch: { files: files("click"), volume: 0.45 },
  jump: { files: files("cloth"), volume: 0.35 },
  land: { files: files("soft", "step-tile-1"), volume: 0.65 },
  struggle: { files: files("cloth", "soft"), volume: 0.4, rate: [0.95, 1.16] },
  escape: { files: files("escape"), volume: 0.8 },
  ambushWarning: { files: files("warning"), volume: 0.8 },
  scare: { files: files("teacher-impact-v13"), volume: 1.5, bus: "scares" },
  shadowScare: { files: files("room-impact-v13"), volume: 1.5, bus: "scares" },
  officeMonster: { files: files("monster-office-v15"), volume: 1.25, bus: "scares" },
  phoneMonster: { files: files("monster-phone-v15"), volume: 1.25, bus: "scares" },
  archiveMonster: { files: files("monster-archive-v15"), volume: 1.25, bus: "scares" },
  emptyLocker: {
    files: files("locker-open-v13"),
    volume: 0.72,
    bus: "ambience",
  },
  emptySteps: {
    files: files("empty-steps-v15"),
    volume: 0.95,
    bus: "effects",
    refDistance: 8,
    rolloff: 0.5,
  },
  hallScare: { files: files("hall-scare-v9"), volume: 1.05, bus: "scares" },
  lockerScare: { files: files("locker-scare-v9"), volume: 1.05, bus: "scares" },
  screenScare: { files: files("screen-scare-v9"), volume: 1, bus: "scares" },
  apparitionArrival: {
    files: files("apparition-arrival-v17"), volume: 0.85, bus: "scares",
    refDistance: 18, rolloff: 0.25,
  },
  apparitionVanish: {
    files: files("apparition-vanish-v17"), volume: 0.7, bus: "scares",
    refDistance: 14, rolloff: 0.3,
  },
  vanish: { files: files("vanish-v10"), volume: 0.36 },
  breath: { files: files("breath-v10"), volume: 0.34, rate: [0.9, 1.02] },
  collapse: { files: files("collapse"), volume: 0.75 },
  paper: { files: files("book"), volume: 0.45 },
};
export const DEVICE_DEFAULTS = {
  intercomVolume: 1.8,
  voicemailVolume: 1.25,
  intercomDistortion: 0.75,
  voicemailDistortion: 0.35,
};
export function deviceProfile(line, config) {
  const intercom = line.speaker.includes("INTERCOM"),
    voicemail = line.speaker.includes("VOICEMAIL");
  return {
    intercom,
    voicemail,
    gain: intercom
      ? (config.intercomVolume ?? 1.8)
      : voicemail
        ? (config.voicemailVolume ?? 1.25)
        : line.speaker.includes("TEACHER")
          ? 0.9
          : 1,
    depth: intercom
      ? (config.intercomDistortion ?? 0.75)
      : (config.voicemailDistortion ?? 0.35),
    carrier: intercom ? 47 : 32,
    refDistance: intercom ? 16 : voicemail ? 4 : 2,
    rolloff: intercom ? 0.18 : 1,
  };
}

export function deviceDistortionCurve(strength) {
  const curve = new Float32Array(1025),
    drive = 1 + strength * 9;
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = strength <= 0 ? x : Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}
