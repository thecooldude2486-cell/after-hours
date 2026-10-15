export const SETTINGS_FIELDS = {
  audioVolume: [0, 1, 0.05, "Master volume", 0.7],
  voiceVolume: [0, 1.5, 0.05, "Dialogue volume", 1],
  effectsVolume: [0, 1, 0.05, "Sound effects", 0.8],
  ambienceVolume: [0, 1, 0.05, "Rain and ambience", 0.55],
  musicVolume: [0, 1, 0.05, "Music", 0.4],
  scareVolume: [0, 1, 0.05, "Jumpscare sound", 0.85],
  intercomVolume: [0.5, 2.5, 0.05, "Intercom voice boost", 1.8],
  intercomDistortion: [0, 1, 0.05, "Intercom robotic effect", 0.75],
  voicemailVolume: [0.5, 2, 0.05, "Voicemail voice boost", 1.25],
  voicemailDistortion: [0, 1, 0.05, "Voicemail robotic effect", 0.35],
  cameraShake: [0, 1, 0.05, "Camera shake", 0.7],
  cameraFov: [55, 90, 1, "Field of view", 68],
  mouseSensitivity: [0.0005, 0.005, 0.0001, "Mouse sensitivity", 0.0021],
};
export const SETTINGS_SWITCHES = {
  screenEffects: ["Contact shadows, lens grain and light bloom", true],
  spokenDialogue: ["Spoken dialogue", true],
  scareFlash: ["Brief scare lighting pulse", true],
};
export function readSettings(storage = globalThis.localStorage) {
  let saved = {};
  try {
    const parsed = JSON.parse(storage?.getItem("after-hours-settings") || "{}");
    saved =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {}
  const values = {};
  for (const [key, [min, max, , label, fallback]] of Object.entries(
    SETTINGS_FIELDS,
  ))
    values[key] = Number.isFinite(saved[key])
      ? Math.max(min, Math.min(max, saved[key]))
      : fallback;
  for (const [key, [label, fallback]] of Object.entries(SETTINGS_SWITCHES))
    values[key] = typeof saved[key] === "boolean" ? saved[key] : fallback;
  return values;
}
/** Player-facing preferences persist independently of difficulty and Director tuning. */
export class SettingsSystem {
  constructor(game) {
    this.game = game;
    this.values = readSettings();
    this.apply();
    this.build();
  }
  apply() {
    Object.assign(this.game.config, this.values);
    this.game.audio.voice = this.values.spokenDialogue;
    this.game.audio.applyMix();
    if (this.game.camera && !this.game.cinematics.active) {
      this.game.camera.fov = this.values.cameraFov;
      this.game.camera.updateProjectionMatrix();
    }
  }
  save() {
    for (const key of [
      ...Object.keys(SETTINGS_FIELDS),
      ...Object.keys(SETTINGS_SWITCHES),
    ])
      this.values[key] = this.game.config[key];
    try {
      localStorage.setItem("after-hours-settings", JSON.stringify(this.values));
    } catch {}
    this.apply();
    this.sync();
  }
  build() {
    const fields = document.querySelector("#settingsFields");
    fields.replaceChildren();
    for (const [key, [min, max, step, label]] of Object.entries(
      SETTINGS_FIELDS,
    )) {
      const row = document.createElement("label");
      row.className = "setting-row";
      const title = document.createElement("span");
      title.textContent = label;
      const input = document.createElement("input");
      input.type = "range";
      input.min = min;
      input.max = max;
      input.step = step;
      input.id = "setting_" + key;
      const value = document.createElement("output");
      value.id = "settingValue_" + key;
      input.oninput = () => {
        this.game.config[key] = Number(input.value);
        this.save();
      };
      row.append(title, input, value);
      fields.append(row);
    }
    for (const [key, [label]] of Object.entries(SETTINGS_SWITCHES)) {
      const row = document.createElement("label");
      row.className = "option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "setting_" + key;
      input.onchange = () => {
        this.game.config[key] = input.checked;
        if (key === "spokenDialogue" && !input.checked)
          this.game.audio.stopLine();
        this.save();
      };
      row.append(input, document.createTextNode(label));
      fields.append(row);
    }
    document.querySelector("#settingsButton").onclick = () => this.open();
    document.querySelector("#titleSettings").onclick = () => this.open();
    document.querySelector("#closeSettings").onclick = () => this.close();
    document.querySelector("#resetSettings").onclick = () => {
      this.values = readSettings({ getItem: () => null });
      this.apply();
      this.save();
    };
    document.querySelector("#testIntercom").onclick = () =>
      this.preview("intercom");
    document.querySelector("#testMara").onclick = () => this.preview("mara");
    document.querySelector("#testScare").onclick = () => this.preview("scare");
    this.sync();
  }
  sync() {
    for (const key of Object.keys(SETTINGS_FIELDS)) {
      const input = document.querySelector("#setting_" + key);
      if (input) input.value = this.values[key];
      const output = document.querySelector("#settingValue_" + key);
      if (output)
        output.textContent =
          key === "mouseSensitivity"
            ? this.values[key].toFixed(4)
            : String(Math.round(this.values[key] * 100) / 100);
    }
    for (const key of Object.keys(SETTINGS_SWITCHES)) {
      const input = document.querySelector("#setting_" + key);
      if (input) input.checked = this.values[key];
    }
    document.querySelector("#volume").value = this.values.audioVolume;
    document.querySelector("#voiceToggle").checked = this.values.spokenDialogue;
  }
  open() {
    const g = this.game;
    this.fromTitle = !g.started;
    if (g.started) g.pause();
    document.querySelector("#pause").classList.add("hidden");
    document.querySelector("#settings").classList.remove("hidden");
    this.sync();
  }
  close() {
    this.game.audio.stopLine();
    this.game.audio.stopEffects?.();
    document.querySelector("#settings").classList.add("hidden");
    if (this.fromTitle) {
      this.game.audio.suspend();
    } else {
      document.querySelector("#pause").classList.remove("hidden");
      this.game.audio.suspend();
    }
  }
  async preview(kind) {
    const g = this.game;
    if (g.started && !g.paused) return;
    await g.audio.start();
    g.audio.stopLine();
    g.audio.stopEffects();
    if (kind === "scare") g.audio.cue("scare");
    else {
      const { DIALOGUE } = await import("../data/dialogue.js");
      await g.audio.line(
        kind === "mara" ? DIALOGUE.argument[0] : DIALOGUE.intercom[0],
      );
    }
    // Previews are explicit and isolated from story triggers. Return to the existing paused state afterwards.
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => {
      if (!g.started || g.paused) g.audio.suspend();
    }, 4500);
  }
}
