# V23 validation — 15 October 2026

- All 105 automated tests pass.
- The west-wing test moves the real player collision controller from the main corridor through the library, infirmary, workshop and boiler room. It physically pushes the new doors, collects the linked keys/tools, isolates the steam line, opens the wired fuse case, and restores the solved steam/collected-item state from a save.
- Every concealed-room entrance refuses entry without the iron caretaker key, while retaining its existing tool or keypad prerequisite.
- Tests verify blood artwork and normal/memory chalk state swaps, 1.05 m by 2.1 m classroom leaves, matching wall infill, player movement, door collision and visible apparitions after adjusting their doorway position for the narrower opening.
- The complete Normal story simulation reaches the original ending with zero captures and no progression blockers. All five original item-layout access audits, checkpoint anchors, perception, resource, hiding and ambush checks pass.
- Navigation uses a finer grid so narrow classroom and annex entrances remain usable by characters.
- Live WebGL appearance is unverified; no live visual or subjective audio review is claimed.

---

# V22 validation — 15 October 2026

- All 102 automated tests pass.
- New coverage uses the real player collision controller to push unlocked doors from both sides, verifies no opening at rest, locked-door blocking, long-frame sprint contact, ajar/unlocked save restoration, and rejection of a close action when a body occupies the doorway.
- All five secret entrances remain physically traversable and navigable after being pushed. The connected item route exercises the keypad, rescue case and physically crossed fire exit. Existing checkpoint, inventory, apparition, locker, resource and encounter checks pass.
- CRT tests verify the screen, nearby glow and small hallway spill toggle together without changing the corridor switch state. The journal has no hint function or button and lists carried names plus discovered notes.
- The complete Normal story simulation reaches its original ending with zero captures and no progression blockers, exercising physical door pushes, both pursuit sections and all checkpoint anchors. A separate real-game chase audit also reaches Classroom 08 with zero captures.
- HTTP checks confirm that port 4173 returns the v22 page. Live WebGL lighting and door appearance remain unverified in this session.

---

# V21 validation — 15 October 2026

- All 96 automated tests pass. After the encounter-save revision change and final facial refinements, all 13 apparition-system tests and all 4 face/clarity tests also pass.
- Locker visibility tests use the real scene and a ray from the normal approach to the hanging key. They verify visible contents during door motion, no early collection, disappearance after collection, and persistence after restore.
- Every collision-only shell stays invisible through normal, burned, distorted and ruined environment changes. Corridor lockers contain hollow shells, shelves and physical school clutter.
- Geometry previews were rendered and inspected for apparition face/silhouette and open key/fuse lockers. They approximate geometry and materials; live WebGL lighting is not verified in this session.
- The v21 page is served successfully on 127.0.0.1:4173. The apparition save revision rearms encounters from older saves without changing story progress.

---

# V20 validation — 15 October 2026

- All 94 automated tests pass.
- New coverage traverses all five entrances with real collision and navigation, verifies every new interactable can be selected from an unobstructed standing position, and completes the connected item route through the alternate escape.
- Missing tools, absent projector power, incorrect/correct keypad codes, chained rescue case, evidence requirement, journal persistence, collected-item persistence, projector-state restoration, old saves and one-time sanity repair bonus are covered.
- Full Normal story simulation reaches the original ending with zero captures and no progression blockers. All five original preset layouts, checkpoint anchors, room ambushes, perception, stamina, hiding and movement checks pass.
- HTTP checks confirm that the local server returns the v20 page, controls, scripts, stylesheet, model and Three.js successfully at port 4173.
- Live visual rendering is unverified: the UI automation kernel fails at startup, and headless Chrome aborts in this sandbox. No live visual or subjective audio verification is claimed.

---

# V19 validation — 14 October 2026

- All 90 automated tests pass. New coverage checks physically blocked/open secret entrances, navigable passages below lintels, key-locked panels, two levels of nested storage, hidden loot gating, kit use/clamping/count persistence, stationary lit grounding recovery and interruption, and slow recovery after zero-stamina exhaustion.
- The complete Normal story simulation reaches the original ending with zero captures and no progression soft locks. All three room ambushes, checkpoint recovery, perception, movement/jump and all five original item-layout solvability audits pass.
- Original required items retain their preset-dependent containers; new loot uses fixed optional caches and persists through inventory saves. Closing an outer crate hides its nested toolbox and contents.
- Live WebGL rendering remains unverified because browser automation cannot initialize in this session. No live visual or subjective audio verification is claimed.
- Load http://127.0.0.1:4173/?v=19. The user-facing spoiler guide is saved in the current chat's outputs directory.

# V18 validation — 14 October 2026

- All 86 automated tests pass. New resource coverage simulates one minute of both walking and sprinting at full and partial sanity, verifying zero movement loss in safe lit exploration and continued independent darkness drain.
- Geometry checks require a partial visible head, a valid sight point inside all clipping planes and hidden lower-body geometry. Existing unconditional distance retreat/no-close-spawn tests pass.
- Both first-person hand roots are visible; grip, forward aim, deformation and animation checks continue to pass.
- Live GPU rendering remains unverified because the browser automation kernel is unavailable. Open http://127.0.0.1:4173/?v=18 to load this revision.

# V17 validation — 14 October 2026

- 85 automated tests pass. Added checks verify sculpted face/coat/hands, separate mono arrival/retreat WAVs with non-clipping peaks, and unconditional retreat/no respawn inside the safety boundary for every apparition.
- Existing real-school visibility, door-leaf occlusion, save rearming, stationary gaze timeout, hand deformation/contact/aim and encounter cleanup checks pass.
- The complete Normal story simulation reaches the original ending with zero captures and no soft locks; all three room monsters, checkpoints and progression checks pass.
- CPU raster previews were inspected for the new figure and three wrist orientations; the chosen holding pose has a rolled fist and forearm entering from the lower right. These previews approximate geometry and materials, not live WebGL.
- Live GPU rendering and subjective SFX listening remain unverified: browser automation still fails during sandbox initialization. The new version is http://127.0.0.1:4173/?v=17.

# V16 validation — 14 October 2026

- All 83 automated tests pass. New checks cover reduced ambient/reflection/exterior/fixture lighting in all three horror states and full lighting restoration in normal/memory scenes. Flashlight-off hand fill is checked independently.
- Locker behavior and sound restored to the pre-V15 version; clearer footsteps retained. Existing locker/collider tests pass.
- Grip checks now measure clearance in the tilted barrel's coordinate frame. Hand skeleton/deformation, thumb position, forward aim and animation drift checks pass. A CPU raster preview of the actual deformed hand geometry was visually inspected.
- Live GPU rendering remains unverified. The CPU preview verifies pose/placement but does not reproduce WebGL materials or final in-game lighting.

# V15 validation — 14 October 2026

- 82 automated tests pass with the bundled Node runtime. Added checks cover actual clipped head geometry and sight points for every apparition, distinct room monster poses and mono WAV sources, and flashlight forward alignment. Existing hand deformation/contact, renderer lifecycle, real school sight lines, save/reset, dialogue suppression, physics and encounter tests pass.
- Ambient locker tests verify opening beyond 57 degrees and holding that opening. Environmental and player footsteps use clearer mix settings. Audio generation is deterministic and uses bundled licensed sources only.
- The complete Normal story simulation reaches the original ending with zero captures and no soft locks. It clears all three room ambushes, witnesses school hauntings, and passes all checkpoint anchors, five item-layout solvability audits, perception, capture/recovery, physics and flashlight checks.
- Live WebGL rendering and subjective listening were not verified: the browser automation kernel fails to launch with a sandbox initialization error. No screenshot or live playtest is claimed.
- Reload http://127.0.0.1:4173/?v=15 to load the updated modules. The static server serves the edited game directory directly.

Previous validation follows for historical context; V15 tuning supersedes its V14 values.

# V14 validation — 14 October 2026

## Verified

- **79 automated checks pass.** New hand checks load the real left/right GLBs and exercise 25-joint hierarchies, positive scales, independent skeletons, anatomical handedness, retained bone lengths, normalized skin weights, finite deformed vertices, flashlight grip clearance and no animation drift. Existing first-person frustum, beam-origin, movement, jump, hiding and capture tests pass.
- **Story and Normal reach the original ending with zero captures and no progression soft locks.** The actual Three.js school, player controller, interaction targets and story systems run through both complete routes. Both witness vanishing figures, clear all three room ambushes, exercise keys/locks, environment swaps, hiding and checkpoint recovery. All five required-item layouts pass solvability audits.
- Apparitions use volumetric 3D meshes with no texture map, plane or sprite. Fixed world-space clipping exposes a narrow portion behind each doorway. Tests check fixed orientation, geometry, clipping, timed disappearance while stationary, approach retreat, witnessed-save persistence, interrupted rearming, actual door-leaf occlusion and memory/emotional-scene suppression.
- New renderer lifecycle checks exercise the actual mask/resolve controller: figure-only object-ID/depth pass, shared clipping planes, sizing, mandatory blur with lens effects disabled and without float targets, direct rendering when the figure disappears, and camera/scene/clear-state restoration after a failed mask render. Shader output itself is not GPU-tested.
- A CPU raster preview of transformed skinned hand triangles was inspected to check handedness, placement and grip proportions. That preview is a geometry/material approximation, not a live browser screenshot.
- The two GLBs were downloaded unchanged from the official Immersive Web assets repository. Its complete MIT license ships in assets/models/HAND-LICENSE.txt. Primary anatomy references, asset provenance and implementation limits ship in HAND-RESEARCH.md. Models are authored human hands, not scans.
- The local server listens on 127.0.0.1:4173. HTTP responses for the entry page, startup/viewmodel/hand/figure/rendering modules, both GLBs and the hand license match workspace bytes. V14 identifies the title screen and top-level module/style URLs. The F2 figure demonstration still restores the Locker checkpoint before showing the doorway.
- Original story, ending, Mara voice assignments, Teacher/capture presentation and environmental audio retain their existing automated coverage.

## Limits

Live GPU rendering remains unverified: in-app browser automation failed to start with a trusted Node process error. The CPU preview and DOM/audio-stubbed simulations establish geometry, state changes and progression, not final WebGL skin shading, rendered blur quality, frame rate or subjective realism. No subjective voice/SFX listening was performed in this pass.

## Repeat

`npm test`; full routes: `AFTER_HOURS_PRESET=story node tests/simulation.mjs` and `AFTER_HOURS_PRESET=normal node tests/simulation.mjs`. Logs are in workspace work/qa/v14-unit.log, v14-story.log and v14-normal.log; HTTP hashes are in v14-http.json. Open `http://127.0.0.1:4173/?v=14`. F2 → View Vanishing Figure provides a checkpoint-based approach-retreat demonstration. Tuning references are in README.md.
