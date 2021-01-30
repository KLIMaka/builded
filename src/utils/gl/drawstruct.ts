
export interface VertexBuffer {
  getBuffer(): WebGLBuffer;
  getType(): number;
  getSpacing(): number;
  getNormalized(): boolean;
  getStride(): number;
  getOffset(): number;
  destroy(gl: WebGLRenderingContext): void;
}

export interface IndexBuffer {
  getBuffer(): WebGLBuffer;
  getType(): number;
  destroy(gl: WebGLRenderingContext): void;
}

export interface Texture {
  get(): WebGLTexture;
  getWidth(): number;
  getHeight(): number;
  getFormat(): number;
  getType(): number;
  destroy(gl: WebGLRenderingContext): void;
}

export interface Shader {
  getUniformLocation(name: string, gl: WebGLRenderingContext): WebGLUniformLocation;
  getAttributeLocation(name: string, gl: WebGLRenderingContext): number;
  getProgram(): WebGLProgram;
  getUniforms(): Definition[];
  getAttributes(): Definition[];
  getSamplers(): Definition[];
  destroy(gl: WebGLRenderingContext): void;
}

export interface Definition {
  readonly name: string;
  readonly type: string;
}