import type { Application, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js';
import type { Inspector } from '../ui/inspector';
import type { AssetInfo, PlaceableDisplay } from '../assets/types';

const DRAG_THRESHOLD = 4;
const MIN_SCALE = 0.1;
const MAX_SCALE = 6;
const WHEEL_SENSITIVITY = 0.0015;

interface DragState {
  display: PlaceableDisplay;
  info: AssetInfo;
  startPointer: { x: number; y: number };
  startPosition: { x: number; y: number };
  moved: boolean;
}

/**
 * Wires up drag-to-reposition and ctrl+wheel/pinch-to-scale for placed sprites/text.
 * Returns a function to call on each newly placed display object.
 */
export function setupSpriteInteractions(app: Application, inspector: Inspector): (display: PlaceableDisplay, info: AssetInfo) => void {
  // The stage must be hit-testable everywhere (not just where children are) so it keeps
  // receiving pointermove/pointerup while a drag carries the pointer off the sprite's own bounds.
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;
  window.addEventListener('resize', () => {
    app.stage.hitArea = app.screen;
  });

  let dragState: DragState | null = null;

  app.stage.on('pointermove', (e: FederatedPointerEvent) => {
    if (!dragState) return;
    const dx = e.global.x - dragState.startPointer.x;
    const dy = e.global.y - dragState.startPointer.y;
    if (!dragState.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    dragState.moved = true;
    dragState.display.x = dragState.startPosition.x + dx;
    dragState.display.y = dragState.startPosition.y + dy;
  });

  function endDrag(): void {
    if (!dragState) return;
    const { display, info, moved } = dragState;
    display.cursor = 'grab';
    dragState = null;
    if (!moved) inspector.show(display, info);
  }

  app.stage.on('pointerup', endDrag);
  app.stage.on('pointerupoutside', endDrag);

  return function registerInteractive(display, info) {
    display.eventMode = 'static';
    display.cursor = 'grab';

    display.on('pointerdown', (e: FederatedPointerEvent) => {
      display.cursor = 'grabbing';
      dragState = {
        display,
        info,
        startPointer: { x: e.global.x, y: e.global.y },
        startPosition: { x: display.x, y: display.y },
        moved: false,
      };
    });

    display.on('wheel', (e: FederatedWheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = Math.min(1.5, Math.max(0.5, 1 - e.deltaY * WHEEL_SENSITIVITY));
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, display.scale.x * factor));
      display.scale.set(nextScale);
    });
  };
}
