import { MultiConsumer } from "@utils/types";
import { match } from "ts-pattern";
import { Shader } from "./drawstruct";

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

function getAttribScheme(gl: WebGL2RenderingContext, shader: Shader): AttribScheme {
  const defs: AttribDef[] = []
  let off = 0;
  for (const d of shader.getAttributes()) {
    const size = getSize(d.type);
    defs.push({
      name: d.name,
      size,
      off,
      location: shader.getAttributeLocation(d.name, gl)
    });
    off += size;
  }
  return { defs, size: off }
}

type float = [number];
type vec2 = [number, number];
type vec3 = [number, number, number];
type vec4 = [number, number, number, number];
type AttribType = float | vec2 | vec3 | vec4;

class AttribData {
  constructor(
    private scheme: AttribScheme,
    defaultSize = 1024,
    private record = new Float32Array(scheme.size),
    private data = new Float32Array(scheme.size * defaultSize),
    private off = 0
  ) { }

  floatWriter(name: string): MultiConsumer<float> { return this.writer(name, 1) }
  vec2Writer(name: string): MultiConsumer<vec2> { return this.writer(name, 2) }
  vec3Writer(name: string): MultiConsumer<vec3> { return this.writer(name, 3) }
  vec4Writer(name: string): MultiConsumer<vec4> { return this.writer(name, 4) }

  private writer<T extends AttribType>(name: string, size: number): MultiConsumer<T> {
    const def = this.scheme.defs.find(d => d.name === name);
    if (def === undefined) throw new Error(`Invalid attribute name '${name}'`);
    if (def.size !== size) throw new Error(`Invalid attribute size. Expected ${size} actual ${def.size}`);
    return (...data: number[]) => this.record.set([...data], def.off);
  }

  write(): number {
    this.ensureSize();
    const off = this.off;
    this.data.set(this.record, this.off * this.scheme.size);
    this.off++;
    return off;
  }

  private ensureSize() {
    if (this.off >= this.data.length) {
      const ndata = new Float32Array(this.data.length * 2);
      ndata.set(this.data);
      this.data = ndata;
    }
  }
}

export class ShaderCongif {
  constructor(gl: WebGL2RenderingContext,
    private shader: Shader,
    private scheme = getAttribScheme(gl, shader)
  ) { }

  private bindBuffer(gl: WebGL2RenderingContext, buff: WebGLBuffer) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buff);
    const stride = this.scheme.size * 4;
    for (const attr of this.scheme.defs) {
      gl.enableVertexAttribArray(attr.location);
      gl.vertexAttribPointer(attr.location, attr.size, gl.FLOAT, false, stride, attr.off);
    }
  }
}