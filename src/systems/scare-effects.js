/** Two brief reveal flashes and a decaying camera impulse, shared by grabs and capture shots. */
export function scareEnvelope(t) {
  const pulse = (start, width) =>
    t >= start && t < start + width
      ? Math.sin(((t - start) / width) * Math.PI)
      : 0;
  return {
    flash: Math.max(pulse(0, 0.13), pulse(0.27, 0.11) * 0.75),
    impact: Math.max(
      Math.exp(-t * 4),
      Math.exp(-Math.abs(t - 0.28) * 12) * 0.85,
    ),
    recoil: Math.exp(-Math.max(0, t - 0.11) * 8),
  };
}
export function scareFeedback(
  game,
  light,
  t,
  { sustained = false, power = 1, fovBase } = {},
) {
  const { flash, impact } = scareEnvelope(t),
    camera = game.camera;
  const shake = (game.config?.cameraShake ?? 0.7) * power;
  camera.position.x +=
    (Math.sin(t * 67) * 0.069 + Math.sin(t * 107) * 0.022) * impact * shake;
  camera.position.y += Math.cos(t * 83) * 0.044 * impact * shake;
  camera.rotateX?.(
    -0.08 * impact * shake + Math.sin(t * 71) * 0.018 * impact * shake,
  );
  camera.rotateZ?.(Math.sin(t * 59) * 0.065 * impact * shake);
  if (fovBase !== undefined) {
    camera.fov = fovBase - 14 * impact * shake;
    camera.updateProjectionMatrix();
  }
  game.player?.syncFlashlight?.();
  const flashes = game.config?.scareFlash !== false;
  light.position.copy(camera.position);
  light.color.setHex(0xe3ede2);
  light.intensity =
    (sustained ? 3.8 : Math.max(0, 1 - t) * 3.8) + (flashes ? flash * 72 : 0);
  game.world.scarePulse = flashes ? flash : 0;
  document.querySelector("#scareFlash").style.opacity = String(
    flashes ? flash * 0.86 : 0,
  );
}
export function clearScareFeedback(game, light) {
  light.intensity = 0;
  if (game.camera && game.config?.cameraFov) {
    game.camera.fov = game.config.cameraFov;
    game.camera.updateProjectionMatrix();
  }
  game.world.scarePulse = 0;
  document.querySelector("#scareFlash").style.opacity = "0";
}
