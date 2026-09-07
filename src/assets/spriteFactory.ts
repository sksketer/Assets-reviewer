import { AnimatedSprite, Sprite, Spritesheet, Texture } from 'pixi.js';
import { loadImageFile } from './loadImage';
import { naturalCompare } from './naturalSort';
import type { AssetInfo, FrameOption } from './types';

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

export async function createSpriteFromSheet(image: File, jsonData: unknown): Promise<CreatedSprite> {
  const { texture, sheet } = await buildSpritesheet(image, jsonData);
  const frames = atlasFrames(sheet);
  const first = frames[0];

  const sprite = new Sprite(first.texture);
  sprite.anchor.set(0.5);
  sprite.label = image.name;

  const info: AssetInfo = {
    kind: 'sprite',
    label: image.name,
    fileSizeBytes: image.size,
    dimensionsLabel: `${texture.width} × ${texture.height} px (atlas)`,
    gpuMemoryBytes: texture.width * texture.height * 4,
    frames,
    playbackFrameNames: null,
    currentFrame: first.name,
  };
  return { display: sprite, info };
}

export async function createAnimatedSpriteFromSheet(image: File, jsonData: unknown): Promise<CreatedAnimatedSprite> {
  const animationTags = extractAnimationTags(jsonData);
  const { texture, sheet } = await buildSpritesheet(image, jsonData);
  const frames = atlasFrames(sheet);
  const textureByName = new Map(frames.map((f) => [f.name, f.texture]));

  const firstTag = Object.keys(animationTags)[0];
  const taggedNames = firstTag ? animationTags[firstTag] : [];
  const playbackFrameNames = taggedNames.length > 0 ? taggedNames : frames.map((f) => f.name);
  const playbackTextures = playbackFrameNames
    .map((name) => textureByName.get(name))
    .filter((t): t is Texture => Boolean(t));

  const anim = new AnimatedSprite(playbackTextures.length > 0 ? playbackTextures : frames.map((f) => f.texture));
  anim.anchor.set(0.5);
  anim.label = image.name;
  anim.animationSpeed = 0.15;
  anim.play();

  const info: AssetInfo = {
    kind: 'animated',
    label: image.name,
    fileSizeBytes: image.size,
    dimensionsLabel: `${texture.width} × ${texture.height} px (atlas)`,
    gpuMemoryBytes: texture.width * texture.height * 4,
    frames,
    playbackFrameNames,
    currentFrame: playbackFrameNames[0] ?? frames[0]?.name ?? '',
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
