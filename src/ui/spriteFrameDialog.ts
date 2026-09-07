import type { FrameOption } from '../assets/types';

export class SpriteFrameDialog {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private listEl: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private resolvePromise: ((value: string | null) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('sprite-frame-overlay')!;
    this.titleEl = document.getElementById('sprite-frame-title')!;
    this.listEl = document.getElementById('sprite-frame-list')!;
    this.confirmBtn = document.getElementById('sprite-frame-confirm') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('sprite-frame-cancel') as HTMLButtonElement;

    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });
  }

  /** Shows the dialog and resolves with the chosen frame name, or null if the user cancelled. */
  open(label: string, frames: FrameOption[]): Promise<string | null> {
    this.titleEl.textContent = `Choose Sprite Frame — ${label}`;

    this.listEl.innerHTML = '';
    frames.forEach((frame, i) => {
      const row = document.createElement('label');
      row.className = 'inspector-frame-check';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'sprite-frame-choice';
      radio.value = frame.name;
      radio.checked = i === 0;

      const nameEl = document.createElement('span');
      nameEl.textContent = frame.name;

      row.append(radio, nameEl);
      this.listEl.appendChild(row);
    });

    this.overlay.classList.add('visible');

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private confirm(): void {
    const checked = this.listEl.querySelector<HTMLInputElement>('input[type=radio]:checked');
    if (!checked) return;

    this.overlay.classList.remove('visible');
    this.resolvePromise?.(checked.value);
    this.resolvePromise = null;
  }

  private cancel(): void {
    this.overlay.classList.remove('visible');
    this.resolvePromise?.(null);
    this.resolvePromise = null;
  }
}
