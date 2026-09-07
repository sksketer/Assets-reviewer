export type AssetMode = 'sprite' | 'animation';

export interface SpriteValidation {
  valid: true;
  file: File;
}

export interface SpritesheetValidation {
  valid: true;
  type: 'spritesheet';
  image: File;
  json: unknown;
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

export type AnimationValidation = SpritesheetValidation | SequenceValidation | InvalidValidation;
export type SpriteFileValidation = SpriteValidation | InvalidValidation;
