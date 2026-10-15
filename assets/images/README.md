# Visible story images

These images are rendered on their classroom props and displayed at full size when inspected. They are authored game assets for fictional characters, generated with the built-in image_gen tool using the imagegen skill, then copied into this project.

- `assets/images/first-day.png`: Eli holding Mara's hand on her first day at school. She looks up at him rather than at the camera.
- `assets/images/mara-drawing.png`: Mara's childhood drawing, “ME + ELI VS THE WORLD”.

## Photograph prompt

Use case: photorealistic-natural. Asset type: in-game childhood family photograph for psychological horror game AFTER HOURS. Create one single landscape 4:3 candid analogue family snapshot, photographed on consumer 35mm film around 1999, of fictional siblings Eli and Mara on Mara's first day at their ordinary school. A protective older schoolboy with short brown hair, simple dark navy school sweater and grey trousers holds the hand of his younger little sister with brown shoulder-length hair, navy school cardigan, grey pleated skirt, pale shirt, backpack; she looks up at her brother rather than at the camera. Both fully clothed, ordinary and innocent, standing outside modest brick school entrance in soft morning daylight. Subtle film grain, mildly faded colors, genuine off-center imperfect family composition, emotionally warm and believable. No horror entity, no supernatural elements, no text or written names, no captions, no watermark, no decorative border. Fill the entire image with the photograph. Do not depict a paper note or explanation of a photograph. This must be the visible photograph itself.

## Drawing prompt

Use case: illustration-story. Asset type: in-game childhood drawing for AFTER HOURS. Produce a single flat scanned white school-paper page, landscape 4:3, with a believable little child's uneven colored-pencil and wax-crayon drawing of two siblings holding hands: a taller brown-haired older brother wearing a navy school sweater and grey trousers, and a smaller brown-haired younger sister wearing a navy cardigan and grey skirt. Simple stick arms, big round heads, uneven smiles, loose childlike proportions, hand-drawn sun in one corner, two figures centered. Handwritten child lettering at top must read exactly: ME + ELI VS THE WORLD. Innocent, affectionate and imperfect, not polished vector art, not a sophisticated adult illustration. Subtle paper fiber. No photo, no handwriting explaining the drawing, no extra words, no watermarks, no horror elements. Show the drawing itself filling the image, not a person holding it.

## Environmental contact sheets (v8)

- `school-contact-haunted-v8.png`: a 2×2 fictional photographic print showing abandoned desks/board with a scratched-out adult figure, a locker corridor with a distant silhouette, a burned gym/bracelet and a cassette/CRT with an unsettling reflection. No injured children or new character identities are depicted.
- `school-contact-friendly-v8.png`: an edited counterpart with clean sunlit desks, ordinary lockers, a friendly gym and educational CRT/cassette equipment.

Both were generated with the built-in imagegen tool and imagegen skill, then copied unchanged into the project. They are whole contact sheets, presented as wall prints and inspectable images, not claimed archival photographs. `src/world/school-art.js` switches them with the room/environment state. They are supplemental atmosphere and do not replace `first-day.png` or `mara-drawing.png`.

Haunted prompt direction: photorealistic analogue 1990s/early-2000s school contact sheet, four equal photographs, believable ordinary architecture, wet cold decay, subtle disturbing adult silhouette/reflection and fire aftermath, no text captions, no gore or injured children, no additional lore. Friendly edit direction: preserve the four scene compositions, replace decay/threat with clean bright ordinary school life, remove disturbing markings/reflections/silhouettes, warm daylight and friendly educational details.

## Unsettling staff photograph (v8.1)

`staff-photograph-v81.png` was created with the built-in imagegen tool and copied unchanged into this project. It is a fictional anonymous adult group portrait, not a real school photograph or a new named story character. It replaces the primary horror print in four locations; the archive retains the v8 haunted contact sheet. Five enlarged prints have a small emissive contribution for low-light readability and swap to the friendly v8 contact sheet in normal/memory states.

Final generation prompt:

Use case: photorealistic horror environmental prop for fictional psychological horror game AFTER HOURS. Create a single landscape 3:2 analogue school STAFF GROUP PHOTOGRAPH circa 1999, no border, no contact sheet. A line of seven fully clothed adult teachers (all clearly age 30 to 60) standing in an ordinary fluorescent school corridor, formal cardigans and blouses, sensible skirts/trousers, staff badges without readable text. Visually deeply disturbing: the exact same unsettling adult female face seems to repeat across different adults; unnaturally elongated but physically believable faces, deep black recessed eye sockets, unnervingly wide forced closed-lip smiles, heads tilted slightly at conflicting angles. One tall adult teacher behind the front row has a dark gaping mouth and faint pale eyes, partially obscured by real photographic motion blur. Huge warped human shadow on wall behind them. Camera-flash forensic documentary feel with dusty faded color print, small scratches and water stain, recognizable realistic people and skin and believable ordinary corridor. Make horror immediately visible at small in-game size through strong facial contrast and composition. Cold oppressive realism, uncanny rather than cartoon or fantasy. No children, no injuries, no dismemberment, no gore, no demons/horns, no text captions, no logos, no watermark. This is an anonymous ambiguous atmosphere photograph, no plot explanation or new named character. Fill whole image with the photograph.

Version 9 replaces repeated horror print assignments with six distinct pictures and replaces the canvas blood font with three genuine transparent RGBA decal images. Four new photographs, three blood-writing assets, the skin tile, exact prompts and integration notes are in [V9-ART.md](V9-ART.md). All were produced using the built-in imagegen tool and copied unchanged into the project. Physical paper geometry, torn alpha masks and classroom grime are native code assets.
