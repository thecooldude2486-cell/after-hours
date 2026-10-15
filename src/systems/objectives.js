export class ObjectiveSystem {
  constructor(element) {
    this.element = element;
    this.id = null;
    this.text = "";
  }
  set(id, text) {
    this.id = id;
    this.text = text;
    this.element.textContent = text;
  }
  clear() {
    this.set(null, "");
  }
}
