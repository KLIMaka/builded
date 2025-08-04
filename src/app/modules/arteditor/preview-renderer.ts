import { WorkplaneContext } from "@ui/commons";
import { Disposable, Value, ValuesContainer } from "ts-utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { range } from "ts-utils/collections";
import { GlContext } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { AttribDataInstanced, BufferAllocator, StateGl1 } from "@utils/gl/stategl1";
import { iter } from "ts-utils/iter";
import { clamp, HALF_PI, PI, rad2deg } from "ts-utils/mathutils";
import { Stream } from "ts-utils/stream";
import { Consumer } from "ts-utils/types";
import { BoardContext } from "app/apis/engine";
import { mat4 } from "gl-matrix";
import { BoardGlContext, createBoardGlContext } from "../gl/board-context";
import { BuildGlEngineContext } from "../gl/buildgl";
import { EngineTextures } from "../gl/gl-context";
import { RenderInfo } from "./arteditor-model";

export async function createPreviewRenderer(values: ValuesContainer, glCtx: GlContext, ctx: BuildGlEngineContext): Promise<PreviewRenderer> {
  const state = new StateGl1(glCtx, s => new BufferAllocator(glCtx, s, 1024, 1024));
  const defs = ['PALSWAPS (' + (ctx.engine.maxPluId.get() + 1) + '.0)', 'SHADOWSTEPS (' + ctx.engine.shadowsteps.get() + '.0)'];
  state.register('sprite-instance', await createShader(glCtx, 'resources/shaders/sprite-instance', [...defs]));
  state.register('wall-instance', await createShader(glCtx, 'resources/shaders/wall-instance', [...defs]));
  const data = await ctx.engine.resources.get().read('test.map');
  const board = await ctx.engine.loadBoard(new Stream(data.get()));
  return new PreviewRenderer(values, ctx.glContext, ctx.textures(), state, ctx.engine.shadowsteps.get(), board);
}

export class PreviewRenderer implements Disposable {
  private ctl: Controller3D;
  private walls: Consumer<void>;
  private sprite: Consumer<void>;
  private infoValue: Value<RenderInfo>;
  private pluValue: Value<number>;
  private boardContext: BoardGlContext;

  constructor(
    private values: ValuesContainer,
    private glCtx: GlContext,
    private textures: EngineTextures,
    private stateGl: StateGl1,
    private maxShadow: number,
    private board: BoardContext
  ) {
    this.ctl = new Controller3D(values);
    this.infoValue = values.value('info', null);
    this.pluValue = values.value('plu', 0);
    this.walls = this.buildWalls(this.textures.get(0).get(), this.textures.get(10).get(), this.textures.get(540).get());
    this.boardContext = this.buildBoard();

    const spriteShader = this.stateGl.getShader('sprite-instance');
    const wallShader = this.stateGl.getShader('wall-instance');
    const matrices = wallShader.uniformBlock('Matrices');
    const P = matrices.writer<[mat4]>('P');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');
    const palSet = wallShader.texture('pal');
    const palSet1 = spriteShader.texture('pal');
    const palSet2 = wallShader.texture('pal');
    const pluSet = wallShader.texture('plu');
    const pluSet1 = spriteShader.texture('plu');
    const pluSet2 = wallShader.texture('plu');
    const atlasSet1 = wallShader.texture('atlas');
    const infosSet1 = wallShader.texture('infos');
    const atlasSet2 = spriteShader.texture('atlas');
    const infosSet2 = spriteShader.texture('infos');

    wallShader.texture('walls')(this.boardContext.walls);
    wallShader.texture('sectors')(this.boardContext.sectors);

    this.values.handleStandalone([this.ctl.projection], proj => P(proj));
    this.values.handleStandalone([this.ctl.camera.transform], view => { V(view); IV(mat4.invert(mat4.create(), view)) });
    this.values.handleStandalone([this.textures.pal], pal => { palSet(pal.get()); palSet1(pal.get()); palSet2(pal.get()) });
    this.values.handleStandalone([this.textures.plu], plu => { pluSet(plu.get()); pluSet1(plu.get()); pluSet2(plu.get()) });
    this.values.handleStandalone([this.textures.atlas], atlas => { atlasSet1(atlas); atlasSet2(atlas) });
    this.values.handleStandalone([this.textures.infos], infos => { infosSet1(infos); infosSet2(infos) });

  }

  private buildBoard(): BoardGlContext {
    const ctx = createBoardGlContext(this.glCtx);
    const board = this.board.board;
    const { x, y, z } = board.sprites[0];
    board.walls.forEach(w => {
      w.x -= x;
      w.y -= y;
    });
    board.sprites.forEach(s => {
      s.x -= x;
      s.y -= y;
      s.z -= z;
    });
    board.sectors.forEach(s => {
      s.ceilingz -= z;
      s.floorz -= z;
    });

    board.sectors.forEach((s, i) => ctx.writeSector(i, s));
    board.sprites.forEach((s, i) => ctx.writeSprite(i, s));
    board.walls.forEach((w, i) => ctx.writeWall(i, w));
    return ctx;
  }

  private buildSprite(p: number): AttribDataInstanced {
    const shader = this.stateGl.getShader('sprite-instance');
    const builder = shader.builder();
    const pos = builder.vec3('aPos_i32');
    const picnumAngCstat = builder.vec4('aPicnumAngCstat_u16');
    const params = builder.vec4('aPluShadowVisTrans_i8');

    builder.start();
    params(0, 0, 255, 0);
    pos(0, 0, 0);
    picnumAngCstat(p, 256, 0, 0)
    builder.writeVertex();

    params(2, 0, 255, 0);
    pos(64, 64, 0);
    picnumAngCstat(p, 256, 1 << 4, 0)
    builder.writeVertex();
    return builder.build(WebGL2RenderingContext.TRIANGLES);
  }

  private buildWalls(t1: number, t2: number, t3: number) {
    const shader = this.stateGl.getShader('wall-instance');
    const builder = shader.builder();
    const wallSectorPart = builder.vec4('aWallSectorPart_u16')
    const board = this.board.board;

    builder.start();
    board.sectors.forEach((sec, s) => iter(range(sec.wallptr, sec.wallptr + sec.wallnum)).forEach(w => {
      const wall = board.walls[w];
      this.textures.get(wall.picnum).get();
      this.textures.get(wall.overpicnum).get();
      if (wall.nextsector === -1) {
        wallSectorPart(w, s, 0, 0);
        builder.writeVertex();
      } else {
        wallSectorPart(w, s, 1, 0);
        builder.writeVertex();
        wallSectorPart(w, s, 2, 0);
        builder.writeVertex();
        if (wall.cstat.masking || wall.cstat.oneWay) {
          wallSectorPart(w, s, 3, 0);
          builder.writeVertex();
        }
      }
    }))
    const data = builder.build(WebGL2RenderingContext.TRIANGLES);

    return () => {
      this.stateGl.draw(shader, data);
    }

    // const shader = this.stateGl.getShader('wall-instance');
    // const spriteShader = this.stateGl.getShader('sprite-instance');
    // const builder = shader.builder();
    // const startEnd = builder.vec4('aStartEnd_i16');
    // const firstWall = builder.vec4('aFirstWall_i16');
    // const heinumZ = builder.vec4('aHeinumZ_i16');
    // const params = builder.vec4('aPluShadowVisTrans_i8');
    // const picnum = builder.float('aPicnum_u16');

    // builder.start();
    // firstWall(0, 0, 0, 1);
    // heinumZ(0, 128, 0, 0);
    // params(0, 0, 255, 0);
    // picnum(t1);

    // startEnd(128, -128, -128, -128);
    // builder.writeVertex();
    // startEnd(-128, -128, -128, 128);
    // builder.writeVertex();
    // startEnd(-128, 128, 128, 128);
    // builder.writeVertex();
    // startEnd(128, 128, 128, -128);
    // builder.writeVertex();

    // heinumZ(0, 256, 0, 0);
    // params(0, 0, 255, 0);
    // picnum(t2);

    // startEnd(-32, -32, 32, -32);
    // builder.writeVertex();
    // startEnd(32, -32, 32, 32);
    // builder.writeVertex();
    // startEnd(32, 32, -32, 32);
    // builder.writeVertex();
    // startEnd(-32, 32, -32, -32);
    // builder.writeVertex();
    // const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLES);
    // const spriteData = this.buildSprite(t3)

    // return () => {
    //   this.stateGl.drawInstanced(shader, data);
    //   this.stateGl.drawInstanced(spriteShader, spriteData);
    // }
  }


  draw(canvas: HTMLCanvasElement, ctx: Pick<WorkplaneContext, 'scale' | 'xoff1' | 'yoff1' | 'xoff2' | 'yoff2'>, ri: RenderInfo, plu: number, superSample: number, repeat: boolean) {
    const { info, picnum } = ri;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hw = w / 2;
    const hh = h / 2;
    const scale = 1 / ctx.scale;
    const xoff = -(hw - ctx.xoff1) * scale;
    const yoff = (hh - ctx.yoff1) * scale;

    const r = scale * 400;
    const phi = PI + ctx.xoff2 * 0.01;
    const theta = clamp(ctx.yoff2 / 200, -1, 1) * HALF_PI;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(theta);
    const z = r * Math.cos(phi) * Math.cos(theta);

    this.ctl.setSize(w, h);
    this.ctl.setPosition(-x, y, z);
    this.ctl.camera.setAngles(-rad2deg(theta), -rad2deg(phi));

    const { gl, offscreen } = this.glCtx;
    offscreen.width = w;
    offscreen.height = h;
    gl.viewport(0, 0, w, h);

    gl.clearColor(0, 0, 0, 1.0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // this.grid();
    this.pluValue.set(plu);
    this.infoValue.set(ri);
    // this.base();
    // this.item(gl, this.textures.get(picnum).get());
    // this.item1(gl, this.textures.get(picnum).get());
    this.walls();

    canvas.getContext('bitmaprenderer')
      .transferFromImageBitmap(offscreen.transferToImageBitmap());
  }

  async dispose(): Promise<void> {
    this.stateGl.dispose();
    this.boardContext.dispose();
  }
}