import { createPixiApp } from './pixi/app';
import { setupSpriteInteractions } from './pixi/interactions';
import { pickFiles } from './ui/fileInput';
import { Modal } from './ui/modal';
import { Inspector } from './ui/inspector';
import { AnimationConfigDialog } from './ui/animationConfigDialog';
import { SpriteFrameDialog } from './ui/spriteFrameDialog';
import { BitmapTextConfigDialog } from './ui/bitmapTextConfigDialog';
import { validateSpriteFiles, validateAnimationFiles, validateBitmapFontFiles } from './assets/validator';
import {
  createStaticSprite,
  createSpriteFromFrames,
  loadSpritesheets,
  createAnimatedSpriteFromFrames,
  createAnimatedSpriteFromSequence,
} from './assets/spriteFactory';
import { loadBitmapFont, createBitmapText } from './assets/bitmapTextFactory';
import type { AssetInfo, AssetMode, PlaceableDisplay } from './assets/types';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';
const ASSET_ACCEPT = `${IMAGE_ACCEPT},application/json,.json`;
const BITMAP_TEXT_ACCEPT = `${IMAGE_ACCEPT},.fnt,.xml,application/xml,text/xml`;

async function main() {
  const container = document.getElementById('canvas-container')!;
  const dropHint = document.getElementById('drop-hint')!;
  const statusMessage = document.getElementById('status-message')!;
  const btnSprite = document.getElementById('btn-add-sprite')!;
  const btnAnimation = document.getElementById('btn-add-animation')!;
  const btnBitmapText = document.getElementById('btn-add-bitmaptext')!;
  const btnRestore = document.getElementById('btn-restore') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear')!;

  const modal = new Modal();
  const animConfigDialog = new AnimationConfigDialog();
  const spriteFrameDialog = new SpriteFrameDialog();
  const bitmapTextConfigDialog = new BitmapTextConfigDialog();
  const app = await createPixiApp(container);

  let currentMode: AssetMode | null = null;
  let placedCount = 0;

  // Cache of removed-but-not-destroyed items, so an accidental removal can be undone
  // without re-picking files, while loading new assets keeps working as normal.
  interface RemovedEntry {
    display: PlaceableDisplay;
    info: AssetInfo;
    x: number;
    y: number;
  }
  const removedStack: RemovedEntry[] = [];

  function updateRestoreButton(): void {
    btnRestore.disabled = removedStack.length === 0;
    btnRestore.textContent = removedStack.length > 0 ? `↺ Restore Removed (${removedStack.length})` : '↺ Restore Removed';
  }

  const inspector = new Inspector((display, info) => {
    app.stage.removeChild(display);
    removedStack.push({ display, info, x: display.x, y: display.y });
    updateRestoreButton();
    setStatus(`Removed "${info.label}" from the stage. Use "Restore Removed" to undo, or keep loading new assets as usual.`);
  });
  const registerInteractive = setupSpriteInteractions(app, inspector);

  function setStatus(message: string): void {
    statusMessage.textContent = message;
  }

  function setMode(mode: AssetMode): void {
    currentMode = mode;
    btnSprite.classList.toggle('active', mode === 'sprite');
    btnAnimation.classList.toggle('active', mode === 'animation');
    btnBitmapText.classList.toggle('active', mode === 'bitmapText');
    setStatus(
      mode === 'sprite'
        ? 'Sprite mode: choose an image, or a PNG + its spritesheet JSON to pick one frame — or drag files onto the canvas.'
        : mode === 'animation'
          ? 'Animation mode: choose one or more PNG + JSON spritesheets, or several frame images.'
          : 'Bitmap Text mode: choose a bitmap font file (.fnt or .xml) plus its texture PNG(s).',
    );
  }

  function placeOnStage(display: PlaceableDisplay, info: AssetInfo): void {
    dropHint.classList.add('hidden');
    const angle = placedCount * 47;
    const radius = Math.min(app.screen.width, app.screen.height) * 0.15;
    const offsetX = Math.cos(angle * (Math.PI / 180)) * radius * Math.min(placedCount, 4);
    const offsetY = Math.sin(angle * (Math.PI / 180)) * radius * Math.min(placedCount, 4);

    display.x = app.screen.width / 2 + offsetX;
    display.y = app.screen.height / 2 + offsetY;
    registerInteractive(display, info);

    app.stage.addChild(display);
    placedCount += 1;
  }

  async function processFiles(mode: AssetMode, files: File[]): Promise<void> {
    if (files.length === 0) return;

    if (mode === 'sprite') {
      const result = await validateSpriteFiles(files);
      if (!result.valid) {
        modal.showError(result.error);
        setStatus('Failed to add sprite: invalid assets.');
        return;
      }

      if (result.type === 'plain') {
        try {
          const { display, info } = await createStaticSprite(result.file);
          placeOnStage(display, info);
          setStatus(`Added sprite "${result.file.name}".`);
        } catch (err) {
          modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Load Image');
          setStatus('Failed to add sprite.');
        }
        return;
      }

      // Spritesheet: let the user pick which frame to display before creating the sprite.
      try {
        const loaded = await loadSpritesheets([{ image: result.image, json: result.json }]);
        const frameName = await spriteFrameDialog.open(loaded.label, loaded.frames);
        if (!frameName) {
          setStatus('Sprite creation cancelled.');
          return;
        }
        const { display, info } = createSpriteFromFrames(loaded, frameName);
        placeOnStage(display, info);
        setStatus(`Added sprite showing frame "${frameName}" from spritesheet "${result.image.name}".`);
      } catch (err) {
        modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Load Image');
        setStatus('Failed to add sprite.');
      }
      return;
    }

    if (mode === 'bitmapText') {
      const result = await validateBitmapFontFiles(files);
      if (!result.valid) {
        modal.showError(result.error);
        setStatus('Failed to add bitmap text: invalid assets.');
        return;
      }

      try {
        const loaded = await loadBitmapFont(result.fontData, result.fontFileName, result.images);
        const config = await bitmapTextConfigDialog.open(loaded.font.fontFamily, loaded.font.baseMeasurementFontSize);
        if (!config) {
          setStatus('Bitmap text creation cancelled.');
          return;
        }
        const { display, info } = createBitmapText(loaded, config);
        placeOnStage(display, info);
        setStatus(`Added bitmap text "${config.text}" using font "${loaded.font.fontFamily}".`);
      } catch (err) {
        modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Build Bitmap Text');
        setStatus('Failed to add bitmap text.');
      }
      return;
    }

    const result = await validateAnimationFiles(files);
    if (!result.valid) {
      modal.showError(result.error);
      setStatus('Failed to add animation: invalid assets.');
      return;
    }

    if (result.type === 'sequence') {
      try {
        const { display, info } = await createAnimatedSpriteFromSequence(result.images);
        placeOnStage(display, info);
        setStatus(`Added animated sprite from ${result.images.length} frame images.`);
      } catch (err) {
        modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Build Animation');
        setStatus('Failed to add animation.');
      }
      return;
    }

    // Spritesheet(s): let the user configure which frames, default frame, and speed before creating the sprite.
    try {
      const loaded = await loadSpritesheets(result.sheets);
      const config = await animConfigDialog.open(loaded.label, loaded.frames, loaded.defaultSelectedNames);
      if (!config) {
        setStatus('Animation creation cancelled.');
        return;
      }
      const { display, info } = createAnimatedSpriteFromFrames(loaded, config);
      placeOnStage(display, info);
      setStatus(
        `Added animated sprite "${loaded.label}" — ${config.selectedFrameNames.length} frame(s) at ${config.speed.toFixed(2)}x speed.`,
      );
    } catch (err) {
      modal.showError(err instanceof Error ? err.message : String(err), 'Failed to Build Animation');
      setStatus('Failed to add animation.');
    }
  }

  btnSprite.addEventListener('click', async () => {
    setMode('sprite');
    const files = await pickFiles(ASSET_ACCEPT, true);
    await processFiles('sprite', files);
  });

  btnAnimation.addEventListener('click', async () => {
    setMode('animation');
    const files = await pickFiles(ASSET_ACCEPT, true);
    await processFiles('animation', files);
  });

  btnBitmapText.addEventListener('click', async () => {
    setMode('bitmapText');
    const files = await pickFiles(BITMAP_TEXT_ACCEPT, true);
    await processFiles('bitmapText', files);
  });

  btnRestore.addEventListener('click', () => {
    const entry = removedStack.pop();
    if (!entry) return;
    entry.display.x = entry.x;
    entry.display.y = entry.y;
    app.stage.addChild(entry.display);
    updateRestoreButton();
    setStatus(`Restored "${entry.info.label}".`);
  });

  btnClear.addEventListener('click', () => {
    app.stage.removeChildren();
    placedCount = 0;
    removedStack.length = 0;
    updateRestoreButton();
    dropHint.classList.remove('hidden');
    inspector.hide();
    setStatus('Stage cleared.');
  });

  // Prevent ctrl+wheel/pinch over the canvas from zooming the whole page — sprites handle it themselves.
  container.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );

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
      modal.showError('Select "+ Sprite", "+ Animation" or "+ Bitmap Text" from the toolbar first, then drag your files onto the canvas.');
      return;
    }
    await processFiles(currentMode, files);
  });

  updateRestoreButton();
  setStatus('Select "+ Sprite", "+ Animation" or "+ Bitmap Text" to load assets.');
}

main();
