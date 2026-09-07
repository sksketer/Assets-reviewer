import type { AnimationValidation, SpriteFileValidation, SpritesheetPair } from './types';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSpritesheetJsonShape(json: unknown): string | null {
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

async function parseSpritesheetJsonFile(file: File): Promise<{ json: unknown } | { error: string }> {
  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return { error: `"${file.name}" is not valid JSON. Please provide the spritesheet JSON exported alongside the PNG.` };
  }

  const shapeError = validateSpritesheetJsonShape(parsed);
  if (shapeError) return { error: shapeError };
  return { json: parsed };
}

function baseName(name: string): string {
  return name.replace(/\.[^./]+$/, '').toLowerCase();
}

/**
 * Pairs an arbitrary number of PNGs with an equal number of JSON files, so multiple spritesheets
 * can be loaded in one go. Each JSON is matched to a PNG via its `meta.image` filename, falling
 * back to a same-basename match (e.g. "walk.png" + "walk.json").
 */
async function pairSpritesheets(images: File[], jsonFiles: File[]): Promise<{ sheets: SpritesheetPair[] } | { error: string }> {
  if (images.length !== jsonFiles.length) {
    return {
      error:
        `Each spritesheet needs exactly one PNG and one matching JSON. You selected ${images.length} image(s) ` +
        `and ${jsonFiles.length} JSON file(s) — the counts must match.`,
    };
  }

  const usedImageIndexes = new Set<number>();
  const sheets: SpritesheetPair[] = [];

  for (const jsonFile of jsonFiles) {
    const parsed = await parseSpritesheetJsonFile(jsonFile);
    if ('error' in parsed) return { error: parsed.error };

    const meta = isPlainObject(parsed.json) ? parsed.json.meta : undefined;
    const metaImageName = isPlainObject(meta) && typeof meta.image === 'string' ? meta.image : undefined;

    let matchIndex = -1;
    if (metaImageName) {
      matchIndex = images.findIndex((img, i) => !usedImageIndexes.has(i) && baseName(img.name) === baseName(metaImageName));
    }
    if (matchIndex === -1) {
      matchIndex = images.findIndex((img, i) => !usedImageIndexes.has(i) && baseName(img.name) === baseName(jsonFile.name));
    }
    if (matchIndex === -1) {
      return {
        error:
          `Could not find a matching PNG for "${jsonFile.name}". Name each spritesheet PNG and its JSON the same ` +
          '(e.g. "walk.png" + "walk.json"), or make sure the JSON\'s "meta.image" matches an uploaded PNG\'s filename.',
      };
    }

    usedImageIndexes.add(matchIndex);
    sheets.push({ image: images[matchIndex], json: parsed.json });
  }

  return { sheets };
}

export async function validateSpriteFiles(files: File[]): Promise<SpriteFileValidation> {
  const images = files.filter(isImageFile);
  const jsonFiles = files.filter(isJsonFile);

  if (images.length === 0) {
    return {
      valid: false,
      error:
        'Please select an image file (PNG, JPG, WEBP or GIF) to create a sprite — ' +
        'or a PNG plus its spritesheet JSON to create a sprite from one frame of a spritesheet.',
    };
  }
  if (jsonFiles.length > 1) {
    return {
      valid: false,
      error: 'Only one JSON file is allowed when creating a sprite from a spritesheet.',
    };
  }

  if (jsonFiles.length === 1) {
    if (images.length !== 1) {
      return {
        valid: false,
        error: `A spritesheet sprite needs exactly one image and its matching JSON, but ${images.length} images were provided alongside the JSON file.`,
      };
    }
    const result = await parseSpritesheetJsonFile(jsonFiles[0]);
    if ('error' in result) return { valid: false, error: result.error };
    return { valid: true, type: 'spritesheet', image: images[0], json: result.json };
  }

  if (images.length > 1) {
    return {
      valid: false,
      error:
        `A static sprite needs exactly one image, but ${images.length} were provided. ` +
        'Select a single image, or a PNG plus its JSON to pick a frame from a spritesheet.',
    };
  }

  return { valid: true, type: 'plain', file: images[0] };
}

export async function validateAnimationFiles(files: File[]): Promise<AnimationValidation> {
  const images = files.filter(isImageFile);
  const jsonFiles = files.filter(isJsonFile);

  if (images.length === 0) {
    return {
      valid: false,
      error: 'Please select at least one image file for the animation (one or more spritesheet PNGs, or several frame images).',
    };
  }

  if (jsonFiles.length > 0) {
    // Spritesheet mode: one or more PNG + JSON pairs (a single spritesheet, or several combined into one animation).
    const result = await pairSpritesheets(images, jsonFiles);
    if ('error' in result) return { valid: false, error: result.error };
    return { valid: true, type: 'spritesheet', sheets: result.sheets };
  }

  // No JSON provided.
  if (images.length === 1) {
    return {
      valid: false,
      error:
        'An animation needs either one or more spritesheets (PNG + matching JSON each) or multiple frame images. ' +
        'Only one image was provided without a JSON file — please also select its spritesheet JSON, ' +
        'or select multiple images to build a frame-by-frame animation.',
    };
  }

  return { valid: true, type: 'sequence', images };
}
