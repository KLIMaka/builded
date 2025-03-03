import { Disposable } from "@utils/callbacks";
import { GlContext } from "@utils/gl/drawstruct";
import { int } from "@utils/mathutils";
import { Stream } from "@utils/stream";
import { Sector, Sprite, Wall } from "build/board/structs";
import { sectorStruct, spriteStruct, wallStruct } from "build/maploader";


export type BoardGlContext = {
  readonly walls: WebGLTexture;
  readonly sprites: WebGLTexture;
  readonly sectors: WebGLTexture;

  writeWall(id: number, wall: Wall): void;
  writeSprite(id: number, sprite: Sprite): void;
  writeSector(id: number, sector: Sector): void;
} & Disposable;

function createTexture(gl: WebGL2RenderingContext, tex: WebGLTexture) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32UI, 256, 256);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function writeData(gl: WebGL2RenderingContext, tex: WebGLTexture, data: Uint32Array, id: number) {
  const size = data.length / 4;
  const x = (id * size) % 256;
  const y = int((id * size) / 256);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, size, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, data);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

export function createBoardGlContext(glCtx: GlContext): BoardGlContext {
  const { gl, resource } = glCtx;
  const disposer = (t: WebGLTexture): void => gl.deleteTexture(t);
  const walls = resource('texture', gl.createTexture(), disposer);
  const sprites = resource('texture', gl.createTexture(), disposer);
  const sectors = resource('texture', gl.createTexture(), disposer);
  createTexture(gl, walls.value);
  createTexture(gl, sprites.value);
  createTexture(gl, sectors.value);

  function writeWall(id: number, wall: Wall) {
    const buffer = new ArrayBuffer(wallStruct.size);
    const stream = new Stream(buffer);
    wallStruct.write(stream, wall);
    const data = new Uint32Array(buffer, 0, 8);
    writeData(gl, walls.value, data, id);
  }

  function writeSprite(id: number, sprite: Sprite) {
    const buffer = new ArrayBuffer(spriteStruct.size);
    const stream = new Stream(buffer);
    spriteStruct.write(stream, sprite);
    const data = new Uint32Array(buffer, 0, 8);
    writeData(gl, sprites.value, data, id);
  }

  function writeSector(id: number, sector: Sector) {
    const buffer = new ArrayBuffer(64);
    const stream = new Stream(buffer);
    sectorStruct.write(stream, sector);
    const data = new Uint32Array(buffer, 0, 16);
    writeData(gl, sectors.value, data, id);
  }

  const dispose = async () => { walls.dispose(); sprites.dispose(); sectors.dispose(); };
  return { walls: walls.value, sprites: sprites.value, sectors: sectors.value, writeWall, writeSprite, writeSector, dispose };
}