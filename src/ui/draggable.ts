export function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  handle.addEventListener('pointerdown', (e) => {
    // Don't start a drag (and don't steal pointer capture) when the press lands on an
    // interactive control inside the header, e.g. the close button — let it handle its own click.
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return;

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
    panel.style.left = `${Math.min(Math.max(0, startLeft + dx), maxLeft)}px`;
    panel.style.top = `${Math.min(Math.max(0, startTop + dy), maxTop)}px`;
    panel.style.right = 'auto';
  });

  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    handle.releasePointerCapture(e.pointerId);
  }

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}
