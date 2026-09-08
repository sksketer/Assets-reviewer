import type { AnimatedSprite, BitmapFontData, BitmapText, Sprite, Texture } from 'pixi.js';
import type { Spine } from '@esotericsoftware/spine-pixi-v8';

export type AssetMode = 'sprite' | 'animation' | 'bitmapText' | 'spine';

/** Any display object this app can place on stage, drag, scale, and inspect. */
export type PlaceableDisplay = Sprite | AnimatedSprite | BitmapText | Spine;

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

export interface BitmapFontValidation {
  valid: true;
  fontData: BitmapFontData;
  fontFileName: string;
  images: File[];
}

export type BitmapFontFilesValidation = BitmapFontValidation | InvalidValidation;

export type SpineRuntimeChoice = 'legacy' | 'modern';

export interface SpineFilesValidation {
  valid: true;
  atlasFile: File;
  skeletonFile: File;
  isBinary: boolean;
  images: File[];
}

export type SpineFileValidation = SpineFilesValidation | InvalidValidation;

export interface FrameOption {
  name: string;
  texture: Texture;
}

/** Metadata tracked alongside a placed Sprite/AnimatedSprite/BitmapText/Spine, shown in the inspector panel. */
export interface AssetInfo {
  kind: 'sprite' | 'animated' | 'text' | 'spine';
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
