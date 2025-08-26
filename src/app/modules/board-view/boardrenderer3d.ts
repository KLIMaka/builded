import { Disposable, Source, ValuesContainer } from "ts-utils/callbacks";
import { iterIsEmpty } from "ts-utils/collections";
import { GlContext } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { AttribDataBuilder, BufferAllocator, ShaderConfig, StateGl1, TextureSetter, vec4 } from "@utils/gl/stategl1";
import { iter } from "ts-utils/iter";
import { field } from "ts-utils/objects"
import { BiFunction, Consumer, first, Function, MultiConsumer, pair, second } from "ts-utils/types";
import { NOOP_TASK_HANDLE } from "ts-utils/scheduler";
import { EngineContext, EngineSettings } from "app/apis/engine";
import { mat4 } from "gl-matrix";
import { BoardGlContext } from "../gl/board-context";
import { EngineTextures } from "../gl/gl-context";
import { begin, tuple, Work } from "ts-utils/work";
import { GridRecord, LineRecord, NOOP_RENDERABLE, Renderable, ScreenSpriteRecord, SectorRecord, SpriteRecord, VoxelRecord, WallRecord, WallType } from "./api";

export function createRenderer3d(values: ValuesContainer, glContext: GlContext, ctx: EngineContext, textures: EngineTextures): Work<[], [Source<BoardRenderer3D>]> {
  const doCreateShader = (defs: string[], name: string) => createShader(glContext, `resources/shaders/${name}`, defs);
  const loadRendererWork = begin()
    .input<string[]>()
    .fork(p => p
      .thread('Compiling wall shader', defs => doCreateShader(defs, 'wall-instance'))
      .thread('Compiling sector shader', defs => doCreateShader(defs, 'sector-instance'))
      .thread('Compiling sprite shader', defs => doCreateShader(defs, 'sprite-instance'))
      .thread('Compiling voxel shader', defs => doCreateShader(defs, 'voxel-instance'))
      .thread('Compiling screen-sprite shader', defs => doCreateShader(defs, 'screen-sprite'))
      .thread('Compiling wall select shader', defs => doCreateShader(defs, 'wall-select'))
      .thread('Compiling sector select shader', defs => doCreateShader(defs, 'sector-select'))
      .thread('Compiling line shader', defs => doCreateShader(defs, 'line'))
      .thread('Compiling grid shader', defs => doCreateShader(defs, 'grid')))
    .then('Creating renderer', async (wall, sector, sprite, voxel, screenSprite, wallSelect, sectorSelect, line, grid) => {
      const state = new StateGl1(glContext, s => new BufferAllocator(glContext, s));
      state.register('wall-instance', wall);
      state.register('wall-select', wallSelect);
      state.register('sector-instance', sector);
      state.register('sector-select', sectorSelect);
      state.register('sprite-instance', sprite);
      state.register('voxel-instance', voxel);
      state.register('screen-sprite', screenSprite);
      state.register('line', line);
      state.register('grid', grid);
      return new BoardRenderer3D(textures, state);
    }).finishUntuple();

  let loadHandle = NOOP_TASK_HANDLE;
  async function loadRenderer(settings: EngineSettings, maxPluId: number, shadowsteps: number): Promise<BoardRenderer3D> {
    const defs = [
      `PALSWAPS (float(${maxPluId + 1}))`,
      `SHADOWSTEPS (float(${shadowsteps}))`,
      `TRANS1 (${settings.trans1})`,
      `TRANS2 (${settings.trans2})`,
      ...(settings.spriteShadowOff ? ['SPRITE_SHADOW_OFF'] : [])
    ];
    return await loadRendererWork(loadHandle, defs);
  }

  return begin()
    .thenWork(tuple(async handle => {
      loadHandle = handle;
      const result = await values.transformedAsyncTuple('rendeer',
        [ctx.settings, ctx.maxPluId, ctx.shadowsteps],
        ([settings, maxPluId, shadowsteps]) => loadRenderer(settings, maxPluId, shadowsteps),
        r => r.dispose());
      loadHandle = NOOP_TASK_HANDLE;
      return result;
    })).finish()
}

export class BoardRenderer3D implements Disposable {
  writeWalls: (recs: Iterable<WallRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeSectors: (recs: Iterable<SectorRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeSprites: (recs: Iterable<SpriteRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeVoxels: (recs: Iterable<SpriteRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeScreenSprites: (recs: Iterable<ScreenSpriteRecord>) => Renderable;
  writeWallSelect: (recs: Iterable<WallRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeSectorSelect: (recs: Iterable<SectorRecord>, boardGlCtx: BoardGlContext) => Renderable;
  writeLines: (recs: Iterable<LineRecord>) => Renderable;
  writeGrid: (recs: Iterable<GridRecord>, type?: number) => Renderable;

  view: Consumer<mat4>;
  projection: Consumer<mat4>;
  globalVis: Consumer<number>;
  globalShadow: Consumer<number>;
  depthShadowScale: Consumer<number>;
  time: Consumer<number>;
  parallaxPics: Consumer<number>;
  screenSize: MultiConsumer<[number, number]>;
  grid: Consumer<number>;

  constructor(
    private textures: EngineTextures,
    private state: StateGl1,
  ) {
    const matrices = this.state.uniformBlock('Matrices');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');
    this.view = (view: mat4) => { V(view); IV(mat4.invert(mat4.create(), view)); };
    this.projection = matrices.writer<[mat4]>('P');

    const engineParams = this.state.uniformBlock('Engine');
    this.globalVis = engineParams.writer<[number]>('globalVis');
    this.globalShadow = engineParams.writer<[number]>('globalShadow');
    this.depthShadowScale = engineParams.writer<[number]>('depthShadowScale');
    this.time = engineParams.writer<[number]>('time');
    this.parallaxPics = engineParams.writer<[number]>('parallaxPics');
    this.screenSize = engineParams.writer<[number, number]>('screenSize');
    this.grid = engineParams.writer<[number]>('grid');

    this.writeSectors = this.createSectorWriter();
    this.writeWalls = this.createWallWriter();
    this.writeSprites = this.createSpriteWriter();
    this.writeVoxels = this.createVoxelWriter();
    this.writeScreenSprites = this.createScreenSpriteWriter();
    this.writeWallSelect = this.createWallSelectWriter();
    this.writeSectorSelect = this.createSectorSelectWriter();
    this.writeLines = this.createLineWriter();
    this.writeGrid = this.createGridWriter();
  }

  async dispose() {
    this.state.dispose();
  }

  private genWalls(shader: ShaderConfig, walls: TextureSetter, sectors: TextureSetter, wallP: MultiConsumer<vec4>, builder: AttribDataBuilder, recs: Iterable<WallRecord>, ctx: BoardGlContext): Renderable {
    if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
    builder.start();
    iter(recs).forEach(({ wallId, sectorId, type }) => {
      if (type === WallType.VOID) {
        wallP(wallId, sectorId, 0, 0);
        builder.writeVertex();
      } else if (type === WallType.NONMASKED) {
        wallP(wallId, sectorId, 1, 0);
        builder.writeVertex();
        wallP(wallId, sectorId, 2, 0);
        builder.writeVertex();
      } else if (type === WallType.MASKED) {
        wallP(wallId, sectorId, 1, 0);
        builder.writeVertex();
        wallP(wallId, sectorId, 2, 0);
        builder.writeVertex();
        wallP(wallId, sectorId, 3, 0);
        builder.writeVertex();
      } else if (type === WallType.ONLY_MASKED) {
        wallP(wallId, sectorId, 3, 0);
        builder.writeVertex();
      } else if (type === WallType.ONLY_LOWER) {
        wallP(wallId, sectorId, 2, 0);
        builder.writeVertex();
      } else if (type === WallType.ONLY_UPPER) {
        wallP(wallId, sectorId, 1, 0);
        builder.writeVertex();
      }
    });
    const data = builder.build(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
    const render = _ => {
      walls(ctx.walls);
      sectors(ctx.sectors);
      this.state.draw(shader, data);
    }
    const dispose = async () => data.data.dispose();
    return { render, dispose };
  }

  private createWallWriter(): BiFunction<Iterable<WallRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('wall-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('atlas')(this.textures.atlas.get());
    shader.texture('infos')(this.textures.infos.get());
    const walls = shader.texture('walls');
    const sectors = shader.texture('sectors');

    const builder = shader.builder();
    const wallSectorPart = builder.vec4('aWallSectorPart_u16');
    return (recs, ctx) => this.genWalls(shader, walls, sectors, wallSectorPart, builder, recs, ctx);
  }

  private createWallSelectWriter(): BiFunction<Iterable<WallRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('wall-select');
    shader.texture('infos')(this.textures.infos.get());
    const walls = shader.texture('walls');
    const sectors = shader.texture('sectors');

    const builder = shader.builder();
    const part = builder.vec4('aWallSectorPart_u16');
    return (recs, ctx) => this.genWalls(shader, walls, sectors, part, builder, recs, ctx);
  }

  private createSectorWriter(): BiFunction<Iterable<SectorRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('sector-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('atlas')(this.textures.atlas.get());
    shader.texture('infos')(this.textures.infos.get());
    const walls = shader.texture('walls');
    const sectors = shader.texture('sectors');

    const builder = shader.builder();
    const pos12 = builder.vec4('aPos12');
    const pos3Sec = builder.vec4('aPos3SecPart');
    return (recs, ctx) => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ sectorId, ceiling, floor }) => {
        const points = ctx.sectorPoints.get()(sectorId);
        for (let i = 0; i < points.length; i += 3) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];
          if (ceiling > 0) {
            pos12(p1[0], p1[1], p2[0], p2[1]);
            pos3Sec(p3[0], p3[1], sectorId, ((ceiling - 1) << 1) | 0);
            builder.writeVertex();
          }
          if (floor > 0) {
            pos12(p1[0], p1[1], p2[0], p2[1]);
            pos3Sec(p3[0], p3[1], sectorId, ((floor - 1) << 1) | 1);
            builder.writeVertex();
          }
        }
      });
      const data = builder.build(WebGL2RenderingContext.TRIANGLES, 3);
      const render = _ => {
        walls(ctx.walls);
        sectors(ctx.sectors);
        this.state.draw(shader, data);
      }
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createSectorSelectWriter(): BiFunction<Iterable<SectorRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('sector-select');
    shader.texture('infos')(this.textures.infos.get());
    const walls = shader.texture('walls');
    const sectors = shader.texture('sectors');

    const builder = shader.builder();
    const pos12 = builder.vec4('aPos12');
    const pos3Sec = builder.vec4('aPos3SecPart');
    return (recs, ctx) => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ sectorId, ceiling, floor }) => {
        const points = ctx.sectorPoints.get()(sectorId);
        for (let i = 0; i < points.length; i += 3) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];
          if (ceiling) {
            pos12(p1[0], p1[1], p2[0], p2[1]);
            pos3Sec(p3[0], p3[1], sectorId, 0);
            builder.writeVertex();
          }
          if (floor) {
            pos12(p1[0], p1[1], p2[0], p2[1]);
            pos3Sec(p3[0], p3[1], sectorId, 1);
            builder.writeVertex();
          }
        }
      });
      const data = builder.build(WebGL2RenderingContext.TRIANGLES, 3);
      const render = _ => {
        walls(ctx.walls);
        sectors(ctx.sectors);
        this.state.draw(shader, data);
      }
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createSpriteWriter(): BiFunction<Iterable<SpriteRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('sprite-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('atlas')(this.textures.atlas.get());
    shader.texture('infos')(this.textures.infos.get());
    const sprites = shader.texture('sprites');
    const sectors = shader.texture('sectors');

    const builder = shader.builder();
    const spriteIdWriter = builder.scalar('aSpriteId_u16');
    return (recs, ctx) => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ spriteId }) => {
        spriteIdWriter(spriteId);
        builder.writeVertex();
      });
      const data = builder.build(WebGL2RenderingContext.TRIANGLE_STRIP, 6);
      const render = _ => {
        sectors(ctx.sectors);
        sprites(ctx.sprites);
        this.state.draw(shader, data);
      }
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createVoxelWriter(): BiFunction<Iterable<VoxelRecord>, BoardGlContext, Renderable> {
    const shader = this.state.getShader('voxel-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('infos')(this.textures.infos.get());
    const voxelTexture = shader.texture('voxel');
    const sprites = shader.texture('sprites');
    const sectors = shader.texture('sectors');

    const voxelBuilder = shader.builder();
    const voxelSpriteId = voxelBuilder.scalar('aSpriteId_u16');
    return (recs, ctx) => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      const data = iter(recs).groupEntries(field('voxelPicnum'), field('spriteId')).map(([picnum, spriteIds]) => {
        voxelBuilder.start();
        spriteIds.forEach(s => { voxelSpriteId(s); voxelBuilder.writeVertex(); });
        const voxel = this.textures.voxels.get()(picnum).get();
        return pair(voxel.texture, voxelBuilder.build(WebGL2RenderingContext.TRIANGLES, 6 * voxel.size));
      }).toMap(first, second);
      const render = _ => {
        sprites(ctx.sprites);
        sectors(ctx.sectors);
        data.forEach((data, texture) => { voxelTexture(texture); this.state.draw(shader, data); });
      }
      const dispose = async () => data.values().forEach(d => d.data.dispose());
      return { render, dispose };
    };
  }

  private createScreenSpriteWriter(): Function<Iterable<ScreenSpriteRecord>, Renderable> {
    const shader = this.state.getShader('screen-sprite');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('infos')(this.textures.infos.get());
    shader.texture('atlas')(this.textures.atlas.get());

    const builder = shader.builder();
    const posWriter = builder.vec4('aPosIdx');
    const offSizeWriter = builder.vec4('aOffSize_i16');
    const picnumWriter = builder.vec4('aPicnumTiles_u16');

    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;

      builder.start();
      iter(recs).forEach(({ pos, off, size, picnum, tiles, tileId }) => {
        posWriter(pos[0], pos[1], pos[2], tileId ?? 0);
        offSizeWriter(off[0], off[1], size[0], size[1]);
        picnumWriter(picnum, tiles ?? 1, 0, 0);
        builder.writeVertex();
      });
      const data = builder.build(WebGL2RenderingContext.TRIANGLES, 6);
      const render = _ => this.state.draw(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    }
  }

  private createLineWriter(): Function<Iterable<LineRecord>, Renderable> {
    const shader = this.state.getShader('line');
    const builder = shader.builder();
    const startWriter = builder.vec3('aStart');
    const endWriter = builder.vec3('aEnd');

    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ start, end }) => {
        startWriter(start[0], start[1], start[2]);
        endWriter(end[0], end[1], end[2]);
        builder.writeVertex();
      });
      const data = builder.build(WebGL2RenderingContext.LINES, 2);
      const render = _ => this.state.draw(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    }
  }

  private createGridWriter(): BiFunction<Iterable<GridRecord>, number, Renderable> {
    const shader = this.state.getShader('grid');
    const builder = shader.builder();
    const pos1Writer = builder.vec3('aPos1');
    const pos2Writer = builder.vec3('aPos2');
    const pos3Writer = builder.vec3('aPos3');
    const pos4Writer = builder.vec3('aPos4');
    const typeWriter = shader.uniformBlock('Local').writer('type');

    return (recs, type = 0) => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;

      builder.start();
      iter(recs).forEach(({ a, b, c, d }) => {
        pos1Writer(a[0], a[1], a[2]);
        pos2Writer(b[0], b[1], b[2]);
        pos3Writer(c[0], c[1], c[2]);
        pos4Writer(d[0], d[1], d[2]);
        builder.writeVertex();
      });
      const data = builder.build(WebGL2RenderingContext.TRIANGLES, 6);
      const render = _ => { typeWriter(type); this.state.draw(shader, data); }
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    }
  }
}
