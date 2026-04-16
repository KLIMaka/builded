import { range } from "ts-utils/collections";
import { iter } from "ts-utils/iter";
import { applyNotNullishOr } from "ts-utils/objects";
import { loadString } from "../getter";
import { Definition, DisposableResource, GlContext, Shader, UniformBlockDefinition, UniformDefinition } from "./drawstruct";

export class ShaderImpl implements Shader {
  readonly name: string;
  private program: DisposableResource<WebGLProgram>;
  private definitions: Definitions;

  readonly uniforms: WebGLUniformLocation[] = [];
  readonly attribs: number[] = [];
  readonly uniformIndex = new Map<string, number>();
  readonly attributeIndex = new Map<string, number>();

  constructor(name: string, gl: WebGLRenderingContext, prog: DisposableResource<WebGLProgram>, defs: Definitions) {
    this.name = name;
    this.program = prog;
    this.definitions = defs;
    this.initUniformLocations(gl);
    this.initAttributeLocations(gl);
  }

  private initUniformLocations(gl: WebGLRenderingContext): void {
    for (let i = 0; i < this.definitions.uniforms.length; i++) {
      const uniform = this.definitions.uniforms[i];
      this.uniformIndex.set(uniform.name, i);
      this.uniforms[i] = gl.getUniformLocation(this.program.value, uniform.name);
    }
  }

  private initAttributeLocations(gl: WebGLRenderingContext): void {
    for (let i = 0; i < this.definitions.attributes.length; i++) {
      const attrib = this.definitions.attributes[i];
      this.attributeIndex.set(attrib.name, i);
      this.attribs[i] = gl.getAttribLocation(this.program.value, attrib.name);
    }
  }

  getUniformLocation(name: string): WebGLUniformLocation {
    return this.uniforms[this.uniformIndex.get(name)];
  }

  getAttributeLocation(name: string): number {
    return this.attribs[this.attributeIndex.get(name)];
  }

  getProgram(): WebGLProgram {
    return this.program.value;
  }

  getUniformBlocks(): UniformBlockDefinition[] {
    return this.definitions.uniformBlocks;
  }

  getUniforms(): UniformDefinition[] {
    return this.definitions.uniforms;
  }

  getAttributes(): Definition[] {
    return this.definitions.attributes;
  }

  getSamplers(): Definition[] {
    return this.definitions.samplers;
  }

  async dispose(): Promise<void> {
    this.program.dispose();
  }
}

function getBaseDir(name: string): string {
  const idx = name.lastIndexOf('/');
  if (idx === -1) return '';
  return name.substring(0, idx + 1);
}

export async function createShader({ gl, resource }: GlContext, name: string, defines: string[] = []): Promise<Shader> {
  const deftext = '#version 300 es\n' + defines.map(d => "#define " + d).join("\n") + "\n";
  const baseDir = getBaseDir(name);
  return Promise.all([loadString(name + '.vsh'), loadString(name + '.fsh')])
    .then(async ([vsh, fsh]) => {
      const [pvhs, pfsh] = await Promise.all([preprocess(vsh, baseDir), preprocess(fsh, baseDir)]);
      const program = compileProgram(gl, deftext + pvhs, deftext + pfsh);
      const programRes = resource('shader', program, p => gl.deleteProgram(p));
      const defs = processShaders(gl, program);
      return new ShaderImpl(name, gl, programRes, defs);
    })
}

function compileProgram(gl: WebGL2RenderingContext, vsh: string, fsh: string): WebGLProgram {
  const program = gl.createProgram();
  const vertexShader = compileSource(gl, gl.VERTEX_SHADER, vsh);
  const fragmentShader = compileSource(gl, gl.FRAGMENT_SHADER, fsh);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link error: ' + gl.getProgramInfoLog(program));
  return program;
}

function compileSource(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('compile error: ' + gl.getShaderInfoLog(shader));
  return shader;
}

export class Definitions {
  readonly uniforms: UniformDefinition[] = [];
  readonly attributes: Definition[] = [];
  readonly samplers: Definition[] = [];
  readonly uniformBlocks: UniformBlockDefinition[] = [];
}


function processShaders(gl: WebGL2RenderingContext, program: WebGLProgram): Definitions {
  const defs = new Definitions();
  const attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;
  for (let a = 0; a < attribs; a++) {
    const info = gl.getActiveAttrib(program, a);
    if (info.name === 'gl_VertexID') continue;
    defs.attributes.push(convertToDefinition(info));
  }
  const uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  const offsets = gl.getActiveUniforms(program, range(0, uniforms), gl.UNIFORM_OFFSET);
  for (let u = 0; u < uniforms; u++) {
    const info = gl.getActiveUniform(program, u);
    const def = convertToDefinition(info);
    defs.uniforms.push({ ...def, blockOffset: offsets[u] });
    if (def.type === 'sampler2D' || def.type === 'sampler2DArray' || def.type === 'usampler2D')
      defs.samplers.push(def);
  }
  const blocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS) as number;
  for (let b = 0; b < blocks; b++) {
    const name = gl.getActiveUniformBlockName(program, b);
    const blockIndex = b;
    const uniforms = iter(gl.getActiveUniformBlockParameter(program, b, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES) as Uint32Array).map(u => defs.uniforms[u]).collect();
    const size = gl.getActiveUniformBlockParameter(program, b, gl.UNIFORM_BLOCK_DATA_SIZE);
    defs.uniformBlocks.push({ name, blockIndex, uniforms, size });
  }

  return defs;
}

function convertToDefinition(info: WebGLActiveInfo): Definition {
  return { type: type2String(info.type), name: info.name };
}

function type2String(type: number): string {
  switch (type) {
    case WebGLRenderingContext.SAMPLER_2D: return "sampler2D";
    case WebGL2RenderingContext.SAMPLER_2D_ARRAY: return "sampler2DArray";
    case WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_2D: return "usampler2D";
    case WebGLRenderingContext.INT: return "int";
    case WebGL2RenderingContext.UNSIGNED_INT: return "uint";
    case WebGLRenderingContext.FLOAT: return "float";
    case WebGLRenderingContext.FLOAT_MAT4: return "mat4";
    case WebGLRenderingContext.FLOAT_MAT3: return "mat3";
    case WebGLRenderingContext.FLOAT_VEC2: return "vec2";
    case WebGLRenderingContext.FLOAT_VEC3: return "vec3";
    case WebGLRenderingContext.FLOAT_VEC4: return "vec4";
    case WebGLRenderingContext.INT_VEC2: return "ivec2";
    case WebGLRenderingContext.INT_VEC3: return "ivec3";
    case WebGLRenderingContext.INT_VEC4: return "ivec4";
    case WebGL2RenderingContext.UNSIGNED_INT_VEC2: return "uvec2";
    case WebGL2RenderingContext.UNSIGNED_INT_VEC3: return "uvec3";
    case WebGL2RenderingContext.UNSIGNED_INT_VEC4: return "uvec4";
    default: throw new Error('Invalid type: ' + type);
  }
}

async function preprocess(shader: string, baseDir: string): Promise<string> {
  const matchInclude = (l: string) => l.match(/^#include +"([^"]+)"/);
  const loadIncliude = (m: RegExpMatchArray) => loadString(baseDir + m[1]).then(s => preprocess(s, baseDir));
  const lines = shader.split("\n").map(l => applyNotNullishOr(matchInclude(l), loadIncliude, () => Promise.resolve(l)));
  return Promise.all(lines).then(lines => lines.join('\n'));
}

const setters = {
  mat4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniformMatrix4fv(loc, false, val),
  mat3: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniformMatrix3fv(loc, false, val),
  ivec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Int32List) => gl.uniform2iv(loc, val),
  vec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform2fv(loc, val),
  vec3: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform3fv(loc, val),
  vec4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform4fv(loc, val),
  int: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
  float: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1f(loc, val),
  sampler2D: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
}

export function setUniform(gl: WebGLRenderingContext, shader: Shader, uniform: Definition, value: any) {
  if (uniform === undefined) return;
  const loc = shader.getUniformLocation(uniform.name);
  const setter = setters[uniform.type];
  if (setter === undefined) throw new Error('Invalid type: ' + uniform.type);
  setter(gl, loc, value);
}
