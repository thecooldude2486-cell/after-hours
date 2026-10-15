import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { VOICES } from "../src/data/voices.js";
import { DIALOGUE } from "../src/data/dialogue.js";
import { NOTES } from "../src/data/notes.js";
import { AudioSystem } from "../src/systems/audio.js";

test("photos and the drawing are real PNG assets connected to the inspection view", async () => {
  for (const id of ["photo", "drawing"]) {
    assert.ok(NOTES[id].image);
    assert.equal(NOTES[id].body, "");
    const data = await readFile(
      new URL("../" + NOTES[id].image, import.meta.url),
    );
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.ok(data.readUInt32BE(16) >= 1000);
    assert.ok(data.readUInt32BE(20) >= 700);
  }
});

test("every spoken source line has a non-silent bundled WAV with enough subtitle time", async () => {
  let count = 0;
  const cache = new Map();
  for (const lines of Object.values(DIALOGUE))
    for (const line of lines) {
      if (!line.text || !line.speaker || line.text.startsWith("[")) continue;
      assert.ok(line.audio, "Clip assigned: " + line.text);
      let data = cache.get(line.audio);
      if (!data) {
        data = await readFile(new URL("../" + line.audio, import.meta.url));
        cache.set(line.audio, data);
      }
      assert.equal(data.subarray(0, 4).toString(), "RIFF");
      assert.equal(data.subarray(8, 12).toString(), "WAVE");
      const rate = data.readUInt32LE(24),
        channels = data.readUInt16LE(22),
        bits = data.readUInt16LE(34);
      assert.equal(bits, 16);
      const at = data.indexOf(Buffer.from("data"), 36),
        bytes = data.readUInt32LE(at + 4),
        duration = bytes / (rate * channels * 2);
      assert.ok(duration > 0.25);
      assert.ok(line.duration >= duration, "Subtitle waits for " + line.text);
      let peak = 0;
      for (let offset = at + 8; offset < at + 8 + bytes; offset += 2)
        peak = Math.max(peak, Math.abs(data.readInt16LE(offset)));
      assert.ok(peak > 300, "Speech waveform is non-silent: " + line.text);
      count++;
    }
  for (const [group, lines] of Object.entries(DIALOGUE))
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.text || !line.speaker || line.text.startsWith("[")) continue;
      const take = VOICES[group + ":" + i];
      assert.equal(take.text, line.text, "Audio script matches subtitle");
      assert.equal(
        take.revision,
        take.character.startsWith("mara") ? 12 : 11,
        "Every spoken assignment uses the correct revised take",
      );
    }
  assert.equal(count, 57);
  assert.equal(cache.size, 54);
});

test("buffer speech waits for audio, pauses without losing a line, and cancels stale loads", async () => {
  const previousWindow = globalThis.window,
    previousFetch = globalThis.fetch;
  const sources = [];
  let release;
  globalThis.window = {
    speechSynthesis: {
      cancel() {},
      pause() {},
      resume() {},
      speaking: false,
      pending: false,
    },
  };
  globalThis.fetch = async (url) => {
    if (url === "first.wav") await new Promise((r) => (release = r));
    return { ok: true, arrayBuffer: async () => ({ url }) };
  };
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {},
    type: "",
    frequency: { value: 0 },
  });
  const ctx = {
    state: "running",
    decodeAudioData: async (bytes) => bytes,
    createGain: () => ({ ...node(), gain: { value: 1 } }),
    createBufferSource() {
      const source = {
        ...node(),
        started: false,
        stopped: false,
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
    suspend: async function () {
      this.state = "suspended";
    },
    resume: async function () {
      this.state = "running";
    },
  };
  try {
    const audio = new AudioSystem({ audioVolume: 0.7 });
    assert.equal(audio.voice, true);
    audio.ctx = ctx;
    audio.master = node();
    const first = audio.line({
      speaker: "MARA",
      text: "Still here.",
      audio: "first.wav",
    });
    assert.equal(audio.isSpeaking, true);
    await audio.line({
      speaker: "ELI",
      text: "Where are you?",
      audio: "second.wav",
    });
    release();
    await first;
    assert.equal(
      sources.length,
      1,
      "A superseded fetch never starts a stale voice",
    );
    assert.equal(sources[0].started, true);
    await audio.suspend();
    assert.equal(ctx.state, "suspended");
    assert.equal(sources[0].stopped, false);
    assert.equal(audio.isSpeaking, true);
    await audio.resume();
    assert.equal(ctx.state, "running");
    sources[0].onended();
    assert.equal(audio.isSpeaking, false);
    audio.stopLine();
    assert.equal(sources[0].stopped, true);
    assert.equal(audio.isSpeaking, false);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});

test("device speech starts and cleans up a robotic carrier; childhood dialogue bypasses it", async () => {
  const previousWindow = globalThis.window,
    previousFetch = globalThis.fetch;
  globalThis.window = { speechSynthesis: { cancel() {} } };
  globalThis.fetch = async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(8),
  });
  const filters = [],
    oscillators = [];
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {},
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0 },
    start() {
      this.started = true;
    },
    stop() {
      this.stopped = true;
    },
  });
  try {
    const audio = new AudioSystem({ audioVolume: 0.7 });
    audio.ctx = {
      decodeAudioData: async () => ({}),
      createBufferSource: node,
      createBiquadFilter() {
        const n = node();
        filters.push(n);
        return n;
      },
      createGain: node,
      createOscillator() {
        const n = node();
        oscillators.push(n);
        return n;
      },
    };
    audio.master = node();
    await audio.line(DIALOGUE.intercom[0]);
    assert.equal(oscillators.length, 1);
    assert.equal(oscillators[0].frequency.value, 47);
    assert.equal(oscillators[0].started, true);
    assert.ok(filters.some((f) => f.type === "bandpass"));
    const total = filters.length;
    await audio.line(DIALOGUE.argument[0]);
    assert.equal(oscillators[0].stopped, true);
    assert.equal(filters.length, total);
    assert.equal(audio.clipModulators.length, 0);
    audio.stopLine();
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
