import type { Sprite, AnimatedSprite } from 'pixi.js';
import { createPixiApp } from './pixi/app';
import { pickFiles } from './ui/fileInput';
import { Modal } from './ui/modal';
import { validateSpriteFiles, validateAnimationFiles } from './assets/validator';
import {
  createStaticSprite,
  createAnimatedSpriteFromSheet,
  createAnimatedSpriteFromSequence,
} from './assets/spriteFactory';
import type { AssetMode } from './assets/types';

const SPRITE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';
const ANIMATION_ACCEPT = `${SPRITE_ACCEPT},application/json,.json`;

async function main() {
  const container = document.getElementById('canvas-container')!;
  const dropHint = document.getElementById('drop-hint')!;
  const statusBar = document.getElementById('status-bar')!;
  const btnSprite = document.getElementById('btn-add-sprite')!;
  const btnAnimation = document.getElementById('btn-add-animation')!;
  const btnClear = document.getElementById('btn-clear')!;

  const modal = new Modal();
  const app = await createPixiApp(container);

  let currentMode: AssetMode | null = null;
  let placedCount = 0;

  function setStatus(message: string): void {
    statusBar.textContent = message;
  }

  function setMode(mode: AssetMode): void {
    currentMode = mode;
    btnSprite.classList.toggle('active', mode === 'sprite');
    btnAnimation.classList.toggle('active', mode === 'animation');
    setStatus(
      mode === 'sprite'
        ? 'Sprite mode: choose an image file, or drag one onto the canvas.'
        : 'Animation mode: choose a PNG + JSON spritesheet, or several frame images.',
    );
  }

  function placeOnStage(display: Sprite | AnimatedSprite): void {
    dropHint.classList.add('hidden');
    const angle = placedCount * 47;
    const radius = Math.min(app.screen.width, app.screen.height) * 0.15;
    const offsetX = Math.cos(angle * (Math.PI / 180)) * radius * Math.min(placedCount, 4);
    const offsetY = Math.sin(angle * (Math.PI / 180)) * radius * Math.min(placedCount, 4);

    display.x = app.screen.width / 2 + offsetX;
    display.y = app.screen.height / 2 + offsetY;
    app.stage.addChild(display);
    placedCount += 1;
  }

  async function processFiles(mode: AssetMode, files: File[]): Promise<void> {
    if (files.length === 0) return;

    if (mode === 'sprite') {
      const result = validateSpriteFiles(files);
      if (!result.valid) {
        modal.showError(result.error);
        setStatus('Failed to add sprite: invalid assets.');
        return;
      }
      try {
        const sprite = await createStaticSprite(result.file);
        placeOnStage(sprite);
        setStatus(`Added sprite "${result.file.name}".`);
      } catch (err) {
        modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Load Image');
        setStatus('Failed to add sprite.');
      }
      return;
    }

    const result = await validateAnimationFiles(files);
    if (!result.valid) {
      modal.showError(result.error);
      setStatus('Failed to add animation: invalid assets.');
      return;
    }

    try {
      const anim =
        result.type === 'spritesheet'
          ? await createAnimatedSpriteFromSheet(result.image, result.json)
          : await createAnimatedSpriteFromSequence(result.images);
      placeOnStage(anim);
      setStatus(
        result.type === 'spritesheet'
          ? `Added animated sprite from spritesheet "${result.image.name}".`
          : `Added animated sprite from ${result.images.length} frame images.`,
      );
    } catch (err) {
      modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Build Animation');
      setStatus('Failed to add animation.');
    }
  }

  btnSprite.addEventListener('click', async () => {
    setMode('sprite');
    const files = await pickFiles(SPRITE_ACCEPT, false);
    await processFiles('sprite', files);
  });

  btnAnimation.addEventListener('click', async () => {
    setMode('animation');
    const files = await pickFiles(ANIMATION_ACCEPT, true);
    await processFiles('animation', files);
  });

  btnClear.addEventListener('click', () => {
    app.stage.removeChildren();
    placedCount = 0;
    dropHint.classList.remove('hidden');
    setStatus('Stage cleared.');
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('drag-over');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('drag-over');
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');

    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length === 0) return;

    if (!currentMode) {
      modal.showError('Select "+ Sprite" or "+ Animation" from the toolbar first, then drag your files onto the canvas.');
      return;
    }
    await processFiles(currentMode, files);
  });

  setStatus('Select "+ Sprite" or "+ Animation" to load assets.');
}

main();
