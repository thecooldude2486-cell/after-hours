// Generic once-only trigger runner. Spatial, interaction and timed events use the same dispatcher.
export class TriggerSystem {
  constructor(actions) {
    this.actions = actions;
    this.fired = new Set();
    this.generation = 0;
    this.busy = false;
  }
  matches(trigger, event, context) {
    return (
      trigger.event === event.type &&
      (!trigger.target || trigger.target === event.target) &&
      (!trigger.when || trigger.when(context, event))
    );
  }
  async run(trigger, context) {
    if (this.busy || this.fired.has(trigger.id)) return false;
    this.busy = true;
    const generation = this.generation;
    this.fired.add(trigger.id);
    try {
      for (const effect of trigger.effects || []) {
        if (generation !== this.generation) return false;
        const action = this.actions[effect.type];
        if (!action) throw new Error("Unknown story action: " + effect.type);
        await action(effect, context);
      }
    } finally {
      if (generation === this.generation) this.busy = false;
    }
    return generation === this.generation;
  }
  reset() {
    this.generation++;
    this.fired.clear();
    this.busy = false;
  }
}
