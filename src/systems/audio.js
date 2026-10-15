import { MUSIC } from "../data/atmosphere.js";
import { SFX, deviceProfile, deviceDistortionCurve } from "../data/sfx.js";
export class AudioSystem {
  constructor(config) {
    this.config = config;
    this.ctx = null;
    this.sources = [];
    this.enabled = true;
    this.voice = config.spokenDialogue ?? true;
    this.sfxBuffers = new Map();
    this.effects = new Set();
    this.musicLoops = new Set();
    this.effectEpoch = 0;
    this.sfxIndex = new Map();
    this.activeClip = null;
    this.clipNodes = [];
    this.clipModulators = [];
    this.clipTicket = 0;
    this.clipBuffers = new Map();
  }
  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.config.audioVolume;
    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    this.master.connect(limiter).connect(this.ctx.destination);
    this.buses = {};
    for (const [name, key, defaultValue] of [
      ["effects", "effectsVolume", 0.8],
      ["voices", "voiceVolume", 1],
      ["ambience", "ambienceVolume", 0.55],
      ["music", "musicVolume", 0.4],
      ["scares", "scareVolume", 0.85],
    ]) {
      const gain = this.ctx.createGain();
      gain.gain.value = this.config[key] ?? defaultValue;
      gain.connect(this.master);
      this.buses[name] = gain;
    }
    // Decode actual bundled foley once; playback never asks an external audio service.
    await Promise.allSettled(
      [
        ...new Set([
          ...Object.values(SFX).flatMap((s) => s.files),
          ...Object.values(MUSIC),
        ]),
      ].map(async (path) => {
        const r = await fetch(path);
        if (!r.ok) throw Error(path);
        this.sfxBuffers.set(
          path,
          await this.ctx.decodeAudioData(await r.arrayBuffer()),
        );
      }),
    );
    const length = this.ctx.sampleRate * 3,
      buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate),
      data = buffer.getChannelData(0);
    let brown = 0;
    // Filtered procedural rain is a placeholder for an exterior rain recording.
    for (let i = 0; i < length; i++) {
      brown = (brown + Math.random() * 0.03 - 0.015) * 0.998;
      data[i] = brown;
    }
    this.noise = buffer;
    const rain = this.ctx.createBufferSource();
    rain.buffer = buffer;
    rain.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.26;
    rain.connect(filter).connect(this.rainGain).connect(this.buses.ambience);
    rain.start();
    this.hum = this.ctx.createOscillator();
    this.hum.frequency.value = 58;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.014;
    this.hum.connect(this.humGain).connect(this.buses.ambience);
    this.hum.start();
  }
  applyMix() {
    if (!this.ctx) return;
    const set = (param, value) => {
      if (!param) return;
      if (param.setTargetAtTime)
        param.setTargetAtTime(value, this.ctx.currentTime || 0, 0.08);
      else param.value = value;
    };
    set(this.master?.gain, this.config.audioVolume ?? 0.7);
    for (const [name, key, d] of [
      ["effects", "effectsVolume", 0.8],
      ["voices", "voiceVolume", 1],
      ["ambience", "ambienceVolume", 0.55],
      ["music", "musicVolume", 0.4],
      ["scares", "scareVolume", 0.85],
    ])
      set(
        this.buses?.[name]?.gain,
        (this.config[key] ?? d) *
          (this.isSpeaking && ["ambience", "music"].includes(name) ? 0.28 : 1),
      );
  }
  update(player) {
    if (!this.ctx) return;
    this.applyMix();
    const l = this.ctx.listener,
      p = player.position;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y || 1.6;
      l.positionZ.value = p.z;
      l.forwardX.value = -Math.sin(player.yaw);
      l.forwardY.value = 0;
      l.forwardZ.value = -Math.cos(player.yaw);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }
  tone(
    freq,
    duration,
    volume = 0.1,
    position = null,
    type = "sine",
    endFreq = null,
  ) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (endFreq)
      o.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(volume, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    o.connect(g);
    if (position) {
      const p = this.ctx.createPanner();
      p.panningModel = "HRTF";
      p.distanceModel = "inverse";
      p.refDistance = 2;
      p.maxDistance = 40;
      p.rolloffFactor = 1.1;
      p.positionX.value = position.x;
      p.positionY.value = position.y || 1.7;
      p.positionZ.value = position.z;
      g.connect(p).connect(
        this.buses?.[this.activeBus || "effects"] || this.master,
      );
    } else g.connect(this.buses?.[this.activeBus || "effects"] || this.master);
    o.start();
    o.stop(now + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  noiseBurst(duration, volume, position = null, cutoff = 900) {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = cutoff;
    const g = this.ctx.createGain(),
      now = this.ctx.currentTime;
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    s.connect(f).connect(g);
    if (position) {
      const p = this.ctx.createPanner();
      p.panningModel = "HRTF";
      p.positionX.value = position.x;
      p.positionY.value = position.y || 1;
      p.positionZ.value = position.z;
      p.refDistance = 2;
      g.connect(p).connect(
        this.buses?.[this.activeBus || "effects"] || this.master,
      );
    } else g.connect(this.buses?.[this.activeBus || "effects"] || this.master);
    s.start();
    s.stop(now + duration);
  }
  async playSfx(name, position = null) {
    if (!this.ctx) return;
    const data = SFX[name];
    if (!data) return;
    const index = this.sfxIndex.get(name) || 0;
    this.sfxIndex.set(name, index + 1);
    const path = data.files[index % data.files.length],
      buffer = this.sfxBuffers.get(path);
    if (!buffer) return;
    if (this.effects.size >= 28)
      this.effects.values().next().value?.source.stop();
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = data.rate
      ? data.rate[0] + Math.random() * (data.rate[1] - data.rate[0])
      : 1;
    gain.gain.value = data.volume;
    const nodes = [source, gain];
    source.connect(gain);
    let out = gain;
    if (position) {
      const pan = this.ctx.createPanner();
      pan.panningModel = "HRTF";
      pan.refDistance = data.refDistance ?? 3;
      pan.maxDistance = 40;
      pan.rolloffFactor = data.rolloff ?? 0.8;
      pan.positionX.value = position.x;
      pan.positionY.value = position.y ?? 1;
      pan.positionZ.value = position.z;
      out.connect(pan);
      out = pan;
      nodes.push(pan);
    }
    out.connect(this.buses?.[data.bus || "effects"] || this.master);
    const effect = { source, nodes, name };
    this.effects.add(effect);
    source.onended = () => {
      nodes.forEach((n) => n.disconnect());
      this.effects.delete(effect);
    };
    source.start();
  }
  playMusic(id, position = null, volume = 0.2) {
    if (!this.ctx || !this.sfxBuffers.has(MUSIC[id])) return null;
    const source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain();
    source.buffer = this.sfxBuffers.get(MUSIC[id]);
    source.loop = true;
    const now = this.ctx.currentTime || 0;
    if (gain.gain.linearRampToValueAtTime) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + 1.2);
    } else gain.gain.value = volume;
    source.connect(gain);
    let out = gain;
    const nodes = [source, gain];
    if (position) {
      const pan = this.ctx.createPanner();
      pan.panningModel = "HRTF";
      pan.refDistance = 4;
      pan.rolloffFactor = 0.65;
      pan.positionX.value = position.x;
      pan.positionY.value = position.y;
      pan.positionZ.value = position.z;
      out.connect(pan);
      out = pan;
      nodes.push(pan);
    }
    out.connect(this.buses?.music || this.master);
    let cleaned = false,
      targetVolume = volume;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      handle.playing = false;
      nodes.forEach((n) => n.disconnect());
      this.musicLoops.delete(handle);
    };
    const handle = {
      playing: true,
      setVolume: (value) => {
        if (!handle.playing || value === targetVolume) return;
        targetVolume = value;
        if (gain.gain.setTargetAtTime)
          gain.gain.setTargetAtTime(value, this.ctx.currentTime || 0, 0.3);
        else gain.gain.value = value;
      },
      stop: (immediate = false) => {
        if (!handle.playing && !immediate) return;
        handle.playing = false;
        const t = this.ctx.currentTime || 0;
        try {
          if (!immediate && gain.gain.linearRampToValueAtTime) {
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.8);
            source.stop(t + 0.82);
          } else {
            source.stop();
            cleanup();
          }
        } catch {}
      },
    };
    this.musicLoops.add(handle);
    source.onended = cleanup;
    source.start();
    return handle;
  }
  stopSfx(name) {
    for (const effect of [...this.effects]) {
      if (effect.name !== name) continue;
      try { effect.source.stop(); } catch {}
      effect.nodes.forEach((node) => node.disconnect());
      this.effects.delete(effect);
    }
  }
  stopEffects() {
    for (const handle of [...this.musicLoops]) handle.stop(true);
    this.effectEpoch++;
    for (const e of [...this.effects]) {
      try {
        e.source.stop();
      } catch {}
      e.nodes.forEach((n) => n.disconnect());
    }
    this.effects.clear();
  }
  cue(name, p = null) {
    if (SFX[name]) {
      void this.playSfx(name, p);
      return;
    }
    this.activeBus = name === "memory" ? "music" : "effects";
    if (name === "ambushWarning") {
      this.noiseBurst(1.3, 0.75, p, 1800);
      this.tone(88, 1.4, 0.1, p, "sawtooth", 38);
    } else if (name === "struggle") {
      this.noiseBurst(0.1, 0.22, null, 340);
    } else if (name === "scare") {
      this.noiseBurst(0.55, 1.5, p, 95);
      this.tone(62, 0.8, 0.24, p, "triangle", 28);
      this.tone(720, 0.28, 0.035, p, "sawtooth", 110);
    } else if (name === "heartbeat") {
      this.tone(47, 0.25, 0.1);
      this.tone(62, 0.19, 0.04);
    } else if (name === "footstep") {
      this.noiseBurst(0.12, 0.6, p, 80);
      this.tone(90, 0.12, 0.07, p, "triangle", 45);
    } else if (name === "teacherStep") {
      this.noiseBurst(0.25, 1.3, p, 50);
      this.tone(54, 0.45, 0.18, p, "triangle", 30);
    } else if (name === "phone") {
      this.tone(480, 0.8, 0.11, p, "square");
      this.tone(440, 0.8, 0.07, p);
    } else if (name === "bell") {
      for (const f of [830, 1090, 1460]) this.tone(f, 3, 0.07, p);
    } else if (name === "alarm") {
      this.tone(640, 1, 0.13, p, "sawtooth", 920);
    } else if (name === "chalk") this.noiseBurst(1.5, 0.5, p, 2400);
    else if (name === "door") {
      this.tone(75, 0.35, 0.22, p, "triangle", 32);
      this.noiseBurst(0.5, 0.7, p, 220);
    } else if (name === "switch") this.noiseBurst(0.06, 0.4, p, 900);
    else if (name === "thunder") {
      this.noiseBurst(4, 2, p, 25);
      this.tone(35, 4, 0.15, p, "sine", 20);
    } else if (name === "memory") {
      this.tone(196, 5, 0.05, p);
      this.tone(293.66, 6, 0.025, p);
    } else if (name === "breath") this.noiseBurst(1.2, 0.35, p, 600);
    else if (name === "collapse") {
      this.noiseBurst(2, 1.5, p, 40);
      this.tone(44, 2, 0.15, p, "sawtooth", 22);
    } else if (name === "laugh") this.tone(410, 0.9, 0.025, p, "sine", 540);
  }
  get isSpeaking() {
    return (
      !!(this.activeClip && !this.activeClip.ended) ||
      !!(window.speechSynthesis?.speaking || window.speechSynthesis?.pending)
    );
  }
  loadClip(path) {
    let pending = this.clipBuffers.get(path);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(path);
        if (!response.ok) throw Error(path);
        return this.ctx.decodeAudioData(await response.arrayBuffer());
      })();
      this.clipBuffers.set(path, pending);
      // Failed preloads must be retryable and must not reject unhandled.
      pending.catch(() => {
        if (this.clipBuffers.get(path) === pending)
          this.clipBuffers.delete(path);
      });
    }
    return pending;
  }
  prepareLines(lines) {
    if (!this.ctx || !this.voice) return;
    // Warm the next conversation without starting voices or device effects.
    for (const path of new Set(lines.map((line) => line.audio).filter(Boolean)))
      this.loadClip(path);
  }
  async line(line, p = null) {
    this.stopLine();
    if (!this.voice) return;
    if (line.speaker.includes("ELI") && !line.speaker.includes("VOICEMAIL"))
      p = null;
    if (line.audio && this.ctx) {
      const ticket = this.clipTicket;
      const clip = { ended: false, source: null };
      this.activeClip = clip;
      try {
        // AudioContext is unlocked by Enter. Buffer playback then works without a fresh browser gesture per line.
        const buffer = await this.loadClip(line.audio);
        if (ticket !== this.clipTicket || !this.voice) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        clip.source = source;
        this.clipNodes.push(source);
        let output = source;
        const profile = deviceProfile(line, this.config);
        if (/TELEPHONE|INTERCOM|VOICEMAIL|CASSETTE/.test(line.speaker)) {
          const high = this.ctx.createBiquadFilter();
          high.type = "highpass";
          high.frequency.value = 220;
          const low = this.ctx.createBiquadFilter();
          low.type = "lowpass";
          low.frequency.value = profile.intercom ? 4200 : 3400;
          source.connect(high).connect(low);
          output = low;
          this.clipNodes.push(high, low);
        }
        if (line.voiceProfile === "mara-device") {
          // Parallel dry/wet path retains consonants while making the school PA unmistakably damaged.
          const mix = this.ctx.createGain(),
            dry = this.ctx.createGain();
          dry.gain.value = 1 - profile.depth * 0.35;
          output.connect(dry).connect(mix);
          const band = this.ctx.createBiquadFilter();
          band.type = "bandpass";
          band.frequency.value = profile.intercom ? 1700 : 1400;
          band.Q.value = 0.45;
          const robot = this.ctx.createGain();
          robot.gain.value = 0.55;
          const carrier = this.ctx.createOscillator(),
            amount = this.ctx.createGain();
          carrier.frequency.value = profile.carrier;
          amount.gain.value = profile.depth * 0.5;
          const wet = this.ctx.createGain();
          wet.gain.value = profile.depth * 0.85;
          output.connect(band);
          if (this.ctx.createWaveShaper && profile.depth > 0) {
            const grit = this.ctx.createWaveShaper();
            grit.curve = deviceDistortionCurve(profile.depth);
            grit.oversample = "2x";
            band.connect(grit).connect(robot);
            this.clipNodes.push(grit);
          } else band.connect(robot);
          robot.connect(wet).connect(mix);
          carrier.connect(amount).connect(robot.gain);
          carrier.start();
          this.clipNodes.push(mix, dry, band, robot, carrier, amount, wet);
          this.clipModulators.push(carrier);
          output = mix;
          if (profile.intercom && this.ctx.createDelay) {
            const delay = this.ctx.createDelay(0.5),
              tail = this.ctx.createGain();
            delay.delayTime.value = 0.085;
            tail.gain.value = 0.18;
            mix.connect(delay).connect(tail);
            const sum = this.ctx.createGain();
            mix.connect(sum);
            tail.connect(sum);
            output = sum;
            this.clipNodes.push(delay, tail, sum);
          }
        }
        const level = this.ctx.createGain();
        level.gain.value = profile.gain;
        output.connect(level);
        output = level;
        this.clipNodes.push(level);
        if (line.speaker.includes("TEACHER")) {
          const damaged = this.ctx.createBiquadFilter();
          damaged.type = "lowpass";
          damaged.frequency.value = 5600;
          output.connect(damaged);
          output = damaged;
          this.clipNodes.push(damaged);
        }
        if (p) {
          const pan = this.ctx.createPanner();
          pan.panningModel = "HRTF";
          pan.refDistance = profile.refDistance;
          pan.rolloffFactor = profile.rolloff;
          pan.positionX.value = p.x;
          pan.positionY.value = p.y ?? 1.7;
          pan.positionZ.value = p.z;
          output.connect(pan).connect(this.buses?.voices || this.master);
          this.clipNodes.push(pan);
        } else output.connect(this.buses?.voices || this.master);
        source.onended = () => {
          clip.ended = true;
          this.applyMix();
          this.clipModulators.forEach((node) => {
            try {
              node.stop();
            } catch {}
          });
          this.clipModulators = [];
        };
        source.start();
        this.applyMix();
      } catch (error) {
        if (ticket !== this.clipTicket) return;
        this.clipBuffers.delete(line.audio);
        this.stopLine();
        console.warn("Voice clip unavailable:", line.audio);
        // Missing recordings remain subtitled; never fall back to robotic OS readouts.
      }
      return;
    }
    if (line.speaker.includes("TEACHER")) this.cue("breath", p);
  }
  stopLine() {
    this.clipTicket++;
    if (this.activeClip?.source) {
      this.activeClip.source.onended = null;
      try {
        this.activeClip.source.stop();
      } catch {}
    }
    this.activeClip = null;
    this.clipModulators.forEach((node) => {
      try {
        node.stop();
      } catch {}
    });
    this.clipModulators = [];
    this.clipNodes.forEach((node) => node.disconnect());
    this.clipNodes = [];
    window.speechSynthesis?.cancel();
  }
  mode(state) {
    if (this.ctx) {
      this.rainGain.gain.setTargetAtTime(
        state === "memory" || state === "normal" ? 0.09 : 0.26,
        this.ctx.currentTime,
        1,
      );
      this.humGain.gain.setTargetAtTime(
        state === "burned" ? 0.026 : 0.014,
        this.ctx.currentTime,
        1,
      );
    }
  }
  async suspend() {
    window.speechSynthesis?.pause?.();
    await this.ctx?.suspend();
  }
  async resume() {
    await this.ctx?.resume();
    window.speechSynthesis?.resume?.();
  }
}
