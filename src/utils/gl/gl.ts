
export function createContextFromCanvas(id: string, opts = {}): WebGLRenderingContext {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2', opts) as WebGLRenderingContext;
  return gl;
}

export function resize(gl: WebGLRenderingContext) {
  const canvas = gl.canvas as HTMLCanvasElement;
  const parent = canvas.parentElement.parentElement;

  const displayWidth = parent.clientWidth - 2;
  const displayHeight = parent.clientHeight - 35;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

export function switchContext(gl: WebGL2RenderingContext, elem: HTMLElement) {
  const canvas = gl.canvas as HTMLCanvasElement;
  const rect = elem.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > canvas.clientHeight ||
    rect.right < 0 || rect.left > canvas.clientWidth)
    return;

  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  const left = rect.left;
  const bottom = canvas.clientHeight - rect.bottom;

  gl.viewport(left, bottom, width, height);
  gl.scissor(left, bottom, width, height);
}
