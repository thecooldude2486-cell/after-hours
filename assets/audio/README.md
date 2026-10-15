# Dialogue audio v12

All Mara speech now uses Microsoft `en-US-AnaNeural`, a native female child synthetic voice. Microsoft's voice list explicitly marks it **Female, Child**: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support . The user's request applies this casting to all Mara dialogue, including older-appearance scenes, the intercom and voicemail. These are synthetic performances, not recordings of a real child actor. No pitch shifting, artificial age transformation or time stretching is applied.

Thirty unique generated takes cover 33 Mara dialogue assignments. Generation used edge-tts with natural rate/pitch. The original subtitle wording remains unchanged. Every clip is a local mono 48kHz 16-bit PCM WAV, trimmed only around silence, conservatively level matched, and faded at its edges. Speaking never calls the internet. Other cast recordings remain the v11 Seed Audio takes: Dylan for present Eli, Evan for memory Eli, Helena for Mrs Vale.

Clean masters are stored locally. Phone/PA distortion, volume and spatial effects are applied by the runtime and separately adjustable in Settings. **Test Mara Voice** auditions a clean child line; **Test Intercom** auditions its device processing.

## Recorded laughter

`v11-lastVoicemail-0.wav` derives from **child laughing.wav** by **ashjenx**, published 2011-11-19 on Freesound: https://freesound.org/people/ashjenx/sounds/135387/ . The source is CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/ . We used the publicly offered HQ MP3 preview, downmixed/resampled and level matched it, and added short edge fades. It also supplies the brief background laugh in the classroom memory. It is used as a licensed sound recording, not as a voice-cloning reference.

Exact cast IDs, generation engine, format and recorded-sound provenance are in `CAST.json`; each speech take identifies its native voice or original generation job in `src/data/voices.js`. Replace a take at its manifest path with an actor performance matching the subtitle words and update its duration. Keep device processing out of the replacement master. Child performances require appropriate supervised casting.
