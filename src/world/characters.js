import { createMara, animateMara } from "./mara.js";
import { createTeacher, animateTeacher } from "./teacher-model.js";
export function createCharacter(kind = "mara") {
  return kind === "mara" ? createMara() : createTeacher(kind);
}
export function animateCharacter(root, dt, time) {
  if (root.userData.kind?.startsWith("teacher")) animateTeacher(root, dt, time);
  else animateMara(root, dt, time);
}
