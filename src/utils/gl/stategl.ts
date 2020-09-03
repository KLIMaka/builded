import * as GLM from '../../libs_js/glmatrix';
import { Deck, isEmpty } from '../collections';
import { Buffer } from './buffergl';
import { Definition, IndexBuffer, Shader, Texture, VertexBuffer } from './drawstruct';
import * as SHADER from './shaders';
import { StateValueMatrix, StateValueGeneric, StateValue } from './statevalue';

function createStateValue(type: string, changecb: () => void): StateValue<any> {
  switch (type) {
    case "mat4":
    case "vec3":
    case "vec4":
      return new StateValueMatrix<GLM.Mat4Array>(changecb, GLM[type].create(), GLM[type].exactEquals, GLM[type].copy)
    default:
      return new StateValueGeneric<number>(changecb, 0);
  }
}

export class Profile {
  public drawsRequested = 0;
  public drawsMerged = 0;
  public shaderChanges = 0;
  public uniformChanges = 0;
  public textureChanges = 0;
  public bufferChanges = 0;
  public shaderSwaps: { [index: string]: number } = {}
  public uniqTextures = new Set<Texture>();

  public changeShader(from: string, to: string) {
    const key = `${from}->${to}`;
    const swap = this.shaderSwaps[key];
    this.shaderSwaps[key] = !swap ? 1 : swap + 1;
  }

  public changeTexture(tex: Texture) {
    this.uniqTextures.add(tex);
  }

  public reset() {
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
  ) { }
}

export class State {
  readonly profile = new Profile();

  private batchUniform = -1;
  private lastBuffer: Buffer;

  private shader: StateValue<string> = new StateValueGeneric<string>(() => this.changeShader = true, null);
  private lastShader: string;
  private selectedShader: Shader;
  private indexBuffer: StateValue<IndexBuffer> = new StateValueGeneric<IndexBuffer>(() => this.changeIndexBuffer = true, null);
  private shaders: { [index: string]: ShaderConfig } = {};

  private states: StateValue<any>[] = [];
  private stateIndex: { [index: string]: number } = {};

  private vertexBuffers: StateValue<VertexBuffer>[] = [];
  private vertexBufferNames: string[] = [];
  private vertexBufferIndex: { [index: string]: number } = {};

  private uniforms: StateValue<any>[] = [];
  private uniformsDefinitions: Definition[] = [];
  private uniformsIndex: { [index: string]: number } = {};

  private textures: StateValue<Texture>[] = [];
  private texturesIndex: { [index: string]: number } = {};

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
    if (this.batchUniform == -1) {
      this.batchUniform = this.getState('sys');
    }
    const value = [...<GLM.Vec4Array>this.states[this.batchUniform].get()];
    value[3] = nextBatch(value[3])
    this.states[this.batchUniform].set(value);
  }

  public flush(gl: WebGLRenderingContext, buffer: Buffer = this.lastBuffer) {
    if (this.chainMode == -1) return;
    if (buffer) buffer.update(gl);
    gl.drawElements(this.chainMode, this.chainSize, gl.UNSIGNED_SHORT, this.chainOffset * 2);
    // this.nextBatch();
    this.chainMode = -1;
    this.lastBuffer = null;
  }

  private tryChain(gl: WebGLRenderingContext, buffer: Buffer, offset: number, size: number, mode: number): boolean {
    if (this.chainMode == -1) {
      this.chainMode = mode;
      this.chainOffset = offset;
      this.chainSize = size;
      this.lastBuffer = buffer;
      return false;
    } else if (this.sameState(mode)) {
      if (this.chainOffset == offset + size) {
        this.chainOffset = offset;
        this.chainSize += size;
        return true;
      } else if (this.chainOffset + this.chainSize == offset) {
        this.chainSize += size;
        return true;
      }
    }
    this.flush(gl);
    return this.tryChain(gl, buffer, offset, size, mode);
  }

  private sameState(mode: number) {
    return this.chainMode == mode
      && !this.changeShader
      && !this.changeIndexBuffer
      && isEmpty(this.changedUniformIdxs)
      && isEmpty(this.changedTextures)
      && isEmpty(this.changedVertexBuffersIds);
  }

  public registerShader(name: string, shader: Shader) {
    const uniforms: number[] = [];
    for (const uniform of shader.getUniforms()) {
      const existedId = this.uniformsIndex[uniform.name];
      if (existedId != undefined) {
        uniforms.push(existedId);
        continue;
      }
      const idx = this.uniforms.length;
      const state = createStateValue(uniform.type, () => this.changedUniformIdxs.push(idx));
      if (uniform.type != 'sampler2D') this.registerState(uniform.name, state);
      this.uniforms.push(state);
      this.uniformsDefinitions.push(uniform);
      this.uniformsIndex[uniform.name] = idx;
      uniforms.push(idx);
    }
    const samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      if (this.texturesIndex[sampler.name] != undefined) continue;
      const idx = this.textures.length;
      const state = new StateValueGeneric<Texture>(() => this.changedTextures.push([idx, s]), null);
      this.registerState(sampler.name, state);
      this.textures.push(state);
      this.texturesIndex[sampler.name] = idx;
    }
    const attribs: number[] = [];
    for (const attrib of shader.getAttributes()) {
      const existedId = this.vertexBufferIndex[attrib.name];
      if (existedId != undefined) {
        attribs.push(existedId);
        continue;
      }
      const idx = this.vertexBuffers.length;
      const state = new StateValueGeneric<VertexBuffer>(() => this.changedVertexBuffersIds.push(idx), null);
      this.registerState(attrib.name, state);
      this.vertexBufferNames[idx] = attrib.name;
      this.vertexBuffers.push(state);
      this.vertexBufferIndex[attrib.name] = idx;
      attribs.push(idx);
    }
    this.shaders[name] = new ShaderConfig(shader, uniforms, attribs);
  }

  private registerState(name: string, state: StateValue<any>) {
    if (this.stateIndex[name] != undefined)
      throw new Error(`Duplicate state name ${name}`);
    const idx = this.states.length;
    this.states.push(state);
    this.stateIndex[name] = idx;
  }

  public getState(name: string) {
    const idx = this.stateIndex[name];
    if (idx == undefined) throw new Error(`Invalid state name ${name}`);
    return idx;
  }

  public setUniform(name: string, value: any) {
    this.getUniformValue(name).set(value);
  }

  public getUniformValue(name: string): StateValue<any> {
    const u = this.uniformsIndex[name];
    if (u == undefined) throw new Error('Invalid uniform name: ' + name);
    return this.uniforms[u];
  }

  public isUniformEnabled(name: string): boolean {
    return this.uniformsIndex[name] != undefined;
  }

  public setShader(name: string) {
    const s = this.shaders[name];
    if (s == undefined) throw new Error('Unknown shader: ' + name);
    this.shader.set(name);
  }

  public setTexture(name: string, tex: Texture) {
    this.getTextureValue(name).set(tex);
  }

  public getTextureValue(name: string): StateValue<Texture> {
    const t = this.texturesIndex[name];
    if (t == undefined) throw new Error('Invalid sampler name: ' + name);
    return this.textures[t];
  }

  public setIndexBuffer(b: IndexBuffer) {
    this.indexBuffer.set(b);
  }

  public setVertexBuffer(name: string, b: VertexBuffer) {
    this.getVertexBufferValue(name).set(b);
  }

  public getVertexBufferValue(name: string): StateValue<VertexBuffer> {
    const a = this.vertexBufferIndex[name];
    if (a == undefined) throw new Error(`Invalid attribute name ${name}`);
    return this.vertexBuffers[a];
  }

  private rebindShader(gl: WebGLRenderingContext) {
    if (!this.changeShader) return;
    ++this.profile.shaderChanges;
    const newShader = this.shader.get();
    this.profile.changeShader(this.lastShader, newShader);
    this.lastShader = newShader;
    const shaderConfig = this.shaders[newShader];
    const shader = shaderConfig.shader;
    this.selectedShader = shader;
    gl.useProgram(shader.getProgram());

    const samplers = shader.getSamplers();
    this.changedTextures.clear();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      this.changedTextures.push([this.texturesIndex[sampler.name], s]);
      this.setUniform(sampler.name, s);
    }

    this.changedUniformIdxs.clear().pushAll(shaderConfig.uniforms);
    this.changedVertexBuffersIds.clear().pushAll(shaderConfig.attribs);
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
      const buf = this.vertexBuffers[idx];
      const vbuf = buf.get();
      const location = shader.getAttributeLocation(this.vertexBufferNames[idx], gl);
      if (location == -1)
        continue;
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
      if (texture != undefined && texture.get() != null) {
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
      SHADER.setUniform(gl, this.selectedShader, this.uniformsDefinitions[idx], state.get());
    }
    uniformsIdxs.clear();
  }

  public draw(gl: WebGLRenderingContext, buffer: Buffer, offset: number, size: number, mode: number = gl.TRIANGLES) {
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

  public run(gl: WebGLRenderingContext, call: DrawCall) {
    const values = call.values;
    const size = call.values.length;
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
    readonly buffer: Buffer,
    readonly offset: number,
    readonly size: number,
    readonly mode: number
  ) { }
}
