import type { SpineRuntimeChoice } from '../assets/types';

export class SpineRuntimeDialog {
  private overlay: HTMLElement;
  private legacyBtn: HTMLButtonElement;
  private modernBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private resolvePromise: ((value: SpineRuntimeChoice | null) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('spine-runtime-overlay')!;
    this.legacyBtn = document.getElementById('spine-runtime-legacy') as HTMLButtonElement;
    this.modernBtn = document.getElementById('spine-runtime-modern') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('spine-runtime-cancel') as HTMLButtonElement;

    this.legacyBtn.addEventListener('click', () => this.choose('legacy'));
    this.modernBtn.addEventListener('click', () => this.choose('modern'));
    this.cancelBtn.addEventListener('click', () => this.choose(null));
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.choose(null);
    });
  }

  /** Shows the runtime picker, resolving with the chosen runtime, or null if cancelled. */
  open(): Promise<SpineRuntimeChoice | null> {
    this.overlay.classList.add('visible');
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private choose(value: SpineRuntimeChoice | null): void {
    this.overlay.classList.remove('visible');
    this.resolvePromise?.(value);
    this.resolvePromise = null;
  }
}
