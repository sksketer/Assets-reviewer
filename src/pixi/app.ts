import { Application } from 'pixi.js';

export async function createPixiApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    background: '#141414',
    resizeTo: container,
    antialias: true,
  });
  container.appendChild(app.canvas);
  return app;
}
