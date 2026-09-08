# Assets Viewer

A browser-based Pixi.js tool for loading your own sprite, spritesheet, bitmap font, and Spine assets from disk and previewing them as static sprites, animations, bitmap text, or Spine skeletons — no build step or asset pipeline required, just drag files in.

## Features

- **Static sprites** — load a single image, or a PNG plus its spritesheet JSON and pick which frame to display before it's created.
- **Animations** — build an `AnimatedSprite` from either:
  - a folder of individual frame images (sorted naturally by filename), or
  - one or more spritesheets (PNG + JSON pairs). Multiple spritesheets can be combined into a single animation.
  - Before creation, a config popup lets you choose which frames play in the loop, the default/starting frame, and the playback speed.
- **Bitmap text** — load a bitmap font (`.fnt`/`.xml` + its texture PNG page(s)) and configure the text content, font size, fill color, alignment, letter spacing, word wrap, anchor, and rounded-pixel rendering before it's created.
- **Spine** — load a Spine atlas (`.atlas`) + skeleton (JSON or binary `.skel`/`.bin`) + texture PNG(s), and configure which animation to play, looping, and scale before creation.
  - Clicking **+ Spine** first asks which runtime to use: **Spine ≥ 4.0** (the official [`@esotericsoftware/spine-pixi-v8`](https://github.com/EsotericSoftware/spine-runtimes) runtime, added directly to the Pixi v8 stage) or **Spine < 4.0** (`pixi-spine`, which only runs on Pixi v7 — a different, incompatible rendering engine). The legacy skeleton is rendered on its own offscreen Pixi v7 canvas sized to its bounds, then that canvas is re-uploaded as a live texture on a normal Pixi v8 sprite every frame, so it still behaves like any other placed item (draggable, scalable, inspectable, remove/restore-able).
  - Every texture page the atlas declares is matched by filename against the uploaded PNGs; if any is missing, a clear validation error names exactly which file is required.
- **Inspector panel** — click any placed item to open a draggable panel showing its source, type, file size, pixel dimensions, and estimated GPU memory. For animated sprites it also adds play/pause, a speed slider, and a checklist to change which frames are included in the loop, plus a dropdown to jump to any single frame. For Spine it shows the runtime in use and the skeleton's Spine version, plus live play/pause, a speed slider, a loop checkbox, and a dropdown to switch to any other animation in the skeleton (or back to the setup pose) — all of it working identically for both the modern and legacy runtimes.
- **Drag to reposition, ctrl+wheel / pinch to scale** — every placed sprite, animation, or bitmap text can be dragged around the canvas and scaled with ctrl+scroll or a trackpad pinch, without disturbing the click-to-inspect behavior.
- **Remove & restore** — the inspector has a "Remove from Stage" action. Removed items aren't destroyed — they're kept in an in-memory cache, and the toolbar's "↺ Restore Removed" button (which shows a live count) brings back the most recently removed item at its original position. Loading new assets keeps working normally in the meantime; "Clear Stage" wipes this cache along with everything else.
- **Drag & drop** — select a mode from the toolbar, then either use the file picker or drag files directly onto the canvas.
- **Validation** — mismatched or missing assets (e.g. a spritesheet PNG without its JSON, or a bitmap font missing a referenced texture page) show a popup explaining what's wrong instead of failing silently.

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

> The production build uses relative asset paths (`base: './'` in `vite.config.ts`), so `dist/` can be served from any path or sub-directory. Note that opening `dist/index.html` directly via a double-click (`file://`) still won't work — browsers block ES module scripts under `file://` regardless of path; serve the folder with `npm run preview` or any static file server instead.

## Usage

1. Click **+ Sprite**, **+ Animation**, **+ Bitmap Text**, or **+ Spine** in the toolbar.
2. Pick files via the dialog, or drag them onto the canvas.
   - Sprite: a single image, or an image + its spritesheet JSON.
   - Animation: several frame images, or one or more spritesheet PNG+JSON pairs.
   - Bitmap Text: a `.fnt`/`.xml` bitmap font file plus its texture PNG(s).
   - Spine: first choose a runtime (**Spine ≥ 4.0** to proceed; **Spine < 4.0** explains why it's unsupported), then select the `.atlas`, skeleton (`.json`/`.skel`/`.bin`), and texture PNG(s).
3. For spritesheet-based sprites, animations, bitmap text, and Spine, a config popup lets you choose the relevant options before creation — confirm to create it, or cancel to discard.
4. On the canvas: drag any item to reposition it, use ctrl+scroll or a trackpad pinch to scale it, or click it to open its inspector panel.
5. In the inspector: drag by the header to reposition the panel, use the close button (×) to dismiss it, or **Remove from Stage** to take the item off the canvas (it stays cached — bring it back with **↺ Restore Removed** in the toolbar).
6. **Clear Stage** removes everything, including the removed-items cache, and resets the canvas.

## Project Structure

```
index.html                              Page shell: toolbar, canvas container, modals, inspector panel
src/
  main.ts                               Wires up the toolbar, file/drag-drop handling, stage placement, and the remove/restore cache
  style.css                             All styling
  pixi/
    app.ts                              Creates and sizes the Pixi Application/canvas
    interactions.ts                     Drag-to-reposition and ctrl+wheel/pinch-to-scale for placed items
  assets/
    validator.ts                        Validates selected files and reports clear errors
    spriteFactory.ts                    Builds Sprite/AnimatedSprite instances and their spritesheet loading
    bitmapTextFactory.ts                Parses/loads bitmap fonts and builds BitmapText instances
    spineFactory.ts                     Parses Spine atlas/skeleton (JSON or binary) and builds Spine instances (Spine >= 4.0, Pixi v8)
    legacySpineFactory.ts               Parses Spine < 4.0 atlas/skeleton via pixi-spine (Pixi v7), bridged into a live Pixi v8 sprite
    loadImage.ts, naturalSort.ts, format.ts   Small shared helpers
    types.ts                            Shared types (AssetInfo, PlaceableDisplay, validation results, etc.)
  ui/
    modal.ts                            Generic error/message popup
    animationConfigDialog.ts            Pre-creation animation config popup (speed/default frame/frames)
    spriteFrameDialog.ts                Pre-creation frame-picker popup for spritesheet sprites
    bitmapTextConfigDialog.ts           Pre-creation bitmap text config popup
    spineRuntimeDialog.ts               Runtime picker shown before loading Spine assets
    spineConfigDialog.ts                Pre-creation Spine config popup (animation/loop/scale)
    inspector.ts                        Draggable per-item inspector panel (incl. Remove from Stage)
    draggable.ts                        Reusable drag-by-handle behavior
    fileInput.ts                        Promise-based hidden file input helper
```

## Tech Stack

- [Pixi.js](https://pixijs.com/) v8 for rendering
- [`@esotericsoftware/spine-pixi-v8`](https://www.npmjs.com/package/@esotericsoftware/spine-pixi-v8) + `@esotericsoftware/spine-core` for Spine >= 4.0 support
- [`pixi-spine`](https://www.npmjs.com/package/pixi-spine) + its `@pixi/*` Pixi v7 packages for Spine < 4.0 support (rendered on a second, offscreen Pixi v7 renderer)
- TypeScript
- [Vite](https://vitejs.dev/) for the dev server and build
