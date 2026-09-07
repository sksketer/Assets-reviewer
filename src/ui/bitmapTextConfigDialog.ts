import type { BitmapTextConfig } from '../assets/bitmapTextFactory';

export class BitmapTextConfigDialog {
  private overlay: HTMLElement;
  private fontFamilyEl: HTMLElement;
  private textInput: HTMLTextAreaElement;
  private fontSizeInput: HTMLInputElement;
  private fillInput: HTMLInputElement;
  private alignSelect: HTMLSelectElement;
  private letterSpacingInput: HTMLInputElement;
  private wordWrapInput: HTMLInputElement;
  private wordWrapWidthRow: HTMLElement;
  private wordWrapWidthInput: HTMLInputElement;
  private anchorXInput: HTMLInputElement;
  private anchorYInput: HTMLInputElement;
  private roundPixelsInput: HTMLInputElement;
  private confirmBtn: HTMLButtonElement;
  private cancelBtn: HTMLButtonElement;

  private resolvePromise: ((value: BitmapTextConfig | null) => void) | null = null;

  constructor() {
    this.overlay = document.getElementById('bitmaptext-config-overlay')!;
    this.fontFamilyEl = document.getElementById('bitmaptext-font-family')!;
    this.textInput = document.getElementById('bitmaptext-text') as HTMLTextAreaElement;
    this.fontSizeInput = document.getElementById('bitmaptext-fontsize') as HTMLInputElement;
    this.fillInput = document.getElementById('bitmaptext-fill') as HTMLInputElement;
    this.alignSelect = document.getElementById('bitmaptext-align') as HTMLSelectElement;
    this.letterSpacingInput = document.getElementById('bitmaptext-letterspacing') as HTMLInputElement;
    this.wordWrapInput = document.getElementById('bitmaptext-wordwrap') as HTMLInputElement;
    this.wordWrapWidthRow = document.getElementById('bitmaptext-wordwrapwidth-row')!;
    this.wordWrapWidthInput = document.getElementById('bitmaptext-wordwrapwidth') as HTMLInputElement;
    this.anchorXInput = document.getElementById('bitmaptext-anchorx') as HTMLInputElement;
    this.anchorYInput = document.getElementById('bitmaptext-anchory') as HTMLInputElement;
    this.roundPixelsInput = document.getElementById('bitmaptext-roundpixels') as HTMLInputElement;
    this.confirmBtn = document.getElementById('bitmaptext-config-confirm') as HTMLButtonElement;
    this.cancelBtn = document.getElementById('bitmaptext-config-cancel') as HTMLButtonElement;

    this.wordWrapInput.addEventListener('change', () => {
      this.wordWrapWidthRow.classList.toggle('hidden', !this.wordWrapInput.checked);
    });
    this.confirmBtn.addEventListener('click', () => this.confirm());
    this.cancelBtn.addEventListener('click', () => this.cancel());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.cancel();
    });
  }

  /** Shows the dialog pre-filled from the loaded font, resolving with the chosen config or null if cancelled. */
  open(fontFamily: string, defaultFontSize: number): Promise<BitmapTextConfig | null> {
    this.fontFamilyEl.textContent = fontFamily;
    this.textInput.value = 'Hello Pixi!';
    this.fontSizeInput.value = String(Math.max(1, Math.round(defaultFontSize)));
    this.fillInput.value = '#ffffff';
    this.alignSelect.value = 'left';
    this.letterSpacingInput.value = '0';
    this.wordWrapInput.checked = false;
    this.wordWrapWidthRow.classList.add('hidden');
    this.wordWrapWidthInput.value = '200';
    this.anchorXInput.value = '0.5';
    this.anchorYInput.value = '0.5';
    this.roundPixelsInput.checked = false;

    this.overlay.classList.add('visible');

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private confirm(): void {
    const text = this.textInput.value;
    if (!text.trim()) return;

    const config: BitmapTextConfig = {
      text,
      fontSize: Math.max(1, parseFloat(this.fontSizeInput.value) || 1),
      fill: this.fillInput.value,
      align: this.alignSelect.value as BitmapTextConfig['align'],
      letterSpacing: parseFloat(this.letterSpacingInput.value) || 0,
      wordWrap: this.wordWrapInput.checked,
      wordWrapWidth: Math.max(10, parseFloat(this.wordWrapWidthInput.value) || 200),
      anchorX: Math.min(1, Math.max(0, parseFloat(this.anchorXInput.value) || 0)),
      anchorY: Math.min(1, Math.max(0, parseFloat(this.anchorYInput.value) || 0)),
      roundPixels: this.roundPixelsInput.checked,
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
