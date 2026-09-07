export class Modal {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private messageEl: HTMLElement;
  private closeBtn: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('modal-overlay')!;
    this.titleEl = document.getElementById('modal-title')!;
    this.messageEl = document.getElementById('modal-message')!;
    this.closeBtn = document.getElementById('modal-close')!;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  showError(message: string, title = 'Invalid Assets'): void {
    this.titleEl.textContent = title;
    this.messageEl.textContent = message;
    this.overlay.classList.add('visible');
  }

  hide(): void {
    this.overlay.classList.remove('visible');
  }
}
