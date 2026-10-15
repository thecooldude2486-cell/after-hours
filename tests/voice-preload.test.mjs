import test from "node:test";
import assert from "node:assert/strict";
import { AudioSystem } from "../src/systems/audio.js";

test("conversation preloading deduplicates clips, stays silent, and reuses decoded speech", async () => {
  const previousFetch = globalThis.fetch,
    previousWindow = globalThis.window;
  const fetches = [],
    sources = [];
  globalThis.window = { speechSynthesis: { cancel() {} } };
  globalThis.fetch = async (path) => {
    fetches.push(path);
    return { ok: true, arrayBuffer: async () => ({ path }) };
  };
  const node = () => ({
    connect() {
      return this;
    },
    disconnect() {},
    gain: { value: 1 },
    start() {
      this.started = true;
    },
    stop() {},
  });
  try {
    const audio = new AudioSystem({});
    audio.ctx = {
      decodeAudioData: async (data) => data,
      createGain: node,
      createBufferSource() {
        const n = node();
        sources.push(n);
        return n;
      },
    };
    audio.master = node();
    audio.prepareLines([
      { audio: "one.wav" },
      { audio: "two.wav" },
      { audio: "one.wav" },
      { text: "" },
    ]);
    await Promise.all(audio.clipBuffers.values());
    assert.deepEqual(fetches, ["one.wav", "two.wav"]);
    assert.equal(sources.length, 0);
    assert.equal(audio.activeClip, null);
    assert.equal(audio.isSpeaking, false);
    await audio.line({ speaker: "ELI", text: "Come on.", audio: "one.wav" });
    assert.equal(fetches.length, 2);
    assert.equal(sources[0].buffer.path, "one.wav");
    assert.equal(sources[0].started, true);
    audio.stopLine();
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("a failed preload is retryable, and muted dialogue does not preload assets", async () => {
  const previousFetch = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => ({
    ok: ++count > 1,
    arrayBuffer: async () => new ArrayBuffer(4),
  });
  try {
    const audio = new AudioSystem({});
    audio.ctx = { decodeAudioData: async (data) => data };
    audio.prepareLines([{ audio: "retry.wav" }]);
    await assert.rejects(audio.clipBuffers.get("retry.wav"));
    assert.equal(audio.clipBuffers.has("retry.wav"), false);
    const data = await audio.loadClip("retry.wav");
    assert.equal(data.byteLength, 4);
    assert.equal(count, 2);
    audio.voice = false;
    audio.prepareLines([{ audio: "muted.wav" }]);
    assert.equal(audio.clipBuffers.has("muted.wav"), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
