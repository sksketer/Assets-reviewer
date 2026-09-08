/**
 * Live playback controls for a placed Spine item, shown in the Inspector panel. Both the modern
 * (Pixi v8) and legacy (pixi-spine, Pixi v7 bridged through a Sprite) factories register one of
 * these per created display, so the Inspector never needs to know which runtime it's talking to.
 */
export interface SpineControlHandle {
  /** Human-readable runtime description, e.g. "Spine >= 4.0 (Esoteric Software spine-pixi-v8)". */
  runtimeLabel: string;
  /** The Spine editor version the skeleton was exported with, e.g. "4.1.20" or "3.8.75". */
  spineVersion: string;
  /** Every animation name declared in the skeleton, for the Inspector's animation-switch dropdown. */
  animationNames: string[];
  getAnimationName(): string | null;
  /** Switches the playing animation; pass null to revert to the setup pose. */
  setAnimation(name: string | null): void;
  getLoop(): boolean;
  setLoop(loop: boolean): void;
  getSpeed(): number;
  setSpeed(speed: number): void;
  getPlaying(): boolean;
  setPlaying(playing: boolean): void;
}

const registry = new WeakMap<object, SpineControlHandle>();

export function registerSpineControl(display: object, handle: SpineControlHandle): void {
  registry.set(display, handle);
}

export function getSpineControl(display: object): SpineControlHandle | undefined {
  return registry.get(display);
}
