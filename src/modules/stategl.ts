import * as GLM from '../libs_js/glmatrix';
import { Buffer } from './buffergl';
import { Deck, Collection } from './collections';
import { Definition, IndexBuffer, Shader, Texture, VertexBuffer } from './drawstruct';
import * as SHADER from './shaders';

function eqCmp<T>(lh: T, rh: T) { return lh === rh }
function assign<T>(dst: T, src: T) { return src }

export class StateValue<T> {
  constructor(
    private changecb: () => void,
    public value: T,
    public cmp: (lh: T, rh: T) => boolean = eqCmp,
    public setter: (dst: T, src: T) => T = assign
  ) { }
  get(): T { return this.value; }
  set(v: T) {
    if (!this.cmp(v, this.value)) {
      this.value = this.setter(this.value, v);
      this.changecb()
    }
  }
}

function createStateValue(type: string, changecb: () => void): StateValue<any> {
  switch (type) {
    case "mat4":
    case "vec3":
    case "vec4":
      return new StateValue<GLM.Mat4Array>(changecb, GLM[type].create(), GLM[type].exactEquals, GLM[type].copy)
    default:
      return new StateValue<number>(changecb, 0);
  }
}

export class State {
  private shader: StateValue<string> = new StateValue<string>(() => this.changeShader = true, null);
  private selectedShader: Shader;
  private indexBuffer: StateValue<IndexBuffer> = new StateValue<IndexBuffer>(() => this.changeIndexBuffer = true, null);
  private buffer: Buffer;
  private offset: number;
  private size: number;
  private shaders: { [index: string]: Shader } = {};

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

  private batchOffset = -1;
  private batchSize = -1;
  private batchMode = -1;

  constructor() {
    this.registerState('shader', this.shader);
    this.registerState('aIndex', this.indexBuffer);
  }

  public flush(gl: WebGLRenderingContext) {
    if (this.batchMode == -1) return;
    this.buffer.update(gl);
    gl.drawElements(this.batchMode, this.batchSize, gl.UNSIGNED_SHORT, this.batchOffset * 2);
    this.batchMode = -1;
  }

  private tryBatch(gl: WebGLRenderingContext, mode: number): boolean {
    if (this.batchMode == -1) {
      this.batchMode = mode;
      this.batchOffset = this.offset;
      this.batchSize = this.size;
      return false;
    } else if (this.batchMode == mode
      && !this.changeShader
      && !this.changeIndexBuffer
      && this.changedUniformIdxs.isEmpty()
      && this.changedTextures.isEmpty()
      && this.changedVertexBuffersIds.isEmpty()) {
      const offset = this.offset;
      const size = this.size;
      if (this.batchOffset == offset + size) {
        this.batchOffset = offset;
        this.batchSize += size;
        return true;
      } else if (this.batchOffset + this.batchSize == offset) {
        this.batchSize += size;
        return true;
      }
    }
    this.flush(gl);
    return this.tryBatch(gl, mode);
  }

  public registerShader(name: string, shader: Shader) {
    this.shaders[name] = shader;
    const uniforms = shader.getUniforms();
    for (let u = 0; u < uniforms.length; u++) {
      const uniform = uniforms[u];
      if (this.uniformsIndex[uniform.name] != undefined) continue;
      const idx = this.uniforms.length;
      const state = createStateValue(uniform.type, () => this.changedUniformIdxs.push(idx));
      if (uniform.type != 'sampler2D') this.registerState(uniform.name, state);
      this.uniforms.push(state);
      this.uniformsDefinitions.push(uniform);
      this.uniformsIndex[uniform.name] = idx;
    }
    const samplers = shader.getSamplers();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      if (this.texturesIndex[sampler.name] != undefined) continue;
      const idx = this.textures.length;
      const state = new StateValue<Texture>(() => this.changedTextures.push([idx, s]), null);
      this.registerState(sampler.name, state);
      this.textures.push(state);
      this.texturesIndex[sampler.name] = idx;
    }
    const attribs = shader.getAttributes();
    for (let a = 0; a < attribs.length; a++) {
      const attrib = attribs[a];
      if (this.vertexBufferIndex[attrib.name] != undefined) continue;
      const idx = this.vertexBuffers.length;
      const state = new StateValue<VertexBuffer>(() => this.changedVertexBuffersIds.push(idx), null);
      this.registerState(attrib.name, state);
      this.vertexBufferIndex[attrib.name] = idx;
      this.vertexBufferNames[idx] = attrib.name;
      this.vertexBuffers.push(state);
    }
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

  public setDrawElements(buffer: Buffer, offset: number, size: number) {
    this.buffer = buffer;
    this.offset = offset;
    this.size = size;
  }

  private rebindShader(gl: WebGLRenderingContext) {
    if (!this.changeShader) return;
    const shader = this.shaders[this.shader.get()];
    this.selectedShader = shader;
    gl.useProgram(shader.getProgram());

    const samplers = shader.getSamplers();
    this.changedTextures.clear();
    for (let s = 0; s < samplers.length; s++) {
      const sampler = samplers[s];
      this.changedTextures.push([this.texturesIndex[sampler.name], s]);
      this.setUniform(sampler.name, s);
    }

    this.changedUniformIdxs.clear();
    const uniforms = shader.getUniforms();
    for (let u = 0; u < uniforms.length; u++) {
      const uniform = uniforms[u];
      this.changedUniformIdxs.push(this.uniformsIndex[uniform.name]);
    }

    this.changedVertexBuffersIds.clear();
    const attribs = shader.getAttributes();
    for (let a = 0; a < attribs.length; a++) {
      const attrib = attribs[a];
      this.changedVertexBuffersIds.push(this.vertexBufferIndex[attrib.name]);
    }
    this.changeShader = false;
    this.changeIndexBuffer = true;
  }

  private rebindVertexBuffers(gl: WebGLRenderingContext) {
    if (this.changedVertexBuffersIds.isEmpty()) return;
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
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer.get().getBuffer());
    this.changeIndexBuffer = false;
  }

  private rebindTextures(gl: WebGLRenderingContext) {
    if (this.changedTextures.isEmpty()) return;
    const textures = this.changedTextures;
    const len = textures.length();
    for (let t = 0; t < len; t++) {
      const [idx, sampler] = textures.get(t);
      const texture = this.textures[idx];
      if (texture != undefined && texture.get() != null) {
        gl.activeTexture(gl.TEXTURE0 + sampler);
        gl.bindTexture(gl.TEXTURE_2D, texture.get().get());
      }
    }
    textures.clear();
  }

  private updateUniforms(gl: WebGLRenderingContext) {
    if (this.changedUniformIdxs.isEmpty()) return;
    const uniformsIdxs = this.changedUniformIdxs;
    const len = uniformsIdxs.length();
    for (let u = 0; u < len; u++) {
      const idx = uniformsIdxs.get(u);
      const state = this.uniforms[idx];
      SHADER.setUniform(gl, this.selectedShader, this.uniformsDefinitions[idx], state.get());
    }
    uniformsIdxs.clear();
  }

  public draw(gl: WebGLRenderingContext, mode: number = gl.TRIANGLES): boolean {
    if (this.tryBatch(gl, mode)) return true;
    this.rebindShader(gl);
    this.rebindVertexBuffers(gl);
    this.rebindIndexBuffer(gl);
    this.updateUniforms(gl);
    this.rebindTextures(gl);
    return false;
  }

  public setup(values: Collection<any>) {
    for (let i = 0; i < values.length(); i += 2) {
      const idx = values.get(i);
      const value = values.get(i + 1);
      this.states[idx].set(value);
    }
  }
}