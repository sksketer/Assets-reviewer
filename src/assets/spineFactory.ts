import { Texture } from 'pixi.js';
import { AtlasAttachmentLoader, SkeletonBinary, SkeletonJson, TextureAtlas, type SkeletonData } from '@esotericsoftware/spine-core';
import { Spine, SpineTexture } from '@esotericsoftware/spine-pixi-v8';
import { loadImageFile } from './loadImage';
import { registerSpineControl, type SpineControlHandle } from './spineControl';
import type { AssetInfo } from './types';

export interface LoadedSpine {
  skeletonData: SkeletonData;
  label: string;
  fileSizeBytes: number;
  dimensionsLabel: string;
  gpuMemoryBytes: number;
  animationNames: string[];
}

export interface CreatedSpine {
  display: Spine;
  info: AssetInfo;
}

export interface SpineConfig {
  animationName: string | null;
  loop: boolean;
  scale: number;
}

function baseName(name: string): string {
  return name.replace(/\.[^./]+$/, '').toLowerCase();
}

/**
 * Parses a Spine atlas + skeleton (JSON or binary) and matches every texture page the atlas
 * declares against the uploaded PNGs, erroring out clearly if any required texture is missing.
 */
export async function loadSpineAsset(
  atlasFile: File,
  skeletonFile: File,
  isBinary: boolean,
  images: File[],
): Promise<LoadedSpine> {
  const atlasText = await atlasFile.text();
  const atlas = new TextureAtlas(atlasText);

  if (atlas.pages.length === 0) {
    throw new Error(`"${atlasFile.name}" doesn't declare any texture pages.`);
  }

  const usedImageIndexes = new Set<number>();
  const dimensionParts: string[] = [];
  let fileSizeBytes = atlasFile.size + skeletonFile.size;
  let gpuMemoryBytes = 0;

  for (const page of atlas.pages) {
    const matchIndex = images.findIndex((img, i) => !usedImageIndexes.has(i) && baseName(img.name) === baseName(page.name));
    if (matchIndex === -1) {
      throw new Error(
        `Could not find a texture PNG named like "${page.name}" — required by the atlas "${atlasFile.name}". ` +
          'Make sure you selected every PNG the atlas references.',
      );
    }
    usedImageIndexes.add(matchIndex);
    const match = images[matchIndex];

    const img = await loadImageFile(match);
    const pixiTexture = Texture.from(img);
    page.setTexture(SpineTexture.from(pixiTexture.source));

    fileSizeBytes += match.size;
    gpuMemoryBytes += pixiTexture.width * pixiTexture.height * 4;
    dimensionParts.push(`${pixiTexture.width}×${pixiTexture.height}`);
  }

  const attachmentLoader = new AtlasAttachmentLoader(atlas);

  let skeletonData: SkeletonData;
  if (isBinary) {
    const buffer = new Uint8Array(await skeletonFile.arrayBuffer());
    skeletonData = new SkeletonBinary(attachmentLoader).readSkeletonData(buffer);
  } else {
    const text = await skeletonFile.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`"${skeletonFile.name}" is not valid JSON.`);
    }
    skeletonData = new SkeletonJson(attachmentLoader).readSkeletonData(json as never);
  }

  return {
    skeletonData,
    label: skeletonData.name || skeletonFile.name,
    fileSizeBytes,
    dimensionsLabel:
      atlas.pages.length > 1 ? `${atlas.pages.length} pages (${dimensionParts.join(', ')} px)` : `${dimensionParts[0]} px`,
    gpuMemoryBytes,
    animationNames: skeletonData.animations.map((a) => a.name),
  };
}

/** Builds the Inspector's live playback control surface for a modern (Pixi v8) Spine object. */
function createSpineControlHandle(spine: Spine, initialAnimationName: string | null, initialLoop: boolean): SpineControlHandle {
  let animationName = initialAnimationName;
  let loop = initialLoop;
  let speed = 1;

  return {
    runtimeLabel: 'Spine ≥ 4.0 (Esoteric Software spine-pixi-v8)',
    spineVersion: spine.skeleton.data.version || 'unknown',
    animationNames: spine.skeleton.data.animations.map((a) => a.name),
    getAnimationName: () => animationName,
    setAnimation: (name) => {
      animationName = name;
      if (!name) {
        spine.state.clearTrack(0);
        spine.skeleton.setupPose();
        return;
      }
      const entry = spine.state.setAnimation(0, name, loop);
      entry.timeScale = speed;
    },
    getLoop: () => loop,
    setLoop: (value) => {
      loop = value;
      const entry = spine.state.tracks[0];
      if (entry) entry.loop = value;
    },
    getSpeed: () => speed,
    setSpeed: (value) => {
      speed = value;
      const entry = spine.state.tracks[0];
      if (entry) entry.timeScale = value;
    },
    getPlaying: () => spine.autoUpdate,
    setPlaying: (playing) => {
      spine.autoUpdate = playing;
    },
  };
}

export function createSpineDisplay(loaded: LoadedSpine, config: SpineConfig): CreatedSpine {
  const spine = new Spine({ skeletonData: loaded.skeletonData });
  spine.scale.set(config.scale);
  spine.label = loaded.label;

  if (config.animationName) {
    spine.state.setAnimation(0, config.animationName, config.loop);
  }

  registerSpineControl(spine, createSpineControlHandle(spine, config.animationName, config.loop));

  const info: AssetInfo = {
    kind: 'spine',
    label: loaded.label,
    fileSizeBytes: loaded.fileSizeBytes,
    dimensionsLabel: loaded.dimensionsLabel,
    gpuMemoryBytes: loaded.gpuMemoryBytes,
    frames: [],
    playbackFrameNames: null,
    currentFrame: config.animationName ?? 'Setup pose',
  };
  return { display: spine, info };
}
