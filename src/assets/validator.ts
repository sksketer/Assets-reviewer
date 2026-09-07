import type { AnimationValidation, SpriteFileValidation } from './types';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const JSON_EXTENSIONS = ['.json'];

function hasExtension(name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return hasExtension(file.name, IMAGE_EXTENSIONS);
}

export function isJsonFile(file: File): boolean {
  if (file.type === 'application/json') return true;
  return hasExtension(file.name, JSON_EXTENSIONS);
}

export function validateSpriteFiles(files: File[]): SpriteFileValidation {
  const images = files.filter(isImageFile);
  const jsonFiles = files.filter(isJsonFile);

  if (images.length === 0) {
    return {
      valid: false,
      error: 'Please select an image file (PNG, JPG, WEBP or GIF) to create a sprite.',
    };
  }
  if (jsonFiles.length > 0) {
    return {
      valid: false,
      error: 'A static sprite only needs a single image file. Remove the JSON file, or use "+ Animation" for a spritesheet.',
    };
  }
  if (images.length > 1) {
    return {
      valid: false,
      error: `A static sprite needs exactly one image, but ${images.length} were provided. Please select a single image file.`,
    };
  }

  return { valid: true, file: images[0] };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSpritesheetJson(json: unknown): string | null {
  if (!isPlainObject(json)) {
    return 'The spritesheet JSON must be an object with a "frames" section.';
  }
  const frames = json.frames;
  if (!isPlainObject(frames) || Object.keys(frames).length === 0) {
    return 'The spritesheet JSON is missing a valid "frames" section with at least one frame.';
  }
  for (const [name, data] of Object.entries(frames)) {
    if (!isPlainObject(data) || !isPlainObject(data.frame)) {
      return `Frame "${name}" in the spritesheet JSON is missing its "frame" rectangle (x, y, w, h).`;
    }
    const { x, y, w, h } = data.frame as Record<string, unknown>;
    if ([x, y, w, h].some((v) => typeof v !== 'number')) {
      return `Frame "${name}" in the spritesheet JSON has an invalid "frame" rectangle.`;
    }
  }
  return null;
}

export async function validateAnimationFiles(files: File[]): Promise<AnimationValidation> {
  const images = files.filter(isImageFile);
  const jsonFiles = files.filter(isJsonFile);

  if (images.length === 0) {
    return {
      valid: false,
      error: 'Please select at least one image file for the animation (either a spritesheet PNG or several frame images).',
    };
  }
  if (jsonFiles.length > 1) {
    return {
      valid: false,
      error: 'Only one JSON file is allowed for a spritesheet animation.',
    };
  }

  if (jsonFiles.length === 1) {
    // Spritesheet mode: exactly one PNG + one JSON is required.
    if (images.length !== 1) {
      return {
        valid: false,
        error: `A spritesheet animation needs exactly one image and its matching JSON, but ${images.length} images were provided alongside the JSON file.`,
      };
    }

    const jsonFile = jsonFiles[0];
    let parsed: unknown;
    try {
      const text = await jsonFile.text();
      parsed = JSON.parse(text);
    } catch {
      return {
        valid: false,
        error: `"${jsonFile.name}" is not valid JSON. Please provide the spritesheet JSON exported alongside the PNG.`,
      };
    }

    const jsonError = validateSpritesheetJson(parsed);
    if (jsonError) {
      return { valid: false, error: jsonError };
    }

    return { valid: true, type: 'spritesheet', image: images[0], json: parsed };
  }

  // No JSON provided.
  if (images.length === 1) {
    return {
      valid: false,
      error:
        'An animation needs either a spritesheet (one PNG + its JSON) or multiple frame images. ' +
        'Only one image was provided without a JSON file — please also select the spritesheet JSON, ' +
        'or select multiple images to build a frame-by-frame animation.',
    };
  }

  return { valid: true, type: 'sequence', images };
}
