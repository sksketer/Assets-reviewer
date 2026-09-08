import type { SpineConfig } from '../assets/spineFactory';

export class SpineConfigDialog {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private animationSelect: HTMLSelectElement;
  private loopInput: HTMLInputElement;
  private scaleInput: HTMLInputElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private resolvePromise: ((value: SpineConfig | null) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('spine-config-overlay')!;
    this.titleEl = document.getElementById('spine-config-title')!;
    this.animationSelect = document.getElementById('spine-config-animation') as HTMLSelectElement;
    this.loopInput = document.getElementById('spine-config-loop') as HTMLInputElement;
    this.scaleInput = document.getElementById('spine-config-scale') as HTMLInputElement;
    this.confirmBtn = document.getElementById('spine-config-confirm') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('spine-config-cancel') as HTMLButtonElement;

    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });
  }

  /** Shows the dialog pre-filled with the skeleton's animations, resolving with the chosen config or null if cancelled. */
  open(label: string, animationNames: string[]): Promise<SpineConfig | null> {
    this.titleEl.textContent = `Configure Spine — ${label}`;

    this.animationSelect.innerHTML = '';
    const setupOption = document.createElement('option');
    setupOption.value = '';
    setupOption.textContent = '(Setup pose — no animation)';
    this.animationSelect.appendChild(setupOption);
    for (const name of animationNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.animationSelect.appendChild(opt);
    }
    this.animationSelect.value = animationNames[0] ?? '';

    this.loopInput.checked = true;
    this.scaleInput.value = '1';

    this.overlay.classList.add('visible');

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private confirm(): void {
    const config: SpineConfig = {
      animationName: this.animationSelect.value || null,
      loop: this.loopInput.checked,
      scale: Math.max(0.01, parseFloat(this.scaleInput.value) || 1),
    };
    this.overlay.classList.remove('visible');
    this.resolvePromise?.(config);
    this.resolvePromise = null;
  }

  private cancel(): void {
    this.overlay.classList.remove('visible');
    this.resolvePromise?.(null);
    this.resolvePromise = null;
  }
}
