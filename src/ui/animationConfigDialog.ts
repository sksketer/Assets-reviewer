import type { FrameOption } from '../assets/types';
import type { AnimationConfig } from '../assets/spriteFactory';

export class AnimationConfigDialog {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private speedInput: HTMLInputElement;
  private speedValueEl: HTMLElement;
  private defaultFrameSelect: HTMLSelectElement;
  private framesList: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private resolvePromise: ((value: AnimationConfig | null) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('anim-config-overlay')!;
    this.titleEl = document.getElementById('anim-config-title')!;
    this.speedInput = document.getElementById('anim-config-speed') as HTMLInputElement;
    this.speedValueEl = document.getElementById('anim-config-speed-value')!;
    this.defaultFrameSelect = document.getElementById('anim-config-default-frame') as HTMLSelectElement;
    this.framesList = document.getElementById('anim-config-frames')!;
    this.confirmBtn = document.getElementById('anim-config-confirm') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('anim-config-cancel') as HTMLButtonElement;

    this.speedInput.addEventListener('input', () => {
      this.speedValueEl.textContent = `${parseFloat(this.speedInput.value).toFixed(2)}x`;
    });
    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });
  }

  /** Shows the dialog and resolves with the chosen config, or null if the user cancelled. */
  open(label: string, frames: FrameOption[], defaultSelectedNames: string[]): Promise<AnimationConfig | null> {
    this.titleEl.textContent = `Configure Animation — ${label}`;
    this.speedInput.value = '0.15';
    this.speedValueEl.textContent = '0.15x';

    const preselected = new Set(defaultSelectedNames.length > 0 ? defaultSelectedNames : frames.map((f) => f.name));
    this.framesList.innerHTML = '';
    for (const frame of frames) {
      const row = document.createElement('label');
      row.className = 'inspector-frame-check';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = frame.name;
      checkbox.checked = preselected.has(frame.name);
      checkbox.addEventListener('change', () => this.onFrameToggle(checkbox));

      const nameEl = document.createElement('span');
      nameEl.textContent = frame.name;

      row.append(checkbox, nameEl);
      this.framesList.appendChild(row);
    }

    this.syncDefaultFrameOptions();
    this.overlay.classList.add('visible');

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private getCheckboxes(): HTMLInputElement[] {
    return [...this.framesList.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  }

  private onFrameToggle(changed: HTMLInputElement): void {
    const anyChecked = this.getCheckboxes().some((c) => c.checked);
    if (!anyChecked) {
      // Keep at least one frame selected; revert the box that was just unchecked.
      changed.checked = true;
      return;
    }
    this.syncDefaultFrameOptions();
  }

  private syncDefaultFrameOptions(): void {
    const previous = this.defaultFrameSelect.value;
    const checkedNames = this.getCheckboxes()
      .filter((c) => c.checked)
      .map((c) => c.value);

    this.defaultFrameSelect.innerHTML = '';
    for (const name of checkedNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      this.defaultFrameSelect.appendChild(opt);
    }
    if (checkedNames.includes(previous)) {
      this.defaultFrameSelect.value = previous;
    }
  }

  private confirm(): void {
    const selectedFrameNames = this.getCheckboxes()
      .filter((c) => c.checked)
      .map((c) => c.value);
    if (selectedFrameNames.length === 0) return;

    const config: AnimationConfig = {
      selectedFrameNames,
      defaultFrameName: this.defaultFrameSelect.value || selectedFrameNames[0],
      speed: parseFloat(this.speedInput.value),
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
