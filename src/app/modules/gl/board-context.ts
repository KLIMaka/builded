import { Disposable, Source, ValuesContainer } from "ts-utils/callbacks";
import { GlContext } from "@utils/gl/drawstruct";
import { int, memoize } from "ts-utils/mathutils";
import { applyNotNullish } from "ts-utils/objects";
import { Stream } from "ts-utils/stream";
import { BoardContext } from "app/apis/engine";
import { Sector, Sprite, Wall } from "build/board/structs";
import { sectorStruct, spriteStruct, wallStruct } from "build/maploader";
import { point2d, triangulate } from "./geometry/builders/sector";
import { Function } from "ts-utils/types";


export type BoardGlContext = Readonly<{
  walls: WebGLTexture;
  sprites: WebGLTexture;
  sectors: WebGLTexture;
  sectorPoints: Source<Function<number, point2d[]>>
}> & Disposable;

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

export function createBoardGlContext(values: ValuesContainer, glCtx: GlContext, boardCtx: BoardContext): BoardGlContext {
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

  const onSectorsDisconnector = boardCtx.onSectorsChange((b, s) => s.forEach(s => applyNotNullish(b.board.sectors[s], sec => writeSector(s, sec))));
  const onWallsDisconnector = boardCtx.onWallsChange((b, w) => w.forEach(w => applyNotNullish(b.board.walls[w], wall => writeWall(w, wall))));
  const onSpritesDisconnector = boardCtx.onSpritesChange((b, s) => s.forEach(s => applyNotNullish(b.board.sprites[s], spr => writeSprite(s, spr))));
  const board = boardCtx.data.get().board;
  board.sectors.forEach((s, i) => writeSector(i, s));
  board.sprites.forEach((s, i) => writeSprite(i, s));
  board.walls.forEach((w, i) => writeWall(i, w));

  const sectorPoints = values.transformed('sector-points', boardCtx.data, data => memoize((s: number) => triangulate(data.board, s)));

  const dispose = async () => {
    walls.dispose();
    sprites.dispose();
    sectors.dispose();
    onSectorsDisconnector();
    onWallsDisconnector();
    onSpritesDisconnector();
  };

  return { walls: walls.value, sprites: sprites.value, sectors: sectors.value, sectorPoints, dispose };
}