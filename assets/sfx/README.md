# Sound effects v6

Actual foley from Kenney's Impact Sounds 1.0 and RPG Audio packs, licensed CC0. Sources: https://kenney.nl/assets/impact-sounds and https://kenney.nl/assets/rpg-audio . Original license files are included.

Concrete/wood footsteps, wood and metal impacts, cloth movement, door opening/closing/creaks, a metal click, a book and soft impacts are decoded to mono 24kHz PCM WAV. teacher-scare, shadow-scare, warning, escape and collapse are original timeline arrangements of those CC0 recordings with pitch/spacing changes. They are sound designs made from foley, not recorded monster vocal performances. No weapon samples were included.

The manifest is src/data/sfx.js. Runtime varies footstep takes and pitch, uses positional HRTF, limits concurrent one-shots, cleans up ended nodes, and routes effects/ambience/music/voices/scares through independently adjustable gains. Rain, PA hiss, alarm and sparse tonal music remain generated layers, mixed under the foley and speech.

Version 7 replaces teacher-scare/shadow-scare with denser stereo 24kHz PCM attacks. These mix the existing licensed foley with authored bass/noise pressure and short offset reflections; peak level is normalized to 95%, and the first attack starts within milliseconds. They are sound designs, not recorded monster voices. Runtime scare gain is higher but remains routed through master/scare controls and the limiter.

## Version 9 school scare arrangements

`hall-scare-v9.wav`, `locker-scare-v9.wav` and `screen-scare-v9.wav` are original layered arrangements of the existing bundled CC0 metal/wood/cloth impact and creak recordings, combined with authored low pressure tones and a short static transient. Each is a local three-second stereo 24 kHz PCM file. No voice or commercial music sample was added. The original source licenses above still apply. They route through the existing scare bus and are used by `data/hauntings.js`. Vanishing figures use the existing cloth cue at a lower pitch; no advance room-monster warning was restored.

## v10 performance cues

teacher-impact-v10, room-impact-v10, vanish-v10, breath-v10 and heel-v10 are original stereo 24kHz PCM designs combining the already bundled licensed CC0 foley with authored filtered-noise/low resonance layers and short spatial reflections. Breath is an authored sound design, not a recorded actor. Peaks are normalized to -1.2dBFS before the existing category controls and shared compressor. They replace the corresponding manifest cue sources; room-grab timings and escape rules remain unchanged.

## V13 recorded scream and environmental foley

`teacher-impact-v13.wav` and `room-impact-v13.wav` layer **Female Scream 2** by **DigestContent** with the bundled CC0 metal/wood/cloth/creak/soft foley, authored bass pressure and irregular stereo reflections. The scream is licensed CC0 1.0 on its primary source page: https://freesound.org/people/DigestContent/sounds/506682/ . The public HQ preview used is https://cdn.freesound.org/previews/506/506682_8541784-hq.mp3 ; the unchanged downloaded MP3 ships as `source-scream-cc0.mp3`. The recording is trimmed around leading silence, pitch-layered, mixed, soft saturated, resampled to stereo 24kHz PCM and peak normalized to about -1.1dBFS. It is a recorded vocal sound effect, not a cloned voice or new story dialogue. The scare bus/master compressor and user volume controls remain active.

`locker-open-v13.wav` combines existing CC0 door-opening, creak and metal foley. `empty-steps-v13.wav` arranges four existing floor footsteps with irregular cadence, receding gain and room reflections. They route through the ambience bus and play at authored empty-room/locker positions. Their independent 13–27 second cadence never signals room-monster spawns. They yield to dialogue, major encounters, memory/friendly school states and companion scenes.

`tools/build-sound-v13.py` rebuilds these local WAVs from the included MP3 and existing licensed foley; optional rebuild requires Python with miniaudio. Normal gameplay requires no Python, remote audio service or internet.

## V15 clarity and room-specific performances

`tools/build-sound-v15.py` uses only bundled WAVs and Python's standard library. It creates mono 24 kHz positional cues: a metal latch/hinge/open hold/closing impact for `locker-open-v15`, five separated floor impacts for `empty-steps-v15`, and three distinct monster performances. Office layers irregular wood knocks and a delayed low vocal; phone chops the recorded vocal with metallic ticks and telephone tones; archive slows the vocal under cloth scrapes, creaks and low resonance. The source vocal remains the CC0 DigestContent recording credited above. Outputs peak at approximately -1.1 dBFS before category controls and the shared limiter. Environmental cues use the effects bus with longer reference distances; monster cues use the scares bus and stop on escape/reset/capture.

## V17 apparition presence

`tools/build-sound-v17.py` creates two deterministic mono 24 kHz PCM effects from the already bundled CC0 creak/cloth/metal recordings and original synthesis. Arrival combines a breath-like noise swell, two dissonant glass tones and a low hinge strain; disappearance uses a short reverse cloth sweep and falling resonance. Both are positional on the scares bus, with extended reference distances so the arrival can be heard from the apparition reveal range. No voice clone or external generation service is used. Arrival plays once per figure per encounter reset and stops when its apparition is cancelled.
