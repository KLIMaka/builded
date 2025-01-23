import { Bag } from "@utils/bag";
import { getOrCreate } from "@utils/collections";
import { iter } from "@utils/iter";
import { Function, MultiConsumer, nil, TypedArray } from "@utils/types";
import { mat4 as gmlMat4 } from "gl-matrix";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { DisposableResource, GlContext, Shader, Texture, UniformBlockDefinition } from "./drawstruct";
import { Disposable } from "@utils/callbacks";

type AttribDef = {
  name: string,
  size: number,
  off: number,
  location: number,
}

type AttribScheme = {
  defs: AttribDef[],
  size: number,
}

function getSize(type: string) {
  return match(type)
    .with('float', () => 1)
    .with('vec2', () => 2)
    .with('vec3', () => 3)
    .with('vec4', () => 4)
    .otherwise(t => { throw new Error(`Invalid type ${t}`) });
}

function getAttribScheme(shader: Shader): AttribScheme {
  const defs: AttribDef[] = []
  let off = 0;
  for (const d of shader.getAttributes()) {
    const size = getSize(d.type);
    defs.push({
      name: d.name,
      size,
      off,
      location: shader.getAttributeLocation(d.name)
    });
    off += size;
  }
  return { defs, size: off }
}

export type float = [number];
export type int = [number];
export type vec2 = [number, number];
export type vec3 = [number, number, number];
export type vec4 = [number, number, number, number];
export type AttribType = int | float | vec2 | vec3 | vec4;

type BufferData = {
  vao: WebGLVertexArrayObject,
  count: number,
  off: number,
  deallocate(): void,
  upload(gl: WebGL2RenderingContext): void,
}

type InstancedArrayData = {
  vao: WebGLVertexArrayObject,
  count: number,
}


type Region = [number, number];

class Buffer<T extends TypedArray> implements Disposable {
  readonly glBuffer: DisposableResource<WebGLBuffer>;
  private regions: Region[] = [];

  constructor(glCtx: GlContext,
    private target: number,
    readonly data: T,
    usage = WebGL2RenderingContext.STREAM_DRAW) {
    const gl = glCtx.gl;
    this.glBuffer = glCtx.resource('buffer', gl.createBuffer(), b => gl.deleteBuffer(b));
    gl.bindBuffer(this.target, this.glBuffer.value);
    gl.bufferData(this.target, this.data, usage);
    gl.bindBuffer(this.target, null);
  }

  set(off: number, data: T) {
    this.data.set(data, off);
    this.regions.push([off, data.length]);
  }

  private mergeRegions(i: number): [number, Region] {
    const region = this.regions[i];
    for (; ;) {
      if (i + 1 >= this.regions.length) break;
      const currentend = region[0] + region[1];
      const nextstart = this.regions[i + 1][0];
      const diff = nextstart - currentend;
      if (diff !== 0) break;
      region[1] += this.regions[++i][1];
    }
    return [i, region];
  }

  update(gl: WebGLRenderingContext): void {
    if (this.regions.length === 0) return;
    for (let i = 0; i < this.regions.length; i++) {
      const [ii, region] = this.mergeRegions(i);
      i = ii;
      this.updateRegion(gl, region);
    }
    this.regions = [];
  }

  updateRegion(gl: WebGLRenderingContext, [offset, length]: Region): void {
    const sizeof = this.data.BYTES_PER_ELEMENT;
    var region = new Uint8Array(this.data.buffer, offset * sizeof, length * sizeof);
    gl.bindBuffer(this.target, this.glBuffer.value);
    gl.bufferSubData(this.target, offset * sizeof, region);
    gl.bindBuffer(this.target, null);
  }

  async dispose(): Promise<void> {
    this.glBuffer.dispose();
  }
}

export type BufferAllocatorFactory = Function<AttribScheme, BufferAllocator>;

export class BufferAllocator implements Disposable {
  private idxBag: Bag;
  private vtxBag: Bag;
  private idxBuffer: Buffer<Uint32Array>;
  private vtxBuffer: Buffer<Float32Array>;
  private vao: DisposableResource<WebGLVertexArrayObject>;

  constructor(
    private glCxt: GlContext,
    private scheme: AttribScheme,
    maxIdxSize: number,
    maxVtxSize: number,
  ) {
    const gl = glCxt.gl;
    this.idxBag = new Bag(maxIdxSize);
    this.vtxBag = new Bag(maxVtxSize);
    this.idxBuffer = new Buffer(glCxt, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(maxIdxSize));
    this.vtxBuffer = new Buffer(glCxt, gl.ARRAY_BUFFER, new Float32Array(maxVtxSize));
    this.vao = this.createVAO(glCxt, scheme);
  }

  allocate(vtxData: Float32Array, idxData: Uint32Array): BufferData {
    const vtxCount = vtxData.length / this.scheme.size;
    if (!Number.isInteger(vtxCount)) throw new Error(`Invalid vertex data size ${vtxData.length} (attributesSize=${this.scheme.size})`);
    const maxIdx = idxData.reduce((l, r) => Math.max(l, r));
    if (maxIdx >= vtxCount) throw new Error(`Invalid index data. Referenced vertex id=${maxIdx}`);

    const vtxoff = this.vtxBag.get(vtxData.length);
    if (vtxoff === null) return null;
    const idxoff = this.idxBag.get(idxData.length);
    if (idxoff === null) {
      this.vtxBag.put(vtxoff, vtxData.length);
      return null;
    }
    const elemOff = vtxoff / this.scheme.size;
    this.vtxBuffer.set(vtxoff, vtxData);
    this.idxBuffer.set(idxoff, idxData.map(x => x + elemOff));

    return {
      vao: this.vao.value,
      count: idxData.length,
      off: idxoff,
      deallocate: () => this.deallocate(vtxoff, vtxData.length, idxoff, idxData.length),
      upload: gl => this.update(gl)
    }
  }

  allocateInstanced(vtxData: Float32Array): InstancedArrayData {
    const gl = this.glCxt.gl;
    const count = vtxData.length / this.scheme.size;
    const buffer = new Buffer(this.glCxt, gl.ARRAY_BUFFER, vtxData);
    const vao = this.createVAOInstanced(this.glCxt, buffer.glBuffer.value).value;
    return { vao, count }
  }

  private update(gl: WebGL2RenderingContext) {
    this.vtxBuffer.update(gl);
    this.idxBuffer.update(gl);
  }

  private createVAO(glCtx: GlContext, scheme: AttribScheme): DisposableResource<WebGLVertexArrayObject> {
    const gl = glCtx.gl;
    const vao = glCtx.resource('vao', gl.createVertexArray(), vao => gl.deleteVertexArray(vao));
    gl.bindVertexArray(vao.value);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuffer.glBuffer.value);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vtxBuffer.glBuffer.value);
    const stride = scheme.size * 4;
    for (const attr of scheme.defs) {
      gl.enableVertexAttribArray(attr.location);
      gl.vertexAttribPointer(attr.location, attr.size, gl.FLOAT, false, stride, attr.off * 4);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  private createVAOInstanced(glCtx: GlContext, buffer: WebGLBuffer): DisposableResource<WebGLVertexArrayObject> {
    const gl = glCtx.gl;
    const vao = glCtx.resource('vao', gl.createVertexArray(), vao => gl.deleteVertexArray(vao));
    gl.bindVertexArray(vao.value);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = this.scheme.size * 4;
    for (const attr of this.scheme.defs) {
      gl.enableVertexAttribArray(attr.location);
      gl.vertexAttribPointer(attr.location, attr.size, gl.FLOAT, false, stride, attr.off * 4);
      gl.vertexAttribDivisor(attr.location, 1);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  private deallocate(vtxoff: number, vtxsize: number, idxoff: number, idxsize: number) {
    this.vtxBag.put(vtxoff, vtxsize);
    this.idxBag.put(idxoff, idxsize);
  }

  async dispose(): Promise<void> {
    this.idxBuffer.dispose();
    this.vtxBuffer.dispose();
    this.vao.dispose();
  }
}

export type AttribData = {
  bufferData: BufferData,
  mode: number,
}

export type AttribDataInstanced = {
  data: InstancedArrayData,
  mode: number,
}

class AttribDataBuilder implements Disposable {
  constructor(
    private scheme: AttribScheme,
    private alloc: BufferAllocator,
    private record = new Float32Array(scheme.size),
    private vtxData = new Float32Array(scheme.size * 64),
    private idxData = new Uint32Array(64),
    private vtxOff = 0,
    private idxOff = 0,
  ) { }

  float(name: string): MultiConsumer<float> { return this.writer(name, 1) }
  vec2(name: string): MultiConsumer<vec2> { return this.writer(name, 2) }
  vec3(name: string): MultiConsumer<vec3> { return this.writer(name, 3) }
  vec4(name: string): MultiConsumer<vec4> { return this.writer(name, 4) }

  private writer<T extends AttribType>(name: string, size: number): MultiConsumer<T> {
    const def = this.scheme.defs.find(d => d.name === name);
    if (def === undefined) throw new Error(`Invalid attribute name '${name}'`);
    if (def.size !== size) throw new Error(`Invalid attribute size. Expected ${size} actual ${def.size}`);
    return (...data: number[]) => this.record.set([...data], def.off);
  }

  start() {
    this.vtxOff = 0;
    this.idxOff = 0;
    this.record.fill(0);
  }

  writeVertex(): number {
    this.ensureVtxSize();
    const off = this.vtxOff;
    this.vtxData.set(this.record, this.vtxOff * this.scheme.size);
    this.vtxOff++;
    return off;
  }

  writeIndex(off: number, pattern: number[]) {
    this.ensureIdxSize();
    this.idxData.set(pattern.map(x => x + off), this.idxOff);
    this.idxOff += pattern.length;
  }

  build(mode: number): AttribData {
    const vtxSizeof = this.scheme.size;
    const bufferData = this.alloc.allocate(this.vtxData.subarray(0, this.vtxOff * vtxSizeof), this.idxData.subarray(0, this.idxOff));
    return { mode, bufferData };
  }

  buildInstanced(mode: number): AttribDataInstanced {
    const vtxSizeof = this.scheme.size;
    const data = this.alloc.allocateInstanced(this.vtxData.subarray(0, this.vtxOff * vtxSizeof));
    return { data, mode };
  }

  private ensureVtxSize() {
    if (this.vtxOff >= this.vtxData.length) {
      const ndata = new Float32Array(this.vtxData.length * 2);
      ndata.set(this.vtxData);
      this.vtxData = ndata;
    }
  }

  private ensureIdxSize() {
    if (this.idxOff >= this.idxData.length) {
      const ndata = new Uint32Array(this.idxData.length * 2);
      ndata.set(this.idxData);
      this.idxData = ndata;
    }
  }

  async dispose(): Promise<void> {
    this.alloc.dispose();
  }
}

export type UniformBlockElement = Readonly<{
  size: number,
  offset: number,
}>;

const float32Setter = (v: DataView, off: number, val: number) => v.setFloat32(off, val, true);
const int32Setter = (v: DataView, off: number, val: number) => v.setInt32(off, val, true);
const mat4Setter = (v: DataView, off: number, val: gmlMat4) => new Float32Array(v.buffer).set(val, off / 4);

function getWriter(type: string): MultiConsumer<[DataView, number, any]> {
  return match(type)
    .with('float', 'vec2', 'vec3', 'vec4', () => float32Setter)
    .with('int', 'ivec2', 'ivec3', 'ivec4', () => int32Setter)
    .with('mat4', () => mat4Setter)
    .otherwise(() => { throw new Error(`Invalid type ${type}`) })
}

type TextureAccessor = {
  readonly name: string,
  unit(): number,
  texture(): Texture;
  wrap(): Wrap;
  setTexture: TextureSetter,
}

export type Sampler2D = [Texture];
export type mat4 = [gmlMat4]
type UniformTypes = float | vec2 | vec3 | vec4 | Sampler2D | mat4;

export class UniformBlock {
  constructor(
    gl: WebGL2RenderingContext,
    readonly blockId: number,
    readonly def: UniformBlockDefinition,
    private buffer = new ArrayBuffer(def.size),
    private glBuffer = gl.createBuffer(),
    private writers = new Map<string, MultiConsumer<any>>(),
  ) {
    this.createWriters();
    gl.bindBufferBase(gl.UNIFORM_BUFFER, blockId, this.glBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, this.buffer.byteLength, gl.DYNAMIC_DRAW);
  }

  private createWriters() {
    const view = new DataView(this.buffer);
    for (const u of this.def.uniforms) {
      const w = getWriter(u.type);
      this.writers.set(u.name, (...data: any[]) => {
        let off = u.blockOffset;
        for (const v of data) {
          w(view, off, v);
          off += 4;
        }
      });
    }
  }

  writer<T extends UniformTypes>(name: string): MultiConsumer<T> {
    return Optional.ofNullable(this.writers.get(name)).orElseThrow(() => new Error(`Invalid uniform: ${name}`));
  }

  update(gl: WebGL2RenderingContext) {
    gl.bindBuffer(gl.UNIFORM_BUFFER, this.glBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.buffer);
  }
}

export class UniformBlocksRegistry {
  private lastBlockId = 0;
  private registry = new Map<string, [UniformBlockDefinition, UniformBlock]>();

  register(gl: WebGL2RenderingContext, shader: Shader): Map<string, UniformBlock> {
    return iter(shader.getUniformBlocks())
      .toMap(b => b.name, b => {
        const [existed, writer] = getOrCreate(this.registry, b.name, _ => [b, new UniformBlock(gl, this.lastBlockId++, b)]);
        if (!UniformBlocksRegistry.checkBlocksSame(existed, b)) throw new Error(`Invalid uniform block '${b.name}' in '${shader.name}'`);
        gl.uniformBlockBinding(shader.getProgram(), b.blockIndex, writer.blockId);
        return writer
      });
  }

  private static checkBlocksSame(b1: UniformBlockDefinition, b2: UniformBlockDefinition): boolean {
    return b1.uniforms.length === b2.uniforms.length && iter(b1.uniforms).zip(b2.uniforms).all(([u1, u2]) => u1.type === u2.type)
  }
}

function getTextures(gl: WebGL2RenderingContext, shader: Shader): TextureAccessor[] {
  gl.useProgram(shader.getProgram());
  return iter(shader.getSamplers()).enumerate().map(([s, i]) => {
    const location = shader.getUniformLocation(s.name);
    gl.uniform1i(location, i);
    let currentTexture: Texture = null;
    let currentWrap: Wrap = 'CLAMP';
    const unit = () => i;
    const texture = () => currentTexture;
    const wrap = () => currentWrap;
    const setTexture = (tex: Texture, wrap?: Wrap) => { currentTexture = tex; currentWrap = wrap ?? 'CLAMP' }
    const name = s.name;
    return { name, unit, texture, setTexture, wrap };
  }).collect();
}

export type Wrap = 'CLAMP' | 'REPEAT';
export type TextureSetter = (tex: Texture, wrap?: Wrap) => void;

export class ShaderConfig implements Disposable {
  constructor(
    glCtx: GlContext,
    blockRegistry: UniformBlocksRegistry,
    allocFactory: BufferAllocatorFactory,
    private state: StateGl1,
    private shader: Shader,
    private scheme = getAttribScheme(shader),
    private attribBuilder = new AttribDataBuilder(scheme, allocFactory(scheme)),
    private blocks = blockRegistry.register(glCtx.gl, shader),
    private textures = getTextures(glCtx.gl, shader),
  ) { }

  builder(): AttribDataBuilder {
    return this.attribBuilder;
  }

  uniformBlock(name: string): UniformBlock {
    const block = this.blocks.get(name);
    if (block === undefined) throw new Error(`Invalid uniform block '${name}'`);
    return block;
  }

  texture(name: string): TextureSetter {
    return iter(this.textures)
      .first(t => t.name === name)
      .map(t => t.setTexture)
      .orElse(nil());
  }

  draw(gl: WebGL2RenderingContext, attrs: AttribData) {
    attrs.bufferData.upload(gl);
    this.blocks.values().forEach(b => b.update(gl));
    this.bindTextures(gl);
    const indexBufferType = WebGL2RenderingContext.UNSIGNED_INT;
    const indexSizeoff = 4;
    gl.bindVertexArray(attrs.bufferData.vao);
    gl.drawElements(attrs.mode, attrs.bufferData.count, indexBufferType, attrs.bufferData.off * indexSizeoff);
    gl.bindVertexArray(null);
  }

  drawInstanced(gl: WebGL2RenderingContext, data: AttribDataInstanced) {
    this.blocks.values().forEach(b => b.update(gl));
    this.bindTextures(gl);
    gl.bindVertexArray(data.data.vao);
    gl.drawArraysInstanced(data.mode, 0, 6, data.data.count);
    gl.bindVertexArray(null);
  }

  bind(gl: WebGL2RenderingContext) {
    gl.useProgram(this.shader.getProgram());
  }

  private bindTextures(gl: WebGL2RenderingContext) {
    for (const ta of this.textures) {
      this.state.bindTexture(gl, ta.unit(), ta.texture(), ta.wrap());
    }
  }

  async dispose(): Promise<void> {
    this.shader.dispose();
    this.attribBuilder.dispose();
  }
}

export class StateGl1 implements Disposable {
  private shaders = new Map<string, ShaderConfig>();
  private uniformBlocksRegistry = new UniformBlocksRegistry();
  private currentShader: ShaderConfig;
  private clampWrap: DisposableResource<WebGLSampler>;
  private repeatWrap: DisposableResource<WebGLSampler>;

  constructor(
    private glCtx: GlContext,
    private allocFactory: BufferAllocatorFactory,
  ) {
    this.createWraps(glCtx);
  }

  private createWraps({ gl, resource }: GlContext) {
    this.clampWrap = resource('sampler', gl.createSampler(), s => gl.deleteSampler(s));
    gl.samplerParameteri(this.clampWrap.value, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.clampWrap.value, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.clampWrap.value, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.samplerParameteri(this.clampWrap.value, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.repeatWrap = resource('sampler', gl.createSampler(), s => gl.deleteSampler(s));
    gl.samplerParameteri(this.repeatWrap.value, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.repeatWrap.value, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.samplerParameteri(this.repeatWrap.value, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.samplerParameteri(this.repeatWrap.value, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  register(name: string, shader: Shader) {
    this.shaders.set(name, new ShaderConfig(this.glCtx, this.uniformBlocksRegistry, this.allocFactory, this, shader));
  }

  getShader(name: string): ShaderConfig {
    return this.shaders.get(name);
  }

  draw(shader: ShaderConfig, attrs: AttribData) {
    if (shader !== this.currentShader) {
      this.currentShader = shader;
      this.currentShader.bind(this.glCtx.gl);
    }
    this.currentShader.draw(this.glCtx.gl, attrs);
  }

  drawInstanced(shader: ShaderConfig, data: AttribDataInstanced) {
    if (shader !== this.currentShader) {
      this.currentShader = shader;
      this.currentShader.bind(this.glCtx.gl);
    }
    this.currentShader.drawInstanced(this.glCtx.gl, data);
  }
  private getSampler(wrap?: Wrap): WebGLSampler {
    if (wrap === 'CLAMP') return this.clampWrap.value;
    if (wrap === 'REPEAT') return this.repeatWrap.value;
    return this.clampWrap.value;
  }

  bindTexture(gl: WebGL2RenderingContext, unit: number, tex: Texture, wrap?: Wrap) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex.get());
    gl.bindSampler(unit, this.getSampler(wrap));
  }

  async dispose(): Promise<void> {
    this.clampWrap.dispose();
    this.repeatWrap.dispose();
    this.shaders.values().forEach(s => s.dispose());
  }
}