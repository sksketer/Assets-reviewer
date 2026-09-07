import { AnimatedSprite, Sprite, Spritesheet, Texture } from 'pixi.js';
import { loadImageFile } from './loadImage';
import { naturalCompare } from './naturalSort';
import type { AssetInfo, FrameOption, SpritesheetPair } from './types';

export interface CreatedSprite {
  display: Sprite;
  info: AssetInfo;
}

export interface CreatedAnimatedSprite {
  display: AnimatedSprite;
  info: AssetInfo;
}

function sortByName(files: File[]): File[] {
  return [...files].sort((a, b) => naturalCompare(a.name, b.name));
}

function extractAnimationTags(jsonData: unknown): Record<string, string[]> {
  if (typeof jsonData !== 'object' || jsonData === null || !('animations' in jsonData)) return {};
  const anims = (jsonData as Record<string, unknown>).animations;
  if (typeof anims !== 'object' || anims === null) return {};

  const result: Record<string, string[]> = {};
  for (const [tag, list] of Object.entries(anims as Record<string, unknown>)) {
    if (Array.isArray(list)) {
      result[tag] = list.filter((v): v is string => typeof v === 'string');
    }
  }
  return result;
}

async function buildSpritesheet(image: File, jsonData: unknown): Promise<{ texture: Texture; sheet: Spritesheet }> {
  const img = await loadImageFile(image);
  const texture = Texture.from(img);
  const sheet = new Spritesheet(texture, jsonData as never);
  await sheet.parse();
  return { texture, sheet };
}

function atlasFrames(sheet: Spritesheet): FrameOption[] {
  return Object.keys(sheet.textures)
    .sort(naturalCompare)
    .map((name) => ({ name, texture: sheet.textures[name] }));
}

export async function createStaticSprite(file: File): Promise<CreatedSprite> {
  const img = await loadImageFile(file);
  const texture = Texture.from(img);
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.label = file.name;

  const info: AssetInfo = {
    kind: 'sprite',
    label: file.name,
    fileSizeBytes: file.size,
    dimensionsLabel: `${texture.width} × ${texture.height} px`,
    gpuMemoryBytes: texture.width * texture.height * 4,
    frames: [{ name: file.name, texture }],
    playbackFrameNames: null,
    currentFrame: file.name,
  };
  return { display: sprite, info };
}

export interface LoadedSpritesheets {
  label: string;
  fileSizeBytes: number;
  dimensionsLabel: string;
  gpuMemoryBytes: number;
  /** All frames across every loaded sheet, namespaced as "<pngBaseName>/<frameName>" when more than one sheet is loaded. */
  frames: FrameOption[];
  /** Frame names to pre-check in the animation config dialog — the first sheet's tagged animation if present, else every frame. */
  defaultSelectedNames: string[];
}

/** Loads and parses one or more spritesheets (PNG + JSON pairs), combining their frames into one list. */
export async function loadSpritesheets(sheets: SpritesheetPair[]): Promise<LoadedSpritesheets> {
  const multi = sheets.length > 1;
  const frames: FrameOption[] = [];
  const defaultSelectedNames: string[] = [];
  const dimensionParts: string[] = [];
  const nameParts: string[] = [];
  let fileSizeBytes = 0;
  let gpuMemoryBytes = 0;

  for (const { image, json } of sheets) {
    const animationTags = extractAnimationTags(json);
    const { texture, sheet } = await buildSpritesheet(image, json);
    const prefix = multi ? `${image.name.replace(/\.[^./]+$/, '')}/` : '';
    const sheetFrames = atlasFrames(sheet).map((f) => ({ name: `${prefix}${f.name}`, texture: f.texture }));
    frames.push(...sheetFrames);

    const firstTag = Object.keys(animationTags)[0];
    const taggedNames = firstTag ? animationTags[firstTag].map((name) => `${prefix}${name}`) : [];
    defaultSelectedNames.push(...(taggedNames.length > 0 ? taggedNames : sheetFrames.map((f) => f.name)));

    fileSizeBytes += image.size;
    gpuMemoryBytes += texture.width * texture.height * 4;
    dimensionParts.push(`${texture.width}×${texture.height}`);
    nameParts.push(image.name);
  }

  return {
    label: nameParts.join(' + '),
    fileSizeBytes,
    dimensionsLabel: multi ? `${sheets.length} spritesheets (${dimensionParts.join(', ')} px)` : `${dimensionParts[0]} px (atlas)`,
    gpuMemoryBytes,
    frames,
    defaultSelectedNames,
  };
}

/** Builds a static Sprite showing one chosen frame (picked via the sprite frame dialog) out of a loaded spritesheet. */
export function createSpriteFromFrames(loaded: LoadedSpritesheets, selectedFrameName: string): CreatedSprite {
  const frame = loaded.frames.find((f) => f.name === selectedFrameName) ?? loaded.frames[0];

  const sprite = new Sprite(frame.texture);
  sprite.anchor.set(0.5);
  sprite.label = loaded.label;

  const info: AssetInfo = {
    kind: 'sprite',
    label: loaded.label,
    fileSizeBytes: loaded.fileSizeBytes,
    dimensionsLabel: loaded.dimensionsLabel,
    gpuMemoryBytes: loaded.gpuMemoryBytes,
    frames: loaded.frames,
    playbackFrameNames: null,
    currentFrame: frame.name,
  };
  return { display: sprite, info };
}

export interface AnimationConfig {
  selectedFrameNames: string[];
  defaultFrameName: string;
  speed: number;
}

/** Builds an AnimatedSprite from a subset of frames chosen (via the animation config dialog) out of one or more loaded spritesheets. */
export function createAnimatedSpriteFromFrames(loaded: LoadedSpritesheets, config: AnimationConfig): CreatedAnimatedSprite {
  const textureByName = new Map(loaded.frames.map((f) => [f.name, f.texture]));
  const selected = new Set(config.selectedFrameNames);
  const orderedNames = loaded.frames.map((f) => f.name).filter((name) => selected.has(name));
  const textures = orderedNames.map((name) => textureByName.get(name)!);

  const anim = new AnimatedSprite(textures);
  anim.anchor.set(0.5);
  anim.label = loaded.label;
  anim.animationSpeed = config.speed;

  const startIndex = Math.max(0, orderedNames.indexOf(config.defaultFrameName));
  anim.gotoAndPlay(startIndex);

  const info: AssetInfo = {
    kind: 'animated',
    label: loaded.label,
    fileSizeBytes: loaded.fileSizeBytes,
    dimensionsLabel: loaded.dimensionsLabel,
    gpuMemoryBytes: loaded.gpuMemoryBytes,
    frames: loaded.frames,
    playbackFrameNames: orderedNames,
    currentFrame: orderedNames[startIndex] ?? orderedNames[0] ?? '',
  };
  return { display: anim, info };
}

export async function createAnimatedSpriteFromSequence(images: File[]): Promise<CreatedAnimatedSprite> {
  const sorted = sortByName(images);
  const frames: FrameOption[] = [];
  let totalBytes = 0;

  for (const file of sorted) {
    const img = await loadImageFile(file);
    const texture = Texture.from(img);
    frames.push({ name: file.name, texture });
    totalBytes += file.size;
  }

  const anim = new AnimatedSprite(frames.map((f) => f.texture));
  anim.anchor.set(0.5);
  anim.label = `${sorted.length} frames`;
  anim.animationSpeed = 0.15;
  anim.play();

  const gpuMemoryBytes = frames.reduce((sum, f) => sum + f.texture.width * f.texture.height * 4, 0);
  const firstFrame = frames[0];

  const info: AssetInfo = {
    kind: 'animated',
    label: `${sorted.length} frame images`,
    fileSizeBytes: totalBytes,
    dimensionsLabel: firstFrame ? `${frames.length} frames, ~${firstFrame.texture.width} × ${firstFrame.texture.height} px each` : '—',
    gpuMemoryBytes,
    frames,
    playbackFrameNames: frames.map((f) => f.name),
    currentFrame: firstFrame?.name ?? '',
  };
  return { display: anim, info };
}
