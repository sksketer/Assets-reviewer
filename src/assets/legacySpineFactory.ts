import { BaseTexture, Renderer } from '@pixi/core';
import { Container } from '@pixi/display';
import { BinaryInput, TextureAtlas, type ISkeletonData } from '@pixi-spine/base';
import { detectSpineVersion, SPINE_VERSION } from '@pixi-spine/loader-uni';
import * as spine37 from '@pixi-spine/runtime-3.7';
import * as spine38 from '@pixi-spine/runtime-3.8';
import * as spine41 from '@pixi-spine/runtime-4.1';
import { Spine } from 'pixi-spine';
import { Sprite, Texture, Ticker } from 'pixi.js';
import { loadImageFile } from './loadImage';
import { registerSpineControl, type SpineControlHandle } from './spineControl';
import type { AssetInfo } from './types';
import type { SpineConfig } from './spineFactory';

export interface LoadedLegacySpine {
  skeletonData: ISkeletonData;
  label: string;
  fileSizeBytes: number;
  dimensionsLabel: string;
  gpuMemoryBytes: number;
  animationNames: string[];
}

export interface CreatedLegacySpine {
  display: Sprite;
  info: AssetInfo;
}

/** Extra lifecycle hooks for the offscreen Pixi v7 renderer backing a legacy Spine's live texture. */
export interface LegacySpineHandle {
  /** Stops the per-frame offscreen render/animation loop (used while the item sits in the remove/restore cache). */
  pause(): void;
  /** Resumes the per-frame offscreen render/animation loop. */
  resume(): void;
  /** Permanently stops the loop and frees the offscreen WebGL context — call once the item is truly discarded. */
  dispose(): void;
}

const legacySpineHandles = new WeakMap<object, LegacySpineHandle>();

/** Looks up the lifecycle handle attached to a display created by {@link createLegacySpineDisplay}, if any. */
export function getLegacySpineHandle(display: object): LegacySpineHandle | undefined {
  return legacySpineHandles.get(display);
}

function baseName(name: string): string {
  return name.replace(/\.[^./]+$/, '').toLowerCase();
}

function parseJsonSkeletonData(atlas: TextureAtlas, json: { skeleton?: { spine?: string } }): ISkeletonData {
  const version = json.skeleton?.spine;
  const ver = detectSpineVersion(version ?? '');
  if (ver === SPINE_VERSION.VER37) {
    const parser = new spine37.SkeletonJson(new spine37.AtlasAttachmentLoader(atlas));
    return parser.readSkeletonData(json) as unknown as ISkeletonData;
  }
  if (ver === SPINE_VERSION.VER38) {
    const parser = new spine38.SkeletonJson(new spine38.AtlasAttachmentLoader(atlas));
    return parser.readSkeletonData(json) as unknown as ISkeletonData;
  }
  if (ver === SPINE_VERSION.VER40 || ver === SPINE_VERSION.VER41) {
    const parser = new spine41.SkeletonJson(new spine41.AtlasAttachmentLoader(atlas));
    return parser.readSkeletonData(json) as unknown as ISkeletonData;
  }
  throw new Error(`Unrecognized or unsupported Spine skeleton version${version ? ` "${version}"` : ''} — expected Spine 3.7, 3.8, 4.0 or 4.1.`);
}

function readBinaryVersion(data: Uint8Array, skipTwoInts: boolean): string {
  const input = new BinaryInput(data);
  try {
    if (skipTwoInts) {
      input.readInt32();
      input.readInt32();
    } else {
      input.readString();
    }
    return input.readString() ?? '';
  } catch {
    return '';
  }
}

function parseBinarySkeletonData(atlas: TextureAtlas, data: Uint8Array): ISkeletonData {
  // Mirrors pixi-spine's own "uni" binary format detection: Spine 3.8 binaries store the version
  // string right after the skeleton hash, while 4.0/4.1 binaries store it after two leading ints.
  if (detectSpineVersion(readBinaryVersion(data, false)) === SPINE_VERSION.VER38) {
    const parser = new spine38.SkeletonBinary(new spine38.AtlasAttachmentLoader(atlas));
    return parser.readSkeletonData(data) as unknown as ISkeletonData;
  }
  const newFormatVersion = detectSpineVersion(readBinaryVersion(data, true));
  if (newFormatVersion === SPINE_VERSION.VER40 || newFormatVersion === SPINE_VERSION.VER41) {
    const parser = new spine41.SkeletonBinary(new spine41.AtlasAttachmentLoader(atlas));
    return parser.readSkeletonData(data) as unknown as ISkeletonData;
  }
  throw new Error(
    'Unrecognized or unsupported Spine binary skeleton — the legacy runtime only reads Spine 3.8, 4.0 and 4.1 binary exports ' +
      '(3.7 binary export is not supported; re-export as JSON instead).',
  );
}

/**
 * Parses a Spine atlas + skeleton (JSON or binary) exported from Spine versions older than 4.0, and matches
 * every texture page the atlas declares against the uploaded PNGs, erroring out clearly if any is missing.
 */
export async function loadLegacySpineAsset(
  atlasFile: File,
  skeletonFile: File,
  isBinary: boolean,
  images: File[],
): Promise<LoadedLegacySpine> {
  const atlasText = await atlasFile.text();
  const usedImageIndexes = new Set<number>();
  const dimensionParts: string[] = [];
  let fileSizeBytes = atlasFile.size + skeletonFile.size;
  let gpuMemoryBytes = 0;
  let missingPageName: string | null = null;

  const atlas = await new Promise<TextureAtlas>((resolve, reject) => {
    new TextureAtlas(
      atlasText,
      (pageName, textureLoadedCallback) => {
        const matchIndex = images.findIndex((img, i) => !usedImageIndexes.has(i) && baseName(img.name) === baseName(pageName));
        if (matchIndex === -1) {
          missingPageName = pageName;
          textureLoadedCallback(null as unknown as BaseTexture);
          return;
        }
        usedImageIndexes.add(matchIndex);
        const file = images[matchIndex];
        loadImageFile(file)
          .then((img) => {
            const baseTexture = new BaseTexture(img);
            fileSizeBytes += file.size;
            gpuMemoryBytes += baseTexture.realWidth * baseTexture.realHeight * 4;
            dimensionParts.push(`${baseTexture.realWidth}×${baseTexture.realHeight}`);
            textureLoadedCallback(baseTexture);
          })
          .catch(() => {
            missingPageName = pageName;
            textureLoadedCallback(null as unknown as BaseTexture);
          });
      },
      (result) => {
        if (!result) {
          reject(
            new Error(
              `Could not find a texture PNG named like "${missingPageName}" — required by the atlas "${atlasFile.name}". ` +
                'Make sure you selected every PNG the atlas references.',
            ),
          );
          return;
        }
        resolve(result);
      },
    );
  });

  if (atlas.pages.length === 0) {
    throw new Error(`"${atlasFile.name}" doesn't declare any texture pages.`);
  }

  let skeletonData: ISkeletonData;
  if (isBinary) {
    const buffer = new Uint8Array(await skeletonFile.arrayBuffer());
    skeletonData = parseBinarySkeletonData(atlas, buffer);
  } else {
    const text = await skeletonFile.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`"${skeletonFile.name}" is not valid JSON.`);
    }
    skeletonData = parseJsonSkeletonData(atlas, json as { skeleton?: { spine?: string } });
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

/** Builds the Inspector's live playback control surface for a legacy (Pixi v7) pixi-spine object. */
function createLegacySpineControlHandle(spine: Spine, initialAnimationName: string | null, initialLoop: boolean): SpineControlHandle {
  let animationName = initialAnimationName;
  let loop = initialLoop;
  let speed = 1;

  return {
    runtimeLabel: 'Spine < 4.0 (pixi-spine, legacy runtime)',
    spineVersion: spine.spineData.version || 'unknown',
    animationNames: spine.spineData.animations.map((a) => a.name),
    getAnimationName: () => animationName,
    setAnimation: (name) => {
      animationName = name;
      if (!name) {
        spine.state.clearTrack(0);
        spine.skeleton.setToSetupPose();
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

const CANVAS_PADDING = 4;
const MIN_CANVAS_SIZE = 8;

/**
 * Builds a legacy (Spine < 4.0) skeleton using pixi-spine, which only runs on Pixi v7 and so cannot be added
 * directly to this app's Pixi v8 stage. Instead, it's rendered into its own offscreen Pixi v7 canvas — sized to
 * the skeleton's own bounds — and that canvas is re-uploaded as a live texture on a normal Pixi v8 Sprite every
 * frame, so the result behaves like any other placed item (draggable, scalable, inspectable).
 */
export function createLegacySpineDisplay(loaded: LoadedLegacySpine, config: SpineConfig): CreatedLegacySpine {
  const spine = new Spine(loaded.skeletonData);
  spine.scale.set(config.scale);
  if (config.animationName) {
    spine.state.setAnimation(0, config.animationName, config.loop);
  }

  const root = new Container();
  root.addChild(spine);

  // Forces a full transform (and first animation-pose) update so the bounds below reflect real content.
  const bounds = root.getBounds();
  const width = Math.max(MIN_CANVAS_SIZE, Math.ceil(bounds.width) + CANVAS_PADDING * 2);
  const height = Math.max(MIN_CANVAS_SIZE, Math.ceil(bounds.height) + CANVAS_PADDING * 2);
  root.position.set(-bounds.x + CANVAS_PADDING, -bounds.y + CANVAS_PADDING);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const renderer = new Renderer({
    width,
    height,
    view: canvas,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 1,
  });
  renderer.render(root);

  const texture = Texture.from(canvas);
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.label = loaded.label;

  const tick = (): void => {
    renderer.render(root);
    texture.source.update();
  };
  Ticker.shared.add(tick);

  legacySpineHandles.set(sprite, {
    pause: () => Ticker.shared.remove(tick),
    resume: () => Ticker.shared.add(tick),
    dispose: () => {
      Ticker.shared.remove(tick);
      spine.destroy({ children: true });
      renderer.destroy(true);
    },
  });
  registerSpineControl(sprite, createLegacySpineControlHandle(spine, config.animationName, config.loop));

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
  return { display: sprite, info };
}
