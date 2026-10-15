# V14 hand anatomy and implementation

Research performed 14 October 2026. The goal is a believable left/right first-person hand and power grip, with continuous skin and real joint chains rather than separate tubes. These meshes are authored human hand assets; they are not photographs, hand scans, or actor-specific likenesses.

## Primary references

- [American Society for Surgery of the Hand: hand bones](https://assh.my.site.com/handcare/safety/bones): ordinary fingers have proximal/middle/distal phalanges; the thumb has proximal/distal phalanges and a mobile metacarpal. This informed joint counts, segment lengths and separate thumb opposition.
- [IQWiG / NCBI Bookshelf: How do hands work?](https://www.ncbi.nlm.nih.gov/books/NBK279362/): power and precision grips, thumb opposition and the coordinated work of fingers/palm. The right pose is a cylindrical power grip, with a relaxed left hand.
- [Immersive Web input profiles](https://github.com/immersive-web/webxr-input-profiles): authored continuous hand meshes with 25 joints, UVs, normals and skin weights.
- [Three.js SkinnedMesh](https://threejs.org/docs/pages/SkinnedMesh.html): bone deformation and continuous skinning.
- [Three.js material clipping](https://threejs.org/docs/pages/Material.html): clipping planes are defined in world space. The apparition retains fixed planes while its geometry retreats.

## Exact assets and license

Files copied unchanged:

- `hand-left-v14.glb`: https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/profiles/generic-hand/left.glb
- `hand-right-v14.glb`: https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/profiles/generic-hand/right.glb
- `HAND-LICENSE.txt`: https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/assets/LICENSE.md

The asset collection's MIT license is Copyright (c) 2019 Amazon. The complete notice is bundled unchanged. Each mesh has 1,360 skin vertices and 2,314 triangles. This modest asset density suits the browser prototype; it is not a claim of scanned or AAA character quality.

## Runtime choices

`world/hand-rig.js` clones left/right templates with independent skeletons, reconstructs each phalangeal hierarchy while preserving its bind pose, rotates each model into its anatomical basis without negative/mirrored scale, and poses the real bones. Segment lengths and skin weights remain intact. Four MCP/PIP/DIP chains curl around the right-hand flashlight; a small CCD thumb solution opposes that grip. The left hand has a separate resting pose. Nails follow distal bones. Sway moves hand mounts, so joint poses do not accumulate drift.

The flashlight has a 35mm grip, with a wider head outside the finger contact region. The skin uses the existing photographic healthy-skin albedo and shallow bump; skin scattering, high-density forearm scans and full authored interaction animation remain future asset work.

Validation checks separate handedness, independent bone instances, segment lengths, normalized weights, finite skinned vertices, grip clearance, on-screen mounts and frame-to-frame drift. A software raster preview of the transformed meshes was inspected, but it does not validate live WebGL skin shading or subjective final realism. Live GPU rendering remains unverified because browser automation failed to start in this environment.
