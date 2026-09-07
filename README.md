# Assets Viewer

A browser-based Pixi.js tool for loading your own sprite and spritesheet assets from disk and previewing them as static sprites or animations — no build step or asset pipeline required, just drag files in.

## Features

- **Static sprites** — load a single image, or a PNG plus its spritesheet JSON to display one frame from an atlas.
- **Animations** — build an `AnimatedSprite` from either:
  - a folder of individual frame images (sorted naturally by filename), or
  - one or more spritesheets (PNG + JSON pairs). Multiple spritesheets can be combined into a single animation.
- **Animation config popup** — before an animation is created, choose which frames play in the loop, the default/starting frame, and the playback speed.
- **Inspector panel** — click any placed sprite to open a draggable panel showing its source, type, file size, pixel dimensions, estimated GPU memory, and current frame. For animated sprites it also adds play/pause, a speed slider, and a checklist to change which frames are included in the loop, plus a dropdown to jump to any single frame.
- **Drag & drop** — select a mode from the toolbar, then either use the file picker or drag files directly onto the canvas.
- **Validation** — mismatched or missing assets (e.g. a spritesheet PNG without its JSON) show a popup explaining what's wrong instead of failing silently.

## Getting Started

Requires Node.js.

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser.

Other scripts:

```bash
npm run build    # type-check and build for production (outputs to dist/)
npm run preview  # preview the production build locally
```

## Usage

1. Click **+ Sprite** or **+ Animation** in the toolbar.
2. Pick files via the dialog, or drag them onto the canvas.
   - Sprite: a single image, or an image + its spritesheet JSON.
   - Animation: several frame images, or one or more spritesheet PNG+JSON pairs.
3. For animations built from a spritesheet, a config popup lets you pick the speed, default frame, and which frames loop — confirm to create it, or cancel to discard.
4. Click any sprite on the canvas to open its inspector panel; drag the panel by its header to reposition it, and use the close button (×) to dismiss it.
5. **Clear Stage** removes everything and resets the canvas.

## Project Structure

```
index.html                        Page shell: toolbar, canvas container, modals, inspector panel
src/
  main.ts                         Wires up the toolbar, file/drag-drop handling, and stage placement
  style.css                       All styling
  pixi/
    app.ts                        Creates and sizes the Pixi Application/canvas
  assets/
    validator.ts                  Validates selected files and reports clear errors
    spriteFactory.ts               Builds Sprite/AnimatedSprite instances and their spritesheet loading
    loadImage.ts, naturalSort.ts, format.ts   Small shared helpers
    types.ts                      Shared types (AssetInfo, validation results, etc.)
  ui/
    modal.ts                      Generic error/message popup
    animationConfigDialog.ts      Pre-creation animation config popup (speed/default frame/frames)
    inspector.ts                  Draggable per-sprite inspector panel
    draggable.ts                  Reusable drag-by-handle behavior
    fileInput.ts                  Promise-based hidden file input helper
```

## Tech Stack

- [Pixi.js](https://pixijs.com/) v8 for rendering
- TypeScript
- [Vite](https://vitejs.dev/) for the dev server and build