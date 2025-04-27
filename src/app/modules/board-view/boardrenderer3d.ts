import { Disconnector, Disposable, Source, ValuesContainer } from "@utils/callbacks";
import { GlContext } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { BufferAllocator, StateGl1 } from "@utils/gl/stategl1";
import { iter } from "@utils/iter";
import { memoize } from "@utils/mathutils";
import { field } from "@utils/objects";
import { Consumer, first, Function, MultiConsumer, pair, second } from "@utils/types";
import { BoardContext, EngineContext, EngineSettings } from "app/apis/engine";
import { mat4 } from "gl-matrix";
import { BoardGlContext, createBoardGlContext } from "../gl/board-context";
import { point2d, triangulate } from "../gl/geometry/builders/sector";
import { EngineTextures } from "../gl/gl-context";
import { begin, tuple, Work } from "../scheduler/work";
import { LineRecord, NOOP_RENDERABLE, Renderable, ScreenSpriteRecord, SectorRecord, SpriteRecord, VoxelRecord, WallRecord, WallType } from "./api";
import { iterIsEmpty } from "@utils/collections";
import { NOOP_TASK_HANDLE } from "app/apis/app1";

export function createRenderer3d(values: ValuesContainer, glContext: GlContext, ctx: EngineContext, textures: EngineTextures, boardCtx: BoardContext): Work<[], [Source<BoardRenderer3D>]> {

  const loadRendererWork = begin()
    .input<string[]>()
    .fork(p => p
      .thread('Compiling wall shader', defs => createShader(glContext, 'resources/shaders/wall-instance', defs))
      .thread('Compiling sector shader', defs => createShader(glContext, 'resources/shaders/sector-instance', defs))
      .thread('Compiling sprite shader', defs => createShader(glContext, 'resources/shaders/sprite-instance', defs))
      .thread('Compiling voxel shader', defs => createShader(glContext, 'resources/shaders/voxel-instance', defs))
      .thread('Compiling screen-sprite shader', defs => createShader(glContext, 'resources/shaders/screen-sprite', defs))
      .thread('Compiling wall select shader', defs => createShader(glContext, 'resources/shaders/wall-select', defs))
      .thread('Compiling sector select shader', defs => createShader(glContext, 'resources/shaders/sector-select', defs))
      .thread('Compiling line shader', defs => createShader(glContext, 'resources/shaders/line', defs)))
    .then('Creating renderer', async (wall, sector, sprite, voxel, screenSprite, wallSelect, sectorSelect, line) => {
      const state = new StateGl1(glContext, s => new BufferAllocator(glContext, s, 128 * 1024, 128 * 1024));
      state.register('wall-instance', wall);
      state.register('wall-select', wallSelect);
      state.register('sector-instance', sector);
      state.register('sector-select', sectorSelect);
      state.register('sprite-instance', sprite);
      state.register('voxel-instance', voxel);
      state.register('screen-sprite', screenSprite);
      state.register('line', line);
      return new BoardRenderer3D(values, glContext, ctx, textures, boardCtx, state);
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
  private boardGl: BoardGlContext;
  private sectorPoints: Source<(t: number) => point2d[]>;

  writeWalls: (recs: Iterable<WallRecord>) => Renderable;
  writeSectors: (recs: Iterable<SectorRecord>) => Renderable;
  writeSprites: (recs: Iterable<SpriteRecord>) => Renderable;
  writeVoxels: (recs: Iterable<SpriteRecord>) => Renderable;
  writeScreenSprites: (recs: Iterable<ScreenSpriteRecord>) => Renderable;
  writeWallSelect: (recs: Iterable<WallRecord>) => Renderable;
  writeSectorSelect: (recs: Iterable<SectorRecord>) => Renderable;
  writeLines: (recs: Iterable<LineRecord>) => Renderable;

  view: Consumer<mat4>;
  projection: Consumer<mat4>;
  globalVis: Consumer<number>;
  globalShadow: Consumer<number>;
  depthShadowScale: Consumer<number>;
  time: Consumer<number>;
  parallaxPics: Consumer<number>;
  screenSize: MultiConsumer<[number, number]>;
  grid: Consumer<number>;

  onSectorsDisconnector: Disconnector;
  onWallsDisconnector: Disconnector;
  onSpritesDisconnector: Disconnector;


  constructor(
    values: ValuesContainer,
    glCtx: GlContext,
    private ctx: EngineContext,
    private textures: EngineTextures,
    private boardCtx: BoardContext,
    private state: StateGl1
  ) {
    this.boardGl = createBoardGlContext(glCtx);
    const board = this.boardCtx.board.get();
    board.sectors.forEach((s, i) => this.updateSector(i));
    board.sprites.forEach((s, i) => this.updateSprite(i));
    board.walls.forEach((w, i) => this.updateWall(i));
    this.onSectorsDisconnector = this.boardCtx.onSectorsChange(s => s.forEach(s => this.updateSector(s)));
    this.onWallsDisconnector = this.boardCtx.onWallsChange(w => w.forEach(w => this.updateWall(w)));
    this.onSpritesDisconnector = this.boardCtx.onSpritesChange(s => s.forEach(s => this.updateSprite(s)));

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

    this.sectorPoints = values.transformed('sector-points', boardCtx.board, board => memoize((s: number) => triangulate(board, s)));
  }

  async dispose() {
    this.boardGl.dispose();
    this.state.dispose();
    this.onSectorsDisconnector();
    this.onWallsDisconnector();
    this.onSpritesDisconnector();
  }

  updateWall(wallId: number) {
    const wall = this.boardCtx.board.get().walls[wallId];
    if (wall === null) return;
    this.boardGl.writeWall(wallId, wall);
    this.textures.get(wall.picnum).get();
    this.textures.get(wall.overpicnum).get();
  }

  updateSector(sectorId: number) {
    const sector = this.boardCtx.board.get().sectors[sectorId]
    if (sector === null) return;
    this.boardGl.writeSector(sectorId, sector);
    this.textures.get(sector.ceilingpicnum, sector.ceilingstat.parallaxing ? this.boardCtx.parallaxPicnums : 1).get();
    this.textures.get(sector.floorpicnum, sector.floorstat.parallaxing ? this.boardCtx.parallaxPicnums : 1).get();
  }

  updateSprite(spriteId: number) {
    const sprite = this.boardCtx.board.get().sprites[spriteId]
    if (sprite === null) return;
    this.boardGl.writeSprite(spriteId, sprite);
    this.textures.get(sprite.picnum).get();
  }

  private createWallWriter(): Function<Iterable<WallRecord>, Renderable> {
    const shader = this.state.getShader('wall-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('atlas')(this.textures.atlas.get());
    shader.texture('infos')(this.textures.infos.get());
    shader.texture('walls')(this.boardGl.walls);
    shader.texture('sectors')(this.boardGl.sectors);

    const builder = shader.builder();
    const wallSectorPart = builder.vec4('aWallSectorPart_u16');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ wallId, sectorId, type }) => {
        if (type === WallType.VOID) {
          wallSectorPart(wallId, sectorId, 0, 0);
          builder.writeVertex();
        } else if (type === WallType.NONMASKED) {
          wallSectorPart(wallId, sectorId, 1, 0);
          builder.writeVertex();
          wallSectorPart(wallId, sectorId, 2, 0);
          builder.writeVertex();
        } else if (type === WallType.MASKED) {
          wallSectorPart(wallId, sectorId, 1, 0);
          builder.writeVertex();
          wallSectorPart(wallId, sectorId, 2, 0);
          builder.writeVertex();
          wallSectorPart(wallId, sectorId, 3, 0);
          builder.writeVertex();
        } else if (type === WallType.ONLY_MASKED) {
          wallSectorPart(wallId, sectorId, 3, 0);
          builder.writeVertex();
        }
      });
      const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
      const render = _ => this.state.drawInstanced(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createWallSelectWriter(): Function<Iterable<WallRecord>, Renderable> {
    const shader = this.state.getShader('wall-select');
    shader.texture('walls')(this.boardGl.walls);
    shader.texture('sectors')(this.boardGl.sectors);
    shader.texture('infos')(this.textures.infos.get());

    const builder = shader.builder();
    const part = builder.vec4('aWallSectorPart_u16');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ wallId, sectorId, type }) => {
        if (type === WallType.VOID) {
          part(wallId, sectorId, 0, 0);
          builder.writeVertex();
        } else if (type === WallType.NONMASKED) {
          part(wallId, sectorId, 1, 0);
          builder.writeVertex();
          part(wallId, sectorId, 2, 0);
          builder.writeVertex();
        } else if (type === WallType.MASKED) {
          part(wallId, sectorId, 1, 0);
          builder.writeVertex();
          part(wallId, sectorId, 2, 0);
          builder.writeVertex();
          part(wallId, sectorId, 3, 0);
          builder.writeVertex();
        } else if (type === WallType.ONLY_MASKED) {
          part(wallId, sectorId, 3, 0);
          builder.writeVertex();
        }
      });
      const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
      const render = _ => this.state.drawInstanced(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createSectorWriter(): Function<Iterable<SectorRecord>, Renderable> {
    const shader = this.state.getShader('sector-instance');
    shader.texture('pal')(this.textures.pal.get());
    shader.texture('plu')(this.textures.plu.get());
    shader.texture('atlas')(this.textures.atlas.get());
    shader.texture('infos')(this.textures.infos.get());
    shader.texture('walls')(this.boardGl.walls);
    shader.texture('sectors')(this.boardGl.sectors);

    const builder = shader.builder();
    const pos12 = builder.vec4('aPos12');
    const pos3Sec = builder.vec4('aPos3SecPart');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ sectorId, ceiling, floor }) => {
        const points = this.sectorPoints.get()(sectorId);
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
      const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 3);
      const render = _ => this.state.drawInstanced(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createSectorSelectWriter(): Function<Iterable<SectorRecord>, Renderable> {
    const shader = this.state.getShader('sector-select');
    shader.texture('infos')(this.textures.infos.get());
    shader.texture('walls')(this.boardGl.walls);
    shader.texture('sectors')(this.boardGl.sectors);

    const builder = shader.builder();
    const pos12 = builder.vec4('aPos12');
    const pos3Sec = builder.vec4('aPos3SecPart');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      builder.start();
      iter(recs).forEach(({ sectorId, ceiling, floor }) => {
        const points = this.sectorPoints.get()(sectorId);
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
      const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 3);
      const render = _ => this.state.drawInstanced(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createSpriteWriter(): Function<Iterable<SpriteRecord>, Renderable> {
    const spriteShader = this.state.getShader('sprite-instance');
    spriteShader.texture('pal')(this.textures.pal.get());
    spriteShader.texture('plu')(this.textures.plu.get());
    spriteShader.texture('atlas')(this.textures.atlas.get());
    spriteShader.texture('infos')(this.textures.infos.get());
    spriteShader.texture('sectors')(this.boardGl.sectors);
    spriteShader.texture('sprites')(this.boardGl.sprites);

    const spriteBuilder = spriteShader.builder();
    const spriteIdWriter = spriteBuilder.scalar('aSpriteId_u16');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      spriteBuilder.start();
      iter(recs).forEach(({ spriteId }) => {
        spriteIdWriter(spriteId);
        spriteBuilder.writeVertex();
      });
      const data = spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6);
      const render = _ => this.state.drawInstanced(spriteShader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    };
  }

  private createVoxelWriter(): Function<Iterable<VoxelRecord>, Renderable> {
    const voxelShader = this.state.getShader('voxel-instance');
    voxelShader.texture('pal')(this.textures.pal.get());
    voxelShader.texture('plu')(this.textures.plu.get());
    voxelShader.texture('infos')(this.textures.infos.get());
    voxelShader.texture('sectors')(this.boardGl.sectors);
    voxelShader.texture('sprites')(this.boardGl.sprites);
    const voxelTexture = voxelShader.texture('voxel');

    const voxelBuilder = voxelShader.builder();
    const voxelSpriteId = voxelBuilder.scalar('aSpriteId_u16');
    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;
      const data = iter(recs).groupEntries(field('voxelPicnum'), field('spriteId')).map(([picnum, spriteIds]) => {
        voxelBuilder.start();
        spriteIds.forEach(s => { voxelSpriteId(s); voxelBuilder.writeVertex(); });
        const voxel = this.textures.voxels.get()(picnum).get();
        return pair(voxel.texture, voxelBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6 * voxel.size));
      }).toMap(first, second);
      const render = _ => data.forEach((data, texture) => { voxelTexture(texture); this.state.drawInstanced(voxelShader, data); });
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
    const posWriter = builder.vec3('aPos');
    const offSizeWriter = builder.vec4('aOffSize_i16');
    const picnumWriter = builder.vec4('aPicnum_u16');

    return recs => {
      if (iterIsEmpty(recs)) return NOOP_RENDERABLE;

      builder.start();
      iter(recs).forEach(({ pos, off, size, picnum }) => {
        posWriter(pos[0], pos[1], pos[2]);
        offSizeWriter(off[0], off[1], size[0], size[1]);
        picnumWriter(picnum, 0, 0, 0);
        builder.writeVertex();
      });
      const data = builder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6);
      const render = _ => this.state.drawInstanced(shader, data);
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
      const data = builder.buildInstanced(WebGL2RenderingContext.LINES, 2);
      const render = _ => this.state.drawInstanced(shader, data);
      const dispose = async () => data.data.dispose();
      return { render, dispose };
    }
  }
}
