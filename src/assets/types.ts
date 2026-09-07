import type { Texture } from 'pixi.js';

export type AssetMode = 'sprite' | 'animation';

export interface PlainSpriteValidation {
  valid: true;
  type: 'plain';
  file: File;
}

export interface SpritesheetValidation {
  valid: true;
  type: 'spritesheet';
  image: File;
  json: unknown;
}

export interface SpritesheetPair {
  image: File;
  json: unknown;
}

export interface MultiSpritesheetValidation {
  valid: true;
  type: 'spritesheet';
  sheets: SpritesheetPair[];
}

export interface SequenceValidation {
  valid: true;
  type: 'sequence';
  images: File[];
}

export interface InvalidValidation {
  valid: false;
  error: string;
}

export type SpriteFileValidation = PlainSpriteValidation | SpritesheetValidation | InvalidValidation;
export type AnimationValidation = MultiSpritesheetValidation | SequenceValidation | InvalidValidation;

export interface FrameOption {
  name: string;
  texture: Texture;
}

/** Metadata tracked alongside a placed Sprite/AnimatedSprite, shown in the inspector panel. */
export interface AssetInfo {
  kind: 'sprite' | 'animated';
  label: string;
  fileSizeBytes: number;
  dimensionsLabel: string;
  gpuMemoryBytes: number;
  /** All frames the user can pick from in the inspector's frame selector. */
  frames: FrameOption[];
  /** For an AnimatedSprite, the frame names in the exact order of its `.textures` (so `playbackFrameNames[currentFrame]` gives the name). Null for a plain Sprite. */
  playbackFrameNames: string[] | null;
  /** Mutable: the name of the frame currently displayed, kept in sync by the inspector. */
  currentFrame: string;
}
