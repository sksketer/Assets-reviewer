import { bitmapFontTextParser, bitmapFontXMLStringParser } from 'pixi.js';
import type { AnimationValidation, BitmapFontFilesValidation, SpineFileValidation, SpriteFileValidation, SpritesheetPair } from './types';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const JSON_EXTENSIONS = ['.json'];
const FONT_EXTENSIONS = ['.fnt', '.xml'];
const ATLAS_EXTENSIONS = ['.atlas', '.atlas.txt'];
const SKELETON_BINARY_EXTENSIONS = ['.skel', '.bin'];

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

export function isFontFile(file: File): boolean {
  return hasExtension(file.name, FONT_EXTENSIONS);
}

export function isAtlasFile(file: File): boolean {
  return hasExtension(file.name, ATLAS_EXTENSIONS);
}

export function isSkeletonBinaryFile(file: File): boolean {
  return hasExtension(file.name, SKELETON_BINARY_EXTENSIONS);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * TexturePacker (and some other tools) can export spritesheet JSON with `frames` as an ARRAY of
 * `{ filename, frame, ... }` entries instead of the dictionary keyed by frame name that Pixi's
 * `Spritesheet` class (and our own validation) expects. Convert the array form to the dictionary
 * form here so both shapes load correctly.
 */
function normalizeSpritesheetJson(json: unknown): unknown {
  if (!isPlainObject(json) || !Array.isArray(json.frames)) return json;

  const frames: Record<string, unknown> = {};
  for (const entry of json.frames) {
    if (!isPlainObject(entry)) continue;
    const filename = entry.filename ?? entry.name;
    if (typeof filename !== 'string') continue;
    const { filename: _filename, name: _name, ...rest } = entry;
    frames[filename] = rest;
  }
  return { ...json, frames };
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

  const normalized = normalizeSpritesheetJson(parsed);
  const shapeError = validateSpritesheetJsonShape(normalized);
  if (shapeError) return { error: shapeError };
  return { json: normalized };
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

export async function validateBitmapFontFiles(files: File[]): Promise<BitmapFontFilesValidation> {
  const fontFiles = files.filter(isFontFile);
  const images = files.filter(isImageFile);

  if (fontFiles.length === 0) {
    return {
      valid: false,
      error: 'Please select a bitmap font file (.fnt or .xml) plus the texture PNG(s) it references.',
    };
  }
  if (fontFiles.length > 1) {
    return { valid: false, error: 'Only one bitmap font file (.fnt or .xml) is allowed.' };
  }
  if (images.length === 0) {
    return {
      valid: false,
      error: "Please also select the bitmap font's texture PNG(s) — the image file(s) its pages reference.",
    };
  }

  const fontFile = fontFiles[0];
  const text = await fontFile.text();

  if (!bitmapFontTextParser.test(text) && !bitmapFontXMLStringParser.test(text)) {
    return {
      valid: false,
      error: `"${fontFile.name}" doesn't look like a valid bitmap font file (expected the AngelCode .fnt text format or XML).`,
    };
  }

  let fontData;
  try {
    fontData = bitmapFontTextParser.test(text) ? bitmapFontTextParser.parse(text) : bitmapFontXMLStringParser.parse(text);
  } catch {
    return { valid: false, error: `Failed to parse "${fontFile.name}" as a bitmap font file.` };
  }

  if (!fontData.pages || fontData.pages.length === 0) {
    return { valid: false, error: `"${fontFile.name}" doesn't declare any texture pages.` };
  }

  return { valid: true, fontData, fontFileName: fontFile.name, images };
}

export async function validateSpineFiles(files: File[]): Promise<SpineFileValidation> {
  const atlasFiles = files.filter(isAtlasFile);
  const binarySkeletonFiles = files.filter(isSkeletonBinaryFile);
  const jsonSkeletonFiles = files.filter(isJsonFile);
  const images = files.filter(isImageFile);

  if (atlasFiles.length === 0) {
    return {
      valid: false,
      error: 'Please select a Spine atlas file (.atlas) plus its skeleton file (.json or .skel) and texture PNG(s).',
    };
  }
  if (atlasFiles.length > 1) {
    return { valid: false, error: 'Only one atlas file (.atlas) is allowed.' };
  }

  const skeletonFiles = [...jsonSkeletonFiles, ...binarySkeletonFiles];
  if (skeletonFiles.length === 0) {
    return {
      valid: false,
      error: 'Please also select the Spine skeleton file exported alongside the atlas (.json or .skel/.bin).',
    };
  }
  if (skeletonFiles.length > 1) {
    return {
      valid: false,
      error: `Only one skeleton file is allowed, but ${skeletonFiles.length} were provided (${skeletonFiles.map((f) => f.name).join(', ')}).`,
    };
  }

  if (images.length === 0) {
    return {
      valid: false,
      error: "Please also select the atlas's texture PNG(s) — the image file(s) its pages reference.",
    };
  }

  return {
    valid: true,
    atlasFile: atlasFiles[0],
    skeletonFile: skeletonFiles[0],
    isBinary: binarySkeletonFiles.length === 1,
    images,
  };
}
