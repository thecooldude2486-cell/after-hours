# Mara rig

`mara-base.glb` adapts the fully clothed female Adventurer character from [Quaternius Ultimate Modular Women](https://quaternius.com/packs/ultimatemodularwomen.html), published by the author under CC0. Source glTF obtained from the [Bevy modular character example](https://github.com/hukasu/bevy-modular-characters/blob/main/assets/Adventurer.gltf). Backpack and bedroll geometry removed, skin normals smoothed, and colour palette changed to navy/charcoal school clothing. Combat animations removed; idle, walk, run, interact, and wave remain. No weapons are included.

This is an authored, skinned, stylized placeholder with a coherent face, hands, and skeleton, replacing the former assembled spheres/cylinders. It is not a photorealistic final Mara. Child scenes use a shorter rig and slightly larger head; older scenes use the full-height rig. Independent clones use authored idle/walk animation and cast torch shadows.

Production replacement: a bespoke nine-year-old Mara and an imagined older Mara, sharing recognizable facial features and school-era hair/clothing, with restrained facial expression, blinking, speech blend shapes, and hugs. Preserve head bone and animation clip mappings in `src/world/mara.js` when changing the asset.

## Mrs Vale and room shadows (v7)

Mrs Vale retains an independently cloned CC0 body skeleton with formal clothing, collar, spectacles, lanyard and badge. Her present-day form replaces the base head triangles with the sculpted, bone-attached face in `world/horror-detail.js`, including recessed sockets, separate eyeballs, teeth and an animated jaw. Charred clothing and skin use procedural material and bump detail. The normal memory teacher and Mara keep their original geometry.

Room shadows are now bespoke articulated procedural meshes in `world/room-monster.js`, with textured fabric, an asymmetric hunched silhouette, elongated hands, jointed fingers and the detailed face. They no longer clone Mara. Shared world-space arm posing supports both skeleton conventions. No identity, backstory, combat meshes or weapons are added.

These remain prototype models rather than scanned production assets. Authored replacement models should preserve independent rigs, a head anchor, idle/walk support for the Teacher and stable jaw/hand anchors for scare motion.

Version 8 gives the office, phone classroom and archive shadows separate head/body proportions and fabric/skin palettes. Face anchors drive camera framing, including when the player faces a wall. The Teacher's burned shading uses interpolated irregular noise instead of visible sinusoidal stripes. Memory teacher and Mara geometry remain intact. Material and lighting improvements do not turn these into scanned models.

Version 9 adds a generated mottled skin albedo and separate linear bump texture, physical material response, wet eye highlights, asymmetrical facial relief, rounded uneven tooth crowns and finer hair strands. Room-shadow torsos have geometric fabric folds. The anonymous apparition system pools another instance of the room-shadow geometry; it does not clone Mara or alter the Teacher AI mesh. These changes preserve the independent skeletons, head/jaw anchors and v8.1 animation stability. They remain authored/procedural prototype assets, not scanned production characters.


## V14 first-person hand models

`hand-left-v14.glb` and `hand-right-v14.glb` are the authored generic human hand assets from the official Immersive Web input-profile repository. They contain continuous skinned geometry, UVs, normals and 25 joints per hand. Original MIT attribution is preserved in `HAND-LICENSE.txt`; anatomy references, exact download URLs and implementation details are in `HAND-RESEARCH.md`. The source meshes are unmodified; separate runtime skeleton clones provide the grip and relaxed poses. These are authored models, not scans.
