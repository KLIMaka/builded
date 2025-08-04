import { mat4, vec3, vec4 } from 'gl-matrix';
import { Deck, isEmpty } from 'ts-utils/collections';
import { Buffer } from './buffergl';
import { GlType2ArrayType } from './bufferimpl';
import { Definition, IndexBuffer, Shader, Texture, VertexBuffer } from './drawstruct';
import * as SHADER from './shaders';
import { StateValue, StateValueGeneric, StateValueMatrix } from './statevalue';

function createStateValue(type: string, changecb: () => void): StateValue<any> {
  switch (type) {
    case "mat4": return new StateValueMatrix<mat4>(changecb, mat4.create(), mat4.exactEquals, mat4.copy)
    case "vec3": return new StateValueMatrix<vec3>(changecb, vec3.create(), vec3.exactEquals, vec3.copy)
    case "vec4": return new StateValueMatrix<vec4>(changecb, vec4.create(), vec4.exactEquals, vec4.copy)
    default: return new StateValueGeneric<number>(changecb, 0);
  }
}

export class Profile {
  drawsRequested = 0;
  drawsMerged = 0;
  shaderChanges = 0;
  uniformChanges = 0;
  textureChanges = 0;
  bufferChanges = 0;
  shaderSwaps: { [index: string]: number } = {}
  uniqTextures = new Set<Texture>();

  changeShader(from: string, to: string) {
    const key = `${from} -> ${to}`;
    const swap = this.shaderSwaps[key];
    this.shaderSwaps[key] = !swap ? 1 : swap + 1;
  }

  changeTexture(tex: Texture) {
    this.uniqTextures.add(tex);
  }

  reset() {
    this.drawsRequested = 0;
    this.drawsMerged = 0;
    this.shaderChanges = 0;
    this.uniformChanges = 0;
    this.textureChanges = 0;
    this.bufferChanges = 0;
    this.shaderSwaps = {};
    this.uniqTextures.clear()
  }
}

function nextBatch(batch: number) {
  const nb = batch + 0.05;
  return nb > 1.0 ? 0 : nb;
}

class ShaderConfig {
  constructor(
    readonly shader: Shader,
    readonly uniforms: number[],
    readonly attribs: number[],
    readonly samplers: [number, number][]
  ) { }
}

export class State {
  readonly profile = new Profile();

  private batchUniform = -1;
  private lastBuffer: Buffer;

  private shader: StateValue<string> = new StateValueGeneric<string>(() => this.changeShader = true, null);
  private shaderConfig: ShaderConfig = null;
  private lastShader: string;
  private selectedShader: Shader;
  private indexBuffer: StateValue<IndexBuffer> = new StateValueGeneric<IndexBuffer>(() => this.changeIndexBuffer = true, null);
  private shaders = new Map<string, ShaderConfig>();

  private states: StateValue<any>[] = [];
  private stateIndex = new Map<string, number>();

  private attribs: StateValue<VertexBuffer>[] = [];
  private attribNames: string[] = [];
  private attribIndex = new Map<string, number>();

  private uniforms: StateValue<any>[] = [];
  private uniformDefinitions: Definition[] = [];
  private uniformIndex = new Map<string, number>();

  private textures: StateValue<Texture>[] = [];
  private textureIndex = new Map<string, number>();

  private changeShader = true;
  private changeIndexBuffer = true;
  private changedVertexBuffersIds = new Deck<number>();
  private changedTextures = new Deck<[number, number]>();
  private changedUniformIdxs = new Deck<number>();

  private chainOffset = -1;
  private chainSize = -1;
  private chainMode = -1;

  constructor() {
    this.registerState('shader', this.shader);
    this.registerState('aIndex', this.indexBuffer);
  }

  private nextBatch() {
    if (this.batchUniform === -1) this.batchUniform = this.getState('sys');
    const value = [...this.states[this.batchUniform].get() as vec4];
    value[3] = nextBatch(value[3])
    this.states[this.batchUniform].set(value);
  }

  flush(gl: WebGLRenderingContext, buffer: Buffer = this.lastBuffer) {
    if (this.chainMode === -1) return;
    if (buffer) buffer.update(gl);
    const indexBufferType = this.indexBuffer.get().getType();
    const indexSizeoff = GlType2ArrayType(indexBufferType).BYTES_PER_ELEMENT;
    gl.drawElements(this.chainMode, this.chainSize, indexBufferType, this.chainOffset * indexSizeoff);
    // this.nextBatch();
    this.chainMode = -1;
    this.lastBuffer = null;
  }

  private tryChain(gl: WebGLRenderingContext, buffer: Buffer, offset: number, size: number, mode: number): boolean {
    if (this.chainMode === -1) {
      this.chainMode = mode;
      this.chainOffset = offset;
      this.chainSize = size;
      this.lastBuffer = buffer;
      return false;
    } else if (this.sameState(mode)) {
      if (this.chainOffset === offset + size) {
        this.chainOffset = offset;
        this.chainSize += size;
        return true;
      } else if (this.chainOffset + this.chainSize === offset) {
        this.chainSize += size;
        return true;
      }
    }
    this.flush(gl);
    return this.tryChain(gl, buffer, offset, size, mode);
  }

  private sameState(mode: number) {
    return this.chainMode === mode
      && !this.changeShader
      && !this.changeIndexBuffer
      && isEmpty(this.changedUniformIdxs)
      && isEmpty(this.changedTextures)
      && isEmpty(this.changedVertexBuffersIds);
  }

  private registerUniforms(shader: Shader) {
    const uniforms: number[] = [];
    for (const uniform of shader.getUniforms()) {
      const existedId = this.uniformIndex.get(uniform.name);
      if (existedId !== undefined) {
        uniforms.push(existedId);
        continue;
      }
      const idx = this.uniforms.length;
      const state = createStateValue(uniform.type, () => this.changedUniformIdxs.push(idx));
      if (uniform.type !== 'sampler2D') this.registerState(uniform.name, state);
      this.uniforms.push(state);
      this.uniformDefinitions.push(uniform);
      this.uniformIndex.set(uniform.name, idx);
      uniforms.push(idx);
    }
    return uniforms;
  }

  private registerSamplers(shader: Shader): [number, number][] {
    const samplers = shader.getSamplers();
    const shaderSamplers: [number, number][] = [];
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      const existedId = this.textureIndex.get(sampler.name);
      if (existedId !== undefined) {
        shaderSamplers.push([existedId, s]);
        continue;
      };
      const idx = this.textures.length;
      const key: [number, number] = [idx, s];
      const state = new StateValueGeneric<Texture>(() => this.changedTextures.push(key), null);
      this.registerState(sampler.name, state);
      this.textures.push(state);
      this.textureIndex.set(sampler.name, idx);
      shaderSamplers.push(key);
    }
    return shaderSamplers;
  }

  private registerAttributes(shader: Shader) {
    const attribs: number[] = [];
    for (const attrib of shader.getAttributes()) {
      const existedId = this.attribIndex.get(attrib.name);
      if (existedId !== undefined) {
        attribs.push(existedId);
        continue;
      }
      const idx = this.attribs.length;
      const state = new StateValueGeneric<VertexBuffer>(() => this.changedVertexBuffersIds.push(idx), null);
      this.registerState(attrib.name, state);
      this.attribNames[idx] = attrib.name;
      this.attribs.push(state);
      this.attribIndex.set(attrib.name, idx);
      attribs.push(idx);
    }
    return attribs;
  }

  registerShader(name: string, shader: Shader) {
    const uniforms = this.registerUniforms(shader);
    const attribs = this.registerAttributes(shader);
    const samplers = this.registerSamplers(shader);
    this.shaders.set(name, new ShaderConfig(shader, uniforms, attribs, samplers));
  }

  private registerState(name: string, state: StateValue<any>): number {
    if (this.stateIndex.has(name))
      throw new Error(`Duplicate state name ${name}`);
    const idx = this.states.length;
    this.states.push(state);
    this.stateIndex.set(name, idx);
    return idx;
  }

  getState(name: string) {
    const idx = this.stateIndex.get(name);
    if (idx === undefined) throw new Error(`Invalid state name ${name}`);
    return idx;
  }

  setUniform(name: string, value: any) {
    this.getUniformValue(name).set(value);
  }

  getUniformValue(name: string): StateValue<any> {
    const u = this.uniformIndex.get(name);
    if (u === undefined) throw new Error('Invalid uniform name: ' + name);
    return this.uniforms[u];
  }

  isUniformEnabled(name: string): boolean {
    return this.uniformIndex.has(name);
  }

  setShader(name: string) {
    const s = this.shaders.get(name);
    if (s === undefined) throw new Error('Unknown shader: ' + name);
    this.shader.set(name);
    this.shaderConfig = this.shaders.get(name);
  }

  setTexture(name: string, tex: Texture) {
    this.getTextureValue(name).set(tex);
  }

  isTextureEnabled(name: string) {
    return this.textureIndex.has(name);
  }

  getTextureValue(name: string): StateValue<Texture> {
    const t = this.textureIndex.get(name);
    if (t === undefined) throw new Error('Invalid sampler name: ' + name);
    return this.textures[t];
  }

  setIndexBuffer(b: IndexBuffer) {
    this.indexBuffer.set(b);
  }

  setVertexBuffer(name: string, b: VertexBuffer) {
    this.getVertexBufferValue(name).set(b);
  }

  getVertexBufferValue(name: string): StateValue<VertexBuffer> {
    const a = this.attribIndex.get(name);
    if (a === undefined) throw new Error(`Invalid attribute name ${name}`);
    return this.attribs[a];
  }

  private rebindShader(gl: WebGLRenderingContext) {
    if (!this.changeShader) return;
    ++this.profile.shaderChanges;
    const newShader = this.shader.get();
    this.profile.changeShader(this.lastShader, newShader);
    this.lastShader = newShader;
    const shaderConfig = this.shaders.get(newShader);
    const { shader } = shaderConfig;
    this.selectedShader = shader;
    gl.useProgram(shader.getProgram());

    const samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      this.setUniform(sampler.name, s);
    }

    this.changedUniformIdxs.clear().pushAll(shaderConfig.uniforms);
    this.changedVertexBuffersIds.clear().pushAll(shaderConfig.attribs);
    this.changedTextures.clear().pushAll(shaderConfig.samplers);
    this.changeShader = false;
    this.changeIndexBuffer = true;
  }

  private rebindVertexBuffers(gl: WebGLRenderingContext) {
    if (isEmpty(this.changedVertexBuffersIds)) return;
    const vertexBufferIdxs = this.changedVertexBuffersIds;
    const len = vertexBufferIdxs.length();
    const shader = this.selectedShader;
    for (let a = 0; a < len; a++) {
      const idx = vertexBufferIdxs.get(a);
      const buf = this.attribs[idx];
      const vbuf = buf.get();
      const location = shader.getAttributeLocation(this.attribNames[idx]);
      if (location === -1) continue;
      gl.bindBuffer(gl.ARRAY_BUFFER, vbuf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, vbuf.getSpacing(), vbuf.getType(), vbuf.getNormalized(), vbuf.getStride(), vbuf.getOffset());
    }
    vertexBufferIdxs.clear();
  }

  private rebindIndexBuffer(gl: WebGLRenderingContext) {
    if (!this.changeIndexBuffer) return;
    ++this.profile.bufferChanges;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
    this.changeIndexBuffer = false;
  }

  private rebindTextures(gl: WebGLRenderingContext) {
    if (isEmpty(this.changedTextures)) return;
    const textures = this.changedTextures;
    const len = textures.length();
    this.profile.textureChanges += len;
    for (let t = 0; t < len; t++) {
      const [idx, sampler] = textures.get(t);
      const texture = this.textures[idx];
      if (texture !== undefined && texture.get() != null) {
        this.profile.changeTexture(texture.get());
        gl.activeTexture(gl.TEXTURE0 + sampler);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
      }
    }
    textures.clear();
  }

  private updateUniforms(gl: WebGLRenderingContext) {
    if (isEmpty(this.changedUniformIdxs)) return;
    const uniformsIdxs = this.changedUniformIdxs;
    const len = uniformsIdxs.length();
    this.profile.uniformChanges += len;
    for (let u = 0; u < len; u++) {
      const idx = uniformsIdxs.get(u);
      const state = this.uniforms[idx];
      SHADER.setUniform(gl, this.selectedShader, this.uniformDefinitions[idx], state.get());
    }
    uniformsIdxs.clear();
  }

  start() {
    this.changeShader = true;
  }

  draw(gl: WebGLRenderingContext, buffer: Buffer, offset: number, size: number, mode: number = gl.TRIANGLES) {
    ++this.profile.drawsRequested;
    if (this.tryChain(gl, buffer, offset, size, mode)) {
      ++this.profile.drawsMerged;
      return;
    }
    this.rebindShader(gl);
    this.rebindVertexBuffers(gl);
    this.rebindIndexBuffer(gl);
    this.updateUniforms(gl);
    this.rebindTextures(gl);
  }

  run(gl: WebGLRenderingContext, call: DrawCall) {
    const values = call.values;
    const size = call.values.length;
    this.setShader(call.shader);
    for (let i = 0; i < size; i += 2) {
      const idx = values[i];
      const value = values[i + 1];
      this.states[idx].set(value);
    }
    this.draw(gl, call.buffer, call.offset, call.size, call.mode)
  }
}

export class DrawCall {
  constructor(
    readonly values: any[],
    readonly shader: string,
    readonly buffer: Buffer,
    readonly offset: number,
    readonly size: number,
    readonly mode: number,
    readonly hint: number,
    readonly kind: number,
  ) { }
}
