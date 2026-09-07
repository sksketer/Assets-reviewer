import { BitmapFont, BitmapText, Cache, Texture } from 'pixi.js';
import type { BitmapFontData } from 'pixi.js';
import { loadImageFile } from './loadImage';
import type { AssetInfo } from './types';

export interface LoadedBitmapFont {
  font: BitmapFont;
  label: string;
  fileSizeBytes: number;
  dimensionsLabel: string;
  gpuMemoryBytes: number;
}

function baseName(name: string): string {
  return name.replace(/\.[^./]+$/, '').toLowerCase();
}

/** Loads a bitmap font's texture page(s), builds a Pixi BitmapFont, and registers it so BitmapText can find it by name. */
export async function loadBitmapFont(fontData: BitmapFontData, fontFileName: string, images: File[]): Promise<LoadedBitmapFont> {
  const usedImageIndexes = new Set<number>();
  const textures: Texture[] = [];
  const dimensionParts: string[] = [];
  let fileSizeBytes = 0;

  for (const page of fontData.pages) {
    const matchIndex = images.findIndex((img, i) => !usedImageIndexes.has(i) && baseName(img.name) === baseName(page.file));
    if (matchIndex === -1) {
      throw new Error(
        `Could not find a texture PNG named like "${page.file}" (referenced by page ${page.id} of "${fontFileName}"). ` +
          'Make sure you selected every PNG the font file references.',
      );
    }
    usedImageIndexes.add(matchIndex);
    const match = images[matchIndex];

    const img = await loadImageFile(match);
    const texture = Texture.from(img);
    textures.push(texture);
    fileSizeBytes += match.size;
    dimensionParts.push(`${texture.width}×${texture.height}`);
  }

  const font = new BitmapFont({ data: fontData, textures }, fontFileName);
  Cache.set(`${font.fontFamily}-bitmap`, font);

  const gpuMemoryBytes = textures.reduce((sum, t) => sum + t.width * t.height * 4, 0);

  return {
    font,
    label: fontFileName,
    fileSizeBytes,
    dimensionsLabel: textures.length > 1 ? `${textures.length} pages (${dimensionParts.join(', ')} px)` : `${dimensionParts[0]} px`,
    gpuMemoryBytes,
  };
}

export interface BitmapTextConfig {
  text: string;
  fontSize: number;
  fill: string;
  align: 'left' | 'center' | 'right' | 'justify';
  letterSpacing: number;
  wordWrap: boolean;
  wordWrapWidth: number;
  anchorX: number;
  anchorY: number;
  roundPixels: boolean;
}

export interface CreatedBitmapText {
  display: BitmapText;
  info: AssetInfo;
}

export function createBitmapText(loaded: LoadedBitmapFont, config: BitmapTextConfig): CreatedBitmapText {
  const display = new BitmapText({
    text: config.text,
    style: {
      fontFamily: loaded.font.fontFamily,
      fontSize: config.fontSize,
      fill: config.fill,
      align: config.align,
      letterSpacing: config.letterSpacing,
      wordWrap: config.wordWrap,
      wordWrapWidth: config.wordWrapWidth,
    },
    anchor: { x: config.anchorX, y: config.anchorY },
    roundPixels: config.roundPixels,
  });
  display.label = loaded.label;

  const info: AssetInfo = {
    kind: 'text',
    label: loaded.label,
    fileSizeBytes: loaded.fileSizeBytes,
    dimensionsLabel: loaded.dimensionsLabel,
    gpuMemoryBytes: loaded.gpuMemoryBytes,
    frames: [],
    playbackFrameNames: null,
    currentFrame: config.text,
  };
  return { display, info };
}
