import { Definition, Shader } from "./drawstruct";
import { preloadString } from "../libs/getter";

export class ShaderImpl implements Shader {
  private program: WebGLProgram;
  private definitions: Definitions;

  readonly uniforms: WebGLUniformLocation[] = [];
  readonly attribs: number[] = [];
  readonly uniformIndex: { [index: string]: number } = {};
  readonly attributeIndex: { [index: string]: number } = {};

  public constructor(gl: WebGLRenderingContext, prog: WebGLProgram, defs: Definitions) {
    this.program = prog;
    this.definitions = defs;
    this.initUniformLocations(gl);
    this.initAttributeLocations(gl);
  }

  private initUniformLocations(gl: WebGLRenderingContext): void {
    for (let i = 0; i < this.definitions.uniforms.length; i++) {
      let uniform = this.definitions.uniforms[i];
      this.uniformIndex[uniform.name] = i;
      this.uniforms[i] = gl.getUniformLocation(this.program, uniform.name);
    }
  }

  private initAttributeLocations(gl: WebGLRenderingContext): void {
    for (let i = 0; i < this.definitions.attributes.length; i++) {
      let attrib = this.definitions.attributes[i];
      this.attributeIndex[attrib.name] = i;
      this.attribs[i] = gl.getAttribLocation(this.program, attrib.name);
    }
  }

  public getUniformLocation(name: string, gl: WebGLRenderingContext): WebGLUniformLocation {
    return this.uniforms[this.uniformIndex[name]];
  }

  public getAttributeLocation(name: string, gl: WebGLRenderingContext): number {
    return this.attribs[this.attributeIndex[name]];
  }

  public getProgram(): WebGLProgram {
    return this.program;
  }

  public getUniforms(): Definition[] {
    return this.definitions.uniforms;
  }

  public getAttributes(): Definition[] {
    return this.definitions.attributes;
  }

  public getSamplers(): Definition[] {
    return this.definitions.samplers;
  }
}

export function createShader(gl: WebGLRenderingContext, name: string, defines: string[] = []): Promise<Shader> {
  return new Promise(resolve => {
    const deftext = prepareDefines(defines);
    Promise.all([preloadString(name + '.vsh'), preloadString(name + '.fsh')]).then(([vsh, fsh]) => {
      Promise.all([preprocess(vsh), preprocess(fsh)]).then(([pvhs, pfsh]) => {
        let program = compileProgram(gl, deftext + pvhs, deftext + pfsh);
        let defs = processShaders(gl, program);
        resolve(new ShaderImpl(gl, program, defs))
      })
    })
  });
}

function prepareDefines(defines: string[]): string {
  let result = '';
  for (let i = 0; i < defines.length; i++) {
    result += "#define " + defines[i] + "\n";
  }
  return result;
}

function compileProgram(gl: WebGLRenderingContext, vsh: string, fsh: string): WebGLProgram {
  let program = gl.createProgram();
  gl.attachShader(program, compileSource(gl, gl.VERTEX_SHADER, vsh));
  gl.attachShader(program, compileSource(gl, gl.FRAGMENT_SHADER, fsh));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('link error: ' + gl.getProgramInfoLog(program));
  }
  return program;
}

function compileSource(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('compile error: ' + gl.getShaderInfoLog(shader) + '\nin source:\n' + source);
  }
  return shader;
}

export class DefinitionImpl implements Definition {
  constructor(
    readonly type: string,
    readonly name: string
  ) { }
}

export class Definitions {
  public uniforms: Definition[] = [];
  public attributes: Definition[] = [];
  public samplers: Definition[] = [];
}


function processShaders(gl: WebGLRenderingContext, program: WebGLProgram): any {
  let defs = new Definitions();
  let attribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let a = 0; a < attribs; a++) {
    let info = gl.getActiveAttrib(program, a);
    defs.attributes.push(convertToDefinition(info));
  }
  let uniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let u = 0; u < uniforms; u++) {
    let info = gl.getActiveUniform(program, u);
    let def = convertToDefinition(info);
    defs.uniforms.push(def);
    if (def.type == 'sampler2D')
      defs.samplers.push(def);
  }
  return defs;
}

function convertToDefinition(info: WebGLActiveInfo): DefinitionImpl {
  return new DefinitionImpl(type2String(info.type), info.name);
}

function type2String(type: number): string {
  switch (type) {
    case WebGLRenderingContext.SAMPLER_2D: return "sampler2D";
    case WebGLRenderingContext.INT: return "int";
    case WebGLRenderingContext.FLOAT: return "float";
    case WebGLRenderingContext.FLOAT_MAT4: return "mat4";
    case WebGLRenderingContext.FLOAT_MAT3: return "mat3";
    case WebGLRenderingContext.FLOAT_VEC2: return "vec2";
    case WebGLRenderingContext.FLOAT_VEC3: return "vec3";
    case WebGLRenderingContext.FLOAT_VEC4: return "vec4";
    case WebGLRenderingContext.INT_VEC2: return "ivec2";
    case WebGLRenderingContext.INT_VEC3: return "ivec3";
    case WebGLRenderingContext.INT_VEC4: return "ivec4";
    default: throw new Error('Invalid type: ' + type);
  }
}

function preprocess(shader: string): Promise<string> {
  return new Promise(resolve => {
    const lines = shader.split("\n");
    const includes: Promise<string>[] = [];
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      const m = l.match(/^#include +"([^"]+)"/);
      includes.push(m != null ? preloadString(m[1]) : Promise.resolve(l));
    }
    Promise.all(includes).then(lines => resolve(lines.join('\n')));
  })
}

const setters = {
  mat4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniformMatrix4fv(loc, false, val),
  ivec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Int32List) => gl.uniform2iv(loc, val),
  vec2: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform2fv(loc, val),
  vec3: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform3fv(loc, val),
  vec4: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: Float32List) => gl.uniform4fv(loc, val),
  int: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
  float: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1f(loc, val),
  sampler2D: (gl: WebGLRenderingContext, loc: WebGLUniformLocation, val: number) => gl.uniform1i(loc, val),
}

export function setUniform(gl: WebGLRenderingContext, shader: Shader, uniform: Definition, value: any) {
  if (uniform == undefined) return;
  const loc = shader.getUniformLocation(uniform.name, gl);
  const setter = setters[uniform.type];
  if (setter == undefined) throw new Error('Invalid type: ' + uniform.type);
  setter(gl, loc, value);
}
