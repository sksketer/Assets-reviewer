import type { AnimatedSprite, Sprite } from 'pixi.js';
import type { AssetInfo } from '../assets/types';
import { formatBytes } from '../assets/format';
import { makeDraggable } from './draggable';

const REFRESH_INTERVAL_MS = 150;

export class Inspector {
  private panel: HTMLElement;
  private title: HTMLElement;
  private sourceEl: HTMLElement;
  private typeEl: HTMLElement;
  private fileSizeEl: HTMLElement;
  private dimensionsEl: HTMLElement;
  private gpuEl: HTMLElement;
  private frameEl: HTMLElement;
  private playbackRow: HTMLElement;
  private playToggle: HTMLButtonElement;
  private speedRow: HTMLElement;
  private speedInput: HTMLInputElement;
  private speedValue: HTMLElement;
  private selectRow: HTMLElement;
  private select: HTMLSelectElement;
  private framesRow: HTMLElement;
  private framesList: HTMLElement;
  private closeBtn: HTMLElement;

  private current: { display: Sprite | AnimatedSprite; info: AssetInfo } | null = null;
  private refreshHandle: number | null = null;

  constructor() {
    this.panel = document.getElementById('inspector-panel')!;
    this.title = document.getElementById('inspector-title')!;
    this.sourceEl = document.getElementById('inspector-source')!;
    this.typeEl = document.getElementById('inspector-type')!;
    this.fileSizeEl = document.getElementById('inspector-filesize')!;
    this.dimensionsEl = document.getElementById('inspector-dimensions')!;
    this.gpuEl = document.getElementById('inspector-gpu')!;
    this.frameEl = document.getElementById('inspector-frame')!;
    this.playbackRow = document.getElementById('inspector-playback-row')!;
    this.playToggle = document.getElementById('inspector-play-toggle') as HTMLButtonElement;
    this.speedRow = document.getElementById('inspector-speed-row')!;
    this.speedInput = document.getElementById('inspector-speed') as HTMLInputElement;
    this.speedValue = document.getElementById('inspector-speed-value')!;
    this.selectRow = document.getElementById('inspector-frame-select-row')!;
    this.select = document.getElementById('inspector-frame-select') as HTMLSelectElement;
    this.framesRow = document.getElementById('inspector-frames-row')!;
    this.framesList = document.getElementById('inspector-frames-list')!;
    this.closeBtn = document.getElementById('inspector-close')!;

    this.closeBtn.addEventListener('click', () => this.hide());
    this.select.addEventListener('change', () => this.onSelectFrame());
    this.playToggle.addEventListener('click', () => this.onTogglePlay());
    this.speedInput.addEventListener('input', () => this.onSpeedChange());

    makeDraggable(this.panel, document.getElementById('inspector-header')!);
  }

  show(display: Sprite | AnimatedSprite, info: AssetInfo): void {
    this.current = { display, info };
    this.panel.classList.remove('hidden');
    if (!this.panel.style.left && !this.panel.style.top) {
      this.panel.style.left = '24px';
      this.panel.style.top = '88px';
    }
    this.renderStatic();
    this.startRefreshLoop();
  }

  hide(): void {
    this.panel.classList.add('hidden');
    this.current = null;
    this.stopRefreshLoop();
  }

  /** Call when a display object might have been removed from the stage, so the panel doesn't linger on stale data. */
  hideIfShowing(display: Sprite | AnimatedSprite): void {
    if (this.current?.display === display) this.hide();
  }

  private renderStatic(): void {
    if (!this.current) return;
    const { display, info } = this.current;
    const isAnimated = info.kind === 'animated';

    this.title.textContent = info.label;
    this.sourceEl.textContent = info.label;
    this.typeEl.textContent = isAnimated ? 'Animated Sprite' : 'Sprite';
    this.fileSizeEl.textContent = formatBytes(info.fileSizeBytes);
    this.dimensionsEl.textContent = info.dimensionsLabel;
    this.gpuEl.textContent = formatBytes(info.gpuMemoryBytes);

    this.select.innerHTML = '';
    for (const frame of info.frames) {
      const opt = document.createElement('option');
      opt.value = frame.name;
      opt.textContent = frame.name;
      this.select.appendChild(opt);
    }
    this.selectRow.classList.toggle('hidden', info.frames.length <= 1);
    this.playbackRow.classList.toggle('hidden', !isAnimated);
    this.speedRow.classList.toggle('hidden', !isAnimated);
    this.framesRow.classList.toggle('hidden', !isAnimated || info.frames.length <= 1);

    if (isAnimated) {
      const anim = display as AnimatedSprite;
      this.speedInput.value = String(anim.animationSpeed);
      this.speedValue.textContent = `${anim.animationSpeed.toFixed(2)}x`;
      this.renderFramesChecklist();
    }

    this.updateDynamic();
  }

  private renderFramesChecklist(): void {
    if (!this.current) return;
    const { info } = this.current;
    const activeNames = new Set(info.playbackFrameNames ?? []);

    this.framesList.innerHTML = '';
    for (const frame of info.frames) {
      const label = document.createElement('label');
      label.className = 'inspector-frame-check';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = frame.name;
      checkbox.checked = activeNames.has(frame.name);
      checkbox.addEventListener('change', () => this.onToggleFrameInAnimation(checkbox));

      const nameEl = document.createElement('span');
      nameEl.textContent = frame.name;

      label.appendChild(checkbox);
      label.appendChild(nameEl);
      this.framesList.appendChild(label);
    }
  }

  private updateDynamic(): void {
    if (!this.current) return;
    const { display, info } = this.current;

    if (info.kind === 'animated') {
      const anim = display as AnimatedSprite;
      if (anim.playing && info.playbackFrameNames) {
        info.currentFrame = info.playbackFrameNames[anim.currentFrame] ?? info.currentFrame;
      }
      this.playToggle.textContent = anim.playing ? 'Pause' : 'Play';
    }

    this.frameEl.textContent = info.currentFrame;
    if (info.frames.some((f) => f.name === info.currentFrame)) {
      this.select.value = info.currentFrame;
    }
  }

  private startRefreshLoop(): void {
    this.stopRefreshLoop();
    this.refreshHandle = window.setInterval(() => this.updateDynamic(), REFRESH_INTERVAL_MS);
  }

  private stopRefreshLoop(): void {
    if (this.refreshHandle !== null) {
      window.clearInterval(this.refreshHandle);
      this.refreshHandle = null;
    }
  }

  private onSelectFrame(): void {
    if (!this.current) return;
    const { display, info } = this.current;
    const name = this.select.value;
    const frame = info.frames.find((f) => f.name === name);
    if (!frame) return;

    if (info.kind === 'animated') {
      (display as AnimatedSprite).stop();
    }
    display.texture = frame.texture;
    info.currentFrame = name;
    this.updateDynamic();
  }

  private onTogglePlay(): void {
    if (!this.current || this.current.info.kind !== 'animated') return;
    const anim = this.current.display as AnimatedSprite;
    if (anim.playing) anim.stop();
    else anim.play();
    this.updateDynamic();
  }

  private onSpeedChange(): void {
    if (!this.current || this.current.info.kind !== 'animated') return;
    const anim = this.current.display as AnimatedSprite;
    const speed = parseFloat(this.speedInput.value);
    anim.animationSpeed = speed;
    this.speedValue.textContent = `${speed.toFixed(2)}x`;
  }

  private onToggleFrameInAnimation(changed: HTMLInputElement): void {
    if (!this.current || this.current.info.kind !== 'animated') return;
    const { display, info } = this.current;
    const anim = display as AnimatedSprite;

    const checkboxes = [...this.framesList.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const checkedNames = new Set(checkboxes.filter((c) => c.checked).map((c) => c.value));

    if (checkedNames.size === 0) {
      // Keep at least one frame in the animation; revert the box that was just unchecked.
      changed.checked = true;
      return;
    }

    const orderedNames = info.frames.map((f) => f.name).filter((name) => checkedNames.has(name));
    const textureByName = new Map(info.frames.map((f) => [f.name, f.texture]));
    const newTextures = orderedNames.map((name) => textureByName.get(name)!);

    const wasPlaying = anim.playing;
    const speed = anim.animationSpeed;
    anim.textures = newTextures; // resets to frame 0 and stops, per Pixi's AnimatedSprite.textures setter
    anim.animationSpeed = speed;
    info.playbackFrameNames = orderedNames;
    info.currentFrame = orderedNames[0];
    if (wasPlaying) anim.play();

    this.updateDynamic();
  }
}
