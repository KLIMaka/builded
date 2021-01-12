
export function createContextFromCanvas(id: string, opts = {}): WebGLRenderingContext {
  const canvas = <HTMLCanvasElement>document.getElementById(id);
  const gl = <WebGLRenderingContext>canvas.getContext('webgl2', opts);
  return gl;
}

export function createContext(w: number, h: number, opts = {}): WebGLRenderingContext {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.id = 'gl';
  const gl = <WebGLRenderingContext>canvas.getContext('webgl2', opts);

  document.body.appendChild(canvas);
  document.body.style.overflow = 'hidden';
  canvas.style.position = 'absolute';
  return gl;
}

function resize(gl: WebGLRenderingContext) {
  const canvas = <HTMLCanvasElement>gl.canvas;

  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width != displayWidth || canvas.height != displayHeight) {

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

export function animate(gl: WebGLRenderingContext, callback: (gl: WebGLRenderingContext, time: number) => void) {
  let time = new Date().getTime();

  function update() {
    resize(gl);
    const now = new Date().getTime();
    callback(gl, (now - time) / 1000);
    requestAnimationFrame(update);
    time = now;
  }

  update();
}

const pixel = new Uint8Array(4);
export function readId(gl: WebGLRenderingContext, x: number, y: number): number {
  gl.readPixels(x, gl.drawingBufferHeight - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return pixel[0] | pixel[1] << 8 | pixel[2] << 16 /*| pixel[3]<<24*/;
}

