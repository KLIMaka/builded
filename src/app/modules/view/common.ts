import { MessageHandler, MessageHandlerReflective } from "../../apis/handler";
import { Frame, PreFrame } from "../../edit/messages";

export interface ViewCanvas extends MessageHandler {
  getCanvas(): HTMLCanvasElement;
  start(): void;
  stop(): void;
  isActive(): boolean;
}

export class ViewBase extends MessageHandlerReflective implements ViewCanvas {
  private mouseX = 0;
  private mouseY = 0;
  private mouseMoved = false;

  constructor(
    private gl: WebGL2RenderingContext,
    private offscreen: OffscreenCanvas,
    private canvas: HTMLCanvasElement,
    private active = true,
  ) {
    super();
    this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this.mouseX = e.offsetX;
      this.mouseY = e.offsetY;
      this.mouseMoved = true;
    });
  }

  getCanvas() { return this.canvas }
  start() { this.active = true };
  stop() { this.active = false };
  isActive() { return this.active };

  protected draw(dt: number) { throw new Error('Unimplemented') }
  protected mouse(mx: number, my: number) { throw new Error('Unimplemented') }

  Frame(msg: Frame) {
    const gl = this.gl;
    if (!this.isActive()) return;
    const canvas = this.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.offscreen.width = w;
    this.offscreen.height = h;
    gl.viewport(0, 0, w, h);
    this.draw(msg.dt);
    canvas.getContext('bitmaprenderer')
      .transferFromImageBitmap(this.offscreen.transferToImageBitmap());
  }

  PreFrame(msg: PreFrame) {
    if (this.mouseMoved) {
      this.mouse(this.mouseX, this.mouseY);
      this.mouseMoved = false;
    }
  }
}