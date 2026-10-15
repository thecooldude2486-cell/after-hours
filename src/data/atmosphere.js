export const MUSIC = {
  friendly: "assets/music/school-piano.wav",
  wrong: "assets/music/empty-school-song-v10.wav",
  tension: "assets/music/pursuit-v10.wav",
  pressure: "assets/music/maintenance-pressure-v10.wav",
  gym: "assets/music/gym-memory-v10.wav",
};
export const MUSIC_ZONES = [
  { id: "office", x: 12, z: -20, radius: 8 },
  { id: "phone", x: 9, z: -40, radius: 8 },
  { id: "archive", x: -10, z: -39, radius: 8 },
];
export function atmosphereCue(game) {
  if (!game.started || game.ended || game.recovering) return null;
  if (["normal", "memory"].includes(game.world.env.state))
    return { id: "friendly", gain: 0.16 };
  if (
    game.story.companion ||
    [
      "reunion",
      "embrace",
      "escortLatch",
      "entrance",
      "outside",
      "return",
      "lastClass",
      "seat",
      "leave",
      "lastPhone",
      "end",
    ].includes(game.story.stage)
  )
    return null;
  if (game.cinematics?.active?.id === "teacherArrival")
    return { id: "tension", gain: 0.38 };
  if (game.cinematics?.active?.id === "fireMemory")
    return { id: "pressure", gain: 0.34 };
  if (game.ambushes?.active) return { id: "tension", gain: 0.44 };
  if (game.teacher.active && game.config.enemy)
    return {
      id: "tension",
      gain: game.teacher.state === "Chase" ? 0.42 : 0.24,
    };
  if (
    game.story.stage === "fault" ||
    (game.player.position.x > 15 && game.player.position.z < -35)
  )
    return { id: "pressure", gain: 0.31 };
  if (game.story.stage === "waiting" && game.player.position.z < -53)
    return { id: "gym", gain: 0.3 };
  const zone = MUSIC_ZONES.find(
    (z) =>
      Math.hypot(game.player.position.x - z.x, game.player.position.z - z.z) <
      z.radius,
  );
  return zone
    ? {
        id: "wrong",
        gain: zone.id === "archive" ? 0.32 : 0.24,
        zone,
        position: { x: zone.x, y: 1.45, z: zone.z },
      }
    : null;
}
