import { AnimatedSprite, Sprite, Spritesheet, Texture } from 'pixi.js';
import { loadImageFile } from './loadImage';

function sortByName(files: File[]): File[] {
  return [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

export async function createStaticSprite(file: File): Promise<Sprite> {
  const img = await loadImageFile(file);
  const texture = Texture.from(img);
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.label = file.name;
  return sprite;
}

export async function createAnimatedSpriteFromSheet(image: File, jsonData: unknown): Promise<AnimatedSprite> {
  const img = await loadImageFile(image);
  const texture = Texture.from(img);

  const sheet = new Spritesheet(texture, jsonData as never);
  await sheet.parse();

  const animationNames = Object.keys(sheet.animations);
  const textures =
    animationNames.length > 0
      ? sheet.animations[animationNames[0]]
      : Object.keys(sheet.textures)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
          .map((key) => sheet.textures[key]);

  const anim = new AnimatedSprite(textures);
  anim.anchor.set(0.5);
  anim.animationSpeed = 0.15;
  anim.label = image.name;
  anim.play();
  return anim;
}

export async function createAnimatedSpriteFromSequence(images: File[]): Promise<AnimatedSprite> {
  const sorted = sortByName(images);
  const textures: Texture[] = [];
  for (const file of sorted) {
    const img = await loadImageFile(file);
    textures.push(Texture.from(img));
  }

  const anim = new AnimatedSprite(textures);
  anim.anchor.set(0.5);
  anim.animationSpeed = 0.15;
  anim.label = `${sorted.length} frames`;
  anim.play();
  return anim;
}
