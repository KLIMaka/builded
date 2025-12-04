import { Disposable, Source } from "ts-utils/callbacks";
import { Dependency } from "ts-utils/injector";
import { Consumer } from "ts-utils/types";

export type DisposableResource<T> = { readonly value: T } & Disposable;
export type ResourceFactory = <T>(tag: string, value: T, disposer: Consumer<T>) => DisposableResource<T>;

export type GlContext = {
  offscreen: OffscreenCanvas,
  gl: WebGL2RenderingContext,
  resource: ResourceFactory,
  resourcesInfo: Source<Map<string, number>>;
}
export const GL_CONTEXT = new Dependency<GlContext>('Gl Context');


export interface VertexBuffer extends Disposable {
  getBuffer(): WebGLBuffer;
  getType(): number;
  getSpacing(): number;
  getNormalized(): boolean;
  getStride(): number;
  getOffset(): number;
}

export interface IndexBuffer extends Disposable {
  getBuffer(): WebGLBuffer;
  getType(): number;
}

export interface Texture extends Disposable {
  get(): WebGLTexture;
  getWidth(): number;
  getHeight(): number;
}

export interface Shader extends Disposable {
  readonly name: string;
  getUniformLocation(name: string): WebGLUniformLocation;
  getAttributeLocation(name: string): number;
  getProgram(): WebGLProgram;
  getUniformBlocks(): UniformBlockDefinition[];
  getUniforms(): UniformDefinition[];
  getAttributes(): Definition[];
  getSamplers(): Definition[];
  getSamplers(): Definition[];
}

export type Definition = Readonly<{
  name: string;
  type: string;
}>;

export type UniformBlockDefinition = Readonly<{
  name: string,
  blockIndex: number,
  uniforms: UniformDefinition[],
  size: number,
}>;

export type UniformDefinition = Readonly<{
  blockOffset: number,
}> & Definition;