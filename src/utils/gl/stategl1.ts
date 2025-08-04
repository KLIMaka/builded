import { Disposable } from "ts-utils/callbacks";
import { getOrCreate } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { Function, MultiConsumer, TypedArray } from "ts-utils/types";
import { mat4 as gmlMat4 } from "gl-matrix";
import Optional from "optional-js";
import { match } from "ts-pattern";
import { DisposableResource, GlContext, Shader, Texture, UniformBlockDefinition } from "./drawstruct";

type AttribValueType = 'FLOAT' | 'INT';

type AttrDataType = {
  size: number,
  byteSize: number,
  byteOff: number,
  type: number,
  valueType: AttribValueType,
  mapper(view: DataView, ...data: number[]): void
};

type AttribDef = {
  name: string,
  type: AttrDataType,
  location: number,
}

type AttribScheme = {
  defs: AttribDef[],
  byteSize: number,
}


function getTypeDetails(name: string, byteOff: number): Pick<AttrDataType, 'byteSize' | 'mapper' | 'type'> {
  return match(name)
    .returnType<Pick<AttrDataType, 'byteSize' | 'mapper' | 'type'>>()
    .when(n => n.endsWith('_i8'), () => ({ type: WebGL2RenderingContext.BYTE, byteSize: 1, mapper: (v, ...d) => d.forEach((d, i) => v.setInt8(byteOff + i, d)) }))
    .when(n => n.endsWith('_u8'), () => ({ type: WebGL2RenderingContext.UNSIGNED_BYTE, byteSize: 1, mapper: (v, ...d) => d.forEach((d, i) => v.setUint8(byteOff + i, d)) }))
    .when(n => n.endsWith('_i16'), () => ({ type: WebGL2RenderingContext.SHORT, byteSize: 2, mapper: (v, ...d) => d.forEach((d, i) => v.setInt16(byteOff + i * 2, d, true)) }))
    .when(n => n.endsWith('_u16'), () => ({ type: WebGL2RenderingContext.UNSIGNED_SHORT, byteSize: 2, mapper: (v, ...d) => d.forEach((d, i) => v.setUint16(byteOff + i * 2, d, true)) }))
    .when(n => n.endsWith('_i32'), () => ({ type: WebGL2RenderingContext.INT, byteSize: 4, mapper: (v, ...d) => d.forEach((d, i) => v.setInt32(byteOff + i * 4, d, true)) }))
    .when(n => n.endsWith('_u32'), () => ({ type: WebGL2RenderingContext.UNSIGNED_INT, byteSize: 4, mapper: (v, ...d) => d.forEach((d, i) => v.setUint32(byteOff + i * 4, d, true)) }))
    .otherwise(() => ({ type: WebGL2RenderingContext.FLOAT, byteSize: 4, mapper: (v, ...d) => d.forEach((d, i) => v.setFloat32(byteOff + i * 4, d, true)) }));
}

function getType(name: string, type: string, byteOff: number): AttrDataType {
  return match(type)
    .returnType<AttrDataType>()
    .with('float', () => ({ byteOff, valueType: 'FLOAT', size: 1, ...getTypeDetails(name, byteOff) }))
    .with('vec2', () => ({ byteOff, valueType: 'FLOAT', size: 2, ...getTypeDetails(name, byteOff) }))
    .with('vec3', () => ({ byteOff, valueType: 'FLOAT', size: 3, ...getTypeDetails(name, byteOff) }))
    .with('vec4', () => ({ byteOff, valueType: 'FLOAT', size: 4, ...getTypeDetails(name, byteOff) }))
    .with('int', () => ({ byteOff, valueType: 'INT', size: 1, ...getTypeDetails(name, byteOff) }))
    .with('ivec2', () => ({ byteOff, valueType: 'INT', size: 2, ...getTypeDetails(name, byteOff) }))
    .with('ivec3', () => ({ byteOff, valueType: 'INT', size: 3, ...getTypeDetails(name, byteOff) }))
    .with('ivec4', () => ({ byteOff, valueType: 'INT', size: 4, ...getTypeDetails(name, byteOff) }))
    .with('uint', () => ({ byteOff, valueType: 'INT', size: 1, ...getTypeDetails(name, byteOff) }))
    .with('uvec2', () => ({ byteOff, valueType: 'INT', size: 2, ...getTypeDetails(name, byteOff) }))
    .with('uvec3', () => ({ byteOff, valueType: 'INT', size: 3, ...getTypeDetails(name, byteOff) }))
    .with('uvec4', () => ({ byteOff, valueType: 'INT', size: 4, ...getTypeDetails(name, byteOff) }))
    .otherwise(t => { throw new Error(`Invalid type ${t}`) });
}

function getAttribScheme(shader: Shader): AttribScheme {
  const defs: AttribDef[] = []
  let off = 0;
  for (const d of shader.getAttributes()) {
    const byteOff = off;
    const type = getType(d.name, d.type, byteOff);
    defs.push({
      type: { ...type, byteOff },
      name: d.name,
      location: shader.getAttributeLocation(d.name)
    });
    off += type.byteSize * type.size;
  }
  return { defs, byteSize: off }
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
} & Disposable;


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

  constructor(
    private glCxt: GlContext,
    private scheme: AttribScheme,
  ) { }


  allocate(vtxData: Uint8Array): InstancedArrayData {
    const gl = this.glCxt.gl;
    const count = vtxData.length / this.scheme.byteSize;
    const buffer = new Buffer(this.glCxt, gl.ARRAY_BUFFER, vtxData);
    const vao = this.createVAOInstanced(this.glCxt, buffer.glBuffer.value);
    const dispose = async () => { buffer.dispose(); vao.dispose() }
    return { vao: vao.value, count, dispose }
  }

  private createVAOInstanced(glCtx: GlContext, buffer: WebGLBuffer): DisposableResource<WebGLVertexArrayObject> {
    const gl = glCtx.gl;
    const vao = glCtx.resource('vao', gl.createVertexArray(), vao => gl.deleteVertexArray(vao));
    gl.bindVertexArray(vao.value);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = this.scheme.byteSize;
    for (const attr of this.scheme.defs) {
      gl.enableVertexAttribArray(attr.location);
      if (attr.type.valueType === 'FLOAT') gl.vertexAttribPointer(attr.location, attr.type.size, attr.type.type, false, stride, attr.type.byteOff);
      else gl.vertexAttribIPointer(attr.location, attr.type.size, attr.type.type, stride, attr.type.byteOff);
      gl.vertexAttribDivisor(attr.location, 1);
    }
    gl.bindVertexArray(null);
    return vao;
  }

  async dispose(): Promise<void> { }
}

export type AttribData = {
  bufferData: BufferData,
  mode: number,
}

export type AttribDataInstanced = {
  data: InstancedArrayData,
  mode: number,
  count: number,
};

export class AttribDataBuilder implements Disposable {
  constructor(
    private scheme: AttribScheme,
    private alloc: BufferAllocator,
    private record = new ArrayBuffer(scheme.byteSize),
    private recordArray = new Uint8Array(record),
    private recordView = new DataView(record),
    private vtxData = new Uint8Array(scheme.byteSize * 64),
    private idxData = new Uint32Array(64),
    private vtxOff = 0,
    private idxOff = 0,
  ) {
  }

  scalar(name: string): MultiConsumer<float> { return this.writer(name, 1) }
  vec2(name: string): MultiConsumer<vec2> { return this.writer(name, 2) }
  vec3(name: string): MultiConsumer<vec3> { return this.writer(name, 3) }
  vec4(name: string): MultiConsumer<vec4> { return this.writer(name, 4) }

  private writer<T extends AttribType>(name: string, size: number): MultiConsumer<T> {
    const def = this.scheme.defs.find(d => d.name === name);
    if (def === undefined) throw new Error(`Invalid attribute name '${name}'`);
    if (def.type.size !== size) throw new Error(`Invalid attribute size. Expected ${size} actual ${def.type.size}`);
    return (...data: number[]) => def.type.mapper(this.recordView, ...data);
  }

  start() {
    this.vtxOff = 0;
    this.idxOff = 0;
    this.recordArray.fill(0);
  }

  writeVertex(): number {
    this.ensureVtxSize();
    const off = this.vtxOff;
    this.vtxData.set(this.recordArray, this.vtxOff * this.scheme.byteSize);
    this.vtxOff++;
    return off;
  }

  writeIndex(off: number, pattern: number[]) {
    this.ensureIdxSize();
    this.idxData.set(pattern.map(x => x + off), this.idxOff);
    this.idxOff += pattern.length;
  }

  build(mode: number, count: number): AttribDataInstanced {
    const vtxSizeof = this.scheme.byteSize;
    const data = this.alloc.allocate(this.vtxData.subarray(0, this.vtxOff * vtxSizeof));
    return { data, mode, count };
  }

  private ensureVtxSize() {
    if (this.vtxOff * this.scheme.byteSize >= this.vtxData.length) {
      const ndata = new Uint8Array(this.vtxData.length * 2);
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
const uint32Setter = (v: DataView, off: number, val: number) => v.setUint32(off, val, true);
const mat4Setter = (v: DataView, off: number, val: gmlMat4) => new Float32Array(v.buffer).set(val, off / 4);

function getWriter(type: string): MultiConsumer<[DataView, number, any]> {
  return match(type)
    .with('float', 'vec2', 'vec3', 'vec4', () => float32Setter)
    .with('int', 'ivec2', 'ivec3', 'ivec4', () => int32Setter)
    .with('uint', 'uvec2', 'uvec3', 'uvec4', () => uint32Setter)
    .with('mat4', () => mat4Setter)
    .otherwise(() => { throw new Error(`Invalid type ${type}`) })
}

type TextureAccessor = {
  name: string,
  target: number,
  unit: number,
  texture(): WebGLTexture;
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

  uniformBlock(name: string): UniformBlock {
    return this.registry.get(name)[1];
  }

  private static checkBlocksSame(b1: UniformBlockDefinition, b2: UniformBlockDefinition): boolean {
    return b1.uniforms.length === b2.uniforms.length && iter(b1.uniforms).zip(b2.uniforms).all(([u1, u2]) => u1.type === u2.type)
  }
}

function getSamplerTarget(type: string): number {
  return match(type)
    .with('sampler2D', 'usampler2D', () => WebGL2RenderingContext.TEXTURE_2D)
    .with('sampler2DArray', () => WebGL2RenderingContext.TEXTURE_2D_ARRAY)
    .otherwise(() => { throw new Error(`Invalid sampler type ${type}`) })
}

function getTextures(gl: WebGL2RenderingContext, shader: Shader): TextureAccessor[] {
  gl.useProgram(shader.getProgram());
  return iter(shader.getSamplers()).enumerate().map(([s, i]) => {
    const location = shader.getUniformLocation(s.name);
    gl.uniform1i(location, i);
    let currentTexture: WebGLTexture = null;
    let currentWrap: Wrap = 'CLAMP';
    const unit = i;
    const target = getSamplerTarget(s.type);
    const texture = () => currentTexture;
    const wrap = () => currentWrap;
    const setTexture = (tex: WebGLTexture, wrap?: Wrap) => { currentTexture = tex; currentWrap = wrap ?? 'CLAMP' }
    const name = s.name;
    return { name, unit, target, texture, setTexture, wrap };
  }).collect();
}

export type Wrap = 'CLAMP' | 'REPEAT';
export type TextureSetter = (tex: WebGLTexture, wrap?: Wrap) => void;

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
      .orElseThrow(() => new Error(`Invalid texture uniform '${name}'`));
  }

  draw(gl: WebGL2RenderingContext, data: AttribDataInstanced) {
    this.blocks.values().forEach(b => b.update(gl));
    this.bindTextures(gl);
    gl.bindVertexArray(data.data.vao);
    gl.drawArraysInstanced(data.mode, 0, data.count, data.data.count);
    gl.bindVertexArray(null);
  }

  bind(gl: WebGL2RenderingContext) {
    gl.useProgram(this.shader.getProgram());
  }

  private bindTextures(gl: WebGL2RenderingContext) {
    for (const ta of this.textures) {
      this.state.bindTexture(gl, ta.unit, ta.texture(), ta.wrap(), ta.target);
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

  uniformBlock(name: string) {
    return this.uniformBlocksRegistry.uniformBlock(name);
  }

  register(name: string, shader: Shader) {
    this.shaders.set(name, new ShaderConfig(this.glCtx, this.uniformBlocksRegistry, this.allocFactory, this, shader));
  }

  getShader(name: string): ShaderConfig {
    return this.shaders.get(name);
  }

  draw(shader: ShaderConfig, data: AttribDataInstanced) {
    if (shader !== this.currentShader) {
      this.currentShader = shader;
      this.currentShader.bind(this.glCtx.gl);
    }
    this.currentShader.draw(this.glCtx.gl, data);
  }
  private getSampler(wrap?: Wrap): WebGLSampler {
    if (wrap === 'CLAMP') return this.clampWrap.value;
    if (wrap === 'REPEAT') return this.repeatWrap.value;
    return this.clampWrap.value;
  }

  bindTexture(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture, wrap: Wrap, target: number) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, tex);
    gl.bindSampler(unit, this.getSampler(wrap));
  }

  async dispose(): Promise<void> {
    this.clampWrap.dispose();
    this.repeatWrap.dispose();
    this.shaders.values().forEach(s => s.dispose());
  }
}