import { Column, Row, Spacer, useValue } from "@ui/commons";
import { WindowBuilder } from "@ui/windows-common";
import { Source, ValuesContainer, createContainer } from "@utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { getOrCreate, groups, range } from "@utils/collections";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { createShader } from "@utils/gl/shaders";
import { AttribDataInstanced, BufferAllocator, ShaderConfig, StateGl1 } from "@utils/gl/stategl1";
import { drawToCanvas } from "@utils/imgutils";
import { Injector, getInstances } from "@utils/injector";
import { quadraticInterpolator } from "@utils/interpolator";
import { iter } from "@utils/iter";
import { int } from "@utils/mathutils";
import { objectKeys } from "@utils/objects";
import { fit, palRasterizer, transform } from "@utils/pixelprovider";
import { Stream } from "@utils/stream";
import { DelayedValue } from "@utils/timed";
import { Consumer, identity } from "@utils/types";
import { ACTION_DESCRIPTORS, StateChecker } from "app/apis/actions";
import { APP } from "app/apis/app1";
import { ArtInfoExtended, BoardContext, BuildTror, RorLink } from "app/apis/engine";
import { Window } from "app/apis/ui1";
import { BoardGlContext, createBoardGlContext } from "app/modules/gl/board-context";
import { BuildGlEngineContext } from "app/modules/gl/buildgl";
import { triangulate } from "app/modules/gl/geometry/builders/sector";
import { ArtRaster } from "build/artraster";
import { BloodBoard } from "build/blood/structs";
import { findSector } from "build/board/query";
import { Board, SectorStats, SpriteStats, WallStats } from "build/board/structs";
import { PvsBoardVisitorResult, VisResult } from "build/boardvisitor";
import { Entity, EntityType, Hitscan, Ray, hitscan } from "build/hitscan";
import { ZSCALE, build2gl, getPlayerStart, gl2build } from "build/utils";
import { mat4, vec3 } from "gl-matrix";
import React, { createContext, useContext, useEffect, useRef } from "react";
import { AutoSizer } from "react-virtualized";
import { match } from "ts-pattern";
import { ViewPosition } from "../view";

function InfoRow(props: { label: string, value: any }) {
  return <Row className='form-row'>
    <div className='form-row-label'>{props.label}</div>
    <div className='form-row-content'>{props.value}</div>
  </Row>
}

function View(props: { canvas: Consumer<HTMLCanvasElement>, }) {
  return <AutoSizer className="flex-fill" >
    {({ height, width }) => (
      <canvas tabIndex={1} height={height} width={width} ref={c => props.canvas(c)} />
    )}
  </AutoSizer>
}

type Utils = {
  picInfo: (picnum: number) => ArtInfoExtended,
  picRasterizer: (picnum: number, pal: number, canvas: HTMLCanvasElement) => void,
  alias: (picnum: number) => string,
  readonly viewPosition: Source<ViewPosition>,
  readonly boardCtx: BoardContext,
}

const UtilsContext = createContext<Utils>(null);

function PicPreview(props: { picnum: number, pal: number }) {
  const utils = useContext(UtilsContext);
  const info = utils.picInfo(props.picnum);
  const alias = utils.alias(props.picnum);
  const canvasRef = useRef<HTMLCanvasElement>();
  useEffect(() => utils.picRasterizer(props.picnum, props.pal, canvasRef.current));
  return <div>
    <div>{`Alias: ${alias}`}</div>
    <div>{`Size: ${info.w}x${info.h}`}</div>
    <div>{`Offs: ${info.attrs.xoff},${info.attrs.yoff}`}</div>
    <div>{`Type: ${info.attrs.type}`}</div>
    <canvas style={{ width: '128px', height: '128px' }} height={128} width={128} ref={canvasRef} />
  </div>
}

function Sector(props: { ent: Entity, board: Board }) {
  const utils = useContext(UtilsContext);
  const sec = props.board.sectors[props.ent.id];
  const getStat = (s: SectorStats) => iter(objectKeys(s)).filter(k => s[k] === 1 || s[k] === true).map(k => k.toString()).join(', ').collect()
  return <Column className="form-panel">
    <InfoRow label="Sector Id" value={props.ent.id} />
    <InfoRow label="Picnum" value={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
    <InfoRow label="Shade" value={props.ent.type === EntityType.CEILING ? sec.ceilingshade : sec.floorshade} />
    <InfoRow label="Pal" value={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} />
    <InfoRow label="Offset" value={props.ent.type === EntityType.CEILING ? `${sec.ceilingxpanning}, ${sec.ceilingypanning}` : `${sec.floorxpanning}, ${sec.floorypanning}`} />
    <InfoRow label="Z" value={props.ent.type === EntityType.CEILING ? sec.ceilingz : sec.floorz} />
    <InfoRow label="Cstat" value={props.ent.type === EntityType.CEILING ? getStat(sec.ceilingstat) : getStat(sec.floorstat)} />
    <InfoRow label="Lo-Tag" value={`${sec.lotag} ${utils.boardCtx.lotagSectorText(props.ent.id)} `} />
    <InfoRow label="Hi-Tag" value={sec.hitag} />
    <PicPreview pal={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} picnum={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
  </Column>
}

function Sprite(props: { ent: Entity, board: Board }) {
  const utils = useContext(UtilsContext);
  const spr = props.board.sprites[props.ent.id];
  const getStat = (s: SpriteStats) => iter(objectKeys(s)).filter(k => s[k] === 1).map(k => k.toString()).join(', ').collect()
  return <Column className="form-panel">
    <InfoRow label="Sprite Id" value={props.ent.id} />
    <InfoRow label="Z" value={spr.z} />
    <InfoRow label="Picnum" value={spr.picnum} />
    <InfoRow label="Shade" value={spr.shade} />
    <InfoRow label="Pal" value={spr.pal} />
    <InfoRow label="Offset" value={`${spr.xoffset}, ${spr.yoffset}`} />
    <InfoRow label="Repeat" value={`${spr.xrepeat}, ${spr.yrepeat}`} />
    <InfoRow label="Cstat" value={getStat(spr.cstat)} />
    <InfoRow label="Blend" value={spr.blend} />
    <InfoRow label="Lo-Tag" value={`${spr.lotag} ${utils.boardCtx.lotagSpriteText(props.ent.id)}`} />
    <InfoRow label="Hi-Tag" value={spr.hitag} />
    <PicPreview pal={spr.pal} picnum={spr.picnum} />
  </Column>
}

function Wall(props: { ent: Entity, board: Board }) {
  const utils = useContext(UtilsContext);
  const wall = props.board.walls[props.ent.id];
  const getStat = (s: WallStats) => iter(objectKeys(s)).filter(k => s[k] === 1).map(k => k.toString()).join(', ').collect()
  return <Column className="form-panel">
    <InfoRow label="Wall Id" value={props.ent.id} />
    <InfoRow label="Pos" value={`${wall.x}, ${wall.y}`} />
    <InfoRow label="Picnum" value={wall.picnum} />
    <InfoRow label="OPicnum" value={wall.overpicnum} />
    <InfoRow label="Shade" value={wall.shade} />
    <InfoRow label="Pal" value={wall.pal} />
    <InfoRow label="Pan" value={`${wall.xpanning}, ${wall.ypanning}`} />
    <InfoRow label="Repeat" value={`${wall.xrepeat}, ${wall.yrepeat}`} />
    <InfoRow label="Cstat" value={getStat(wall.cstat)} />
    <InfoRow label="Lo-Tag" value={`${wall.lotag} ${utils.boardCtx.lotagWallText(props.ent.id)}`} />
    <InfoRow label="Hi-Tag" value={wall.hitag} />
    <PicPreview pal={wall.pal} picnum={wall.picnum} />
  </Column>
}

function InfoPanel(props: { board: Board, ent: Source<Entity> }) {
  const ent = useValue(props.ent);
  if (ent == null) return <></>
  return match(ent.type)
    .with(EntityType.CEILING, EntityType.FLOOR, () => <Sector board={props.board} ent={ent} />)
    .with(EntityType.MID_WALL, EntityType.UPPER_WALL, EntityType.LOWER_WALL, () => <Wall board={props.board} ent={ent} />)
    .with(EntityType.SPRITE, () => <Sprite board={props.board} ent={ent} />)
    .otherwise(() => <></>)
}

function Footer(props: { board: Board, drawData: Source<DrawData> }) {
  const utils = useContext(UtilsContext);
  const viewPos = useValue(utils.viewPosition);
  return <div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{props.board.sectors.length} Sector(s) {props.board.walls.length} Wall(s) {props.board.sprites.length} Sprites(s) {`x:${viewPos.x} y:${viewPos.y} z:${viewPos.z} sec:${viewPos.sec}`}</div>
  </div>
}

function BoardViewWindow(props: { canvas: Consumer<HTMLCanvasElement>, states: StateChecker[], board: Board, ent: Source<Entity>, drawData: Source<DrawData> }) {
  return (
    <Column>
      <Column>
        <View canvas={props.canvas} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, padding: '5px', width: '200px' }} ><InfoPanel board={props.board} ent={props.ent} /></div>
      </Column>
      <Footer board={props.board} drawData={props.drawData} />
    </Column>
  );
}

function createViewPosition(values: ValuesContainer, ctl: Controller3D, board: Board, tror: BuildTror): Source<ViewPosition> {
  let lastSector = -1;
  return values.transformed('viewPosition', ctl.getPosition(), pos => {
    const [x, y, z] = gl2build(vec3.create(), pos);
    lastSector = findSector(board, tror, x, y, z, lastSector);
    return { x: int(x), y: int(y), z: int(z), sec: lastSector } as ViewPosition
  });
}

function createHitscan(values: ValuesContainer, ctl: Controller3D, viewPosition: Source<ViewPosition>, art: Source<Map<number, ArtInfoExtended>>, boardCtx: BoardContext) {
  const ray = values.transformedTuple('ray', [ctl.forwardMouse, viewPosition], ([fwd, pos]) => {
    const r = new Ray();
    vec3.set(r.start, pos.x, pos.y, pos.z);
    gl2build(r.dir, fwd);
    return r;
  });
  const hit = new Hitscan();
  const ent = values.valueBuilder<Entity>({ name: 'entity', value: null, eq: (l, r) => l === r || (l !== null && l.equals(r)) });
  values.handleStandalone([ray], ({ start, dir }) => {
    const fwd = gl2build(vec3.create(), ctl.getForward());
    hit.reset(start[0], start[1], start[2], dir[0], dir[1], dir[2], fwd[0], fwd[1], fwd[2]);
    hitscan(boardCtx.board, boardCtx.utils, art.get(), viewPosition.get().sec, hit, 0);
    ent.set(hit.target().entity)
  });
  return ent;
}

type RorDrawData = {
  drawData: DrawData,
  sectorId: number,
  diff: vec3,
}

type DrawData = {
  sectors: AttribDataInstanced,
  walls: AttribDataInstanced,
  sprites: AttribDataInstanced,
  transSectors: AttribDataInstanced,
  transWalls: AttribDataInstanced,
  transSprites: AttribDataInstanced,
  blendSprites: Map<number, AttribDataInstanced>,
  voxels: Map<number, AttribDataInstanced>,
  rors: RorDrawData[],
};

function disposeDrawData(data: DrawData) {
  data.sectors.data.dispose();
  data.walls.data.dispose();
  data.sprites.data.dispose();
  data.transSprites?.data.dispose();
  data.transWalls?.data.dispose();
  data.blendSprites.values().forEach(d => d.data.dispose());
  data.voxels.values().forEach(d => d.data.dispose());
}

type SectorRecord = { sectorId: number, ceiling: boolean, floor: boolean };
type WallRecord = { wallId: number, sectorId: number, part: number };
type SpriteRecord = { spriteId: number };

class DrawDataSupplier {
  private boardGl: BoardGlContext;
  private wallShader: ShaderConfig;
  private sectorShader: ShaderConfig;
  private spriteShader: ShaderConfig;
  private voxelShader: ShaderConfig;

  readonly writeWalls: (recs: WallRecord[]) => AttribDataInstanced;
  readonly writeSectors: (recs: SectorRecord[]) => AttribDataInstanced;
  readonly writeSprites: (recs: SpriteRecord[]) => AttribDataInstanced;

  constructor(
    private glCtx: GlContext,
    private ctx: BuildGlEngineContext,
    private boardCtx: BoardContext,
    private state: StateGl1,
  ) {
    const board = this.boardCtx.board;
    this.boardGl = createBoardGlContext(glCtx);
    board.sectors.forEach((s, i) => this.boardGl.writeSector(i, s));
    board.sprites.forEach((s, i) => this.boardGl.writeSprite(i, s));
    board.walls.forEach((w, i) => this.boardGl.writeWall(i, w));

    this.wallShader = state.getShader('wall-instance');
    this.sectorShader = state.getShader('sector-instance');
    this.spriteShader = state.getShader('sprite-instance');
    this.voxelShader = state.getShader('voxel-instance');

    const matrices = this.wallShader.uniformBlock('Matrices');
    const P = matrices.writer<[mat4]>('P');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');
    const view = (view: mat4) => { V(view); IV(mat4.invert(mat4.create(), view)) };

    const engineParams = this.wallShader.uniformBlock('Engine');
    const globalVis = engineParams.writer<[number]>('globalVis');
    const globalShadow = engineParams.writer<[number]>('globalShadow');
    const depthShadowScale = engineParams.writer<[number]>('depthShadowScale');
    const time = engineParams.writer<[number]>('time');
    const parallaxPics = engineParams.writer<[number]>('parallaxPics');
    depthShadowScale(1024);
    parallaxPics(boardCtx.parallaxPicnums);

    this.wallShader.texture('pal')(ctx.textures().pal.get().get());
    this.wallShader.texture('plu')(ctx.textures().plu.get().get());
    this.wallShader.texture('atlas')(ctx.textures().atlas.get());
    this.wallShader.texture('infos')(ctx.textures().infos.get());
    this.wallShader.texture('walls')(this.boardGl.walls);
    this.wallShader.texture('sectors')(this.boardGl.sectors);

    this.sectorShader.texture('pal')(ctx.textures().pal.get().get());
    this.sectorShader.texture('plu')(ctx.textures().plu.get().get());
    this.sectorShader.texture('atlas')(ctx.textures().atlas.get());
    this.sectorShader.texture('infos')(ctx.textures().infos.get());
    this.sectorShader.texture('walls')(this.boardGl.walls);
    this.sectorShader.texture('sectors')(this.boardGl.sectors);

    this.spriteShader.texture('pal')(ctx.textures().pal.get().get());
    this.spriteShader.texture('plu')(ctx.textures().plu.get().get());
    this.spriteShader.texture('atlas')(ctx.textures().atlas.get());
    this.spriteShader.texture('infos')(ctx.textures().infos.get());
    this.spriteShader.texture('sectors')(this.boardGl.sectors);
    this.spriteShader.texture('sprites')(this.boardGl.sprites);

    this.voxelShader.texture('pal')(ctx.textures().pal.get().get());
    this.voxelShader.texture('plu')(ctx.textures().plu.get().get());
    this.voxelShader.texture('infos')(ctx.textures().infos.get());
    this.voxelShader.texture('sectors')(this.boardGl.sectors);
    this.voxelShader.texture('sprites')(this.boardGl.sprites);
    const voxelTexture = this.voxelShader.texture('voxel');

    const wallBuilder = this.wallShader.builder();
    const wallSectorPart = wallBuilder.vec4('aWallSectorPart_u16');
    this.writeWalls = (recs: WallRecord[]) => {
      wallBuilder.start();
      recs.forEach(({ wallId, sectorId, part }) => {
        wallSectorPart(wallId, sectorId, part, 0);
        wallBuilder.writeVertex();
      });
      return wallBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
    }

    const sectorBuilder = this.sectorShader.builder();
    const sectorPos12 = sectorBuilder.vec4('aPos12');
    const sectorPos3Sec = sectorBuilder.vec4('aPos3Sec');
    const sectorPoints = iter(range(0, board.sectors.length)).toMap(identity(), s => triangulate(board, s));
    this.writeSectors = (recs: SectorRecord[]) => {
      sectorBuilder.start();
      recs.forEach(({ sectorId, ceiling, floor }) => {
        const points = sectorPoints.get(sectorId);
        for (let i = 0; i < points.length; i += 3) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];
          sectorPos12(p1[0], p1[1], p2[0], p2[1]);
          sectorPos3Sec(p3[0], p3[1], sectorId, (ceiling ? 1 : 0) | (floor ? 2 : 0));
          sectorBuilder.writeVertex();
        }
      });
      return sectorBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6);
    }

    const spriteBuilder = this.spriteShader.builder();
    const spriteIdWriter = spriteBuilder.scalar('aSpriteId_u16');
    this.writeSprites = (recs: SpriteRecord[]) => {
      spriteBuilder.start();
      recs.forEach(({ spriteId }) => {
        spriteIdWriter(spriteId);
        spriteBuilder.writeVertex();
      });
      return spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6);
    }

    const voxelBuilder = this.voxelShader.builder();
    const voxelSpriteId = voxelBuilder.scalar('aSpriteId_u16');
    // this.writeVoxels

  }
}

export async function createBoardView(injector: Injector, ctx: BuildGlEngineContext, mapName: string): Promise<Window> {
  return createContainer('board-view').initializeAsync(async values => {
    const [app, actionDescriptors, glContext] = await getInstances(injector, APP, ACTION_DESCRIPTORS, GL_CONTEXT);
    const resources = ctx.engine.resources;
    const boardCtx = await resources.get().read(mapName)
      .then(o => ctx.engine.loadBoard(new Stream(o.orElseThrow(() => new Error(`Map ${mapName} not found`)))));
    const board = boardCtx.board;

    const boardGl = createBoardGlContext(glContext);
    board.sectors.forEach((s, i) => boardGl.writeSector(i, s));
    board.sprites.forEach((s, i) => boardGl.writeSprite(i, s));
    board.walls.forEach((w, i) => boardGl.writeWall(i, w));

    const state = new StateGl1(glContext, s => new BufferAllocator(glContext, s, 128 * 1024, 128 * 1024));
    const defs = [
      `PALSWAPS (float(${ctx.engine.maxPluId.get() + 1}))`,
      `SHADOWSTEPS (float(${ctx.engine.shadowsteps.get()}))`,
      `TRANS1 (${ctx.engine.settings.trans1})`,
      `TRANS2 (${ctx.engine.settings.trans2})`,
      ...(ctx.engine.settings.spriteShadowOff ? ['SPRITE_SHADOW_OFF'] : [])
    ];
    state.register('wall-instance', await createShader(glContext, 'resources/shaders/wall-instance', [...defs]));
    state.register('sector-instance', await createShader(glContext, 'resources/shaders/sector-instance', [...defs]));
    state.register('sprite-instance', await createShader(glContext, 'resources/shaders/sprite-instance', [...defs]));
    state.register('voxel-instance', await createShader(glContext, 'resources/shaders/voxel-instance', [...defs]));
    const wallShader = state.getShader('wall-instance');
    const sectorShader = state.getShader('sector-instance');
    const spriteShader = state.getShader('sprite-instance');
    const voxelShader = state.getShader('voxel-instance');

    const matrices = wallShader.uniformBlock('Matrices');
    const P = matrices.writer<[mat4]>('P');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');

    const engineParams = wallShader.uniformBlock('Engine');
    const globalVis = engineParams.writer<[number]>('globalVis');
    const globalShadow = engineParams.writer<[number]>('globalShadow');
    const depthShadowScale = engineParams.writer<[number]>('depthShadowScale');
    const time = engineParams.writer<[number]>('time');
    const parallaxPics = engineParams.writer<[number]>('parallaxPics');
    depthShadowScale(1024);
    parallaxPics(boardCtx.parallaxPicnums);

    wallShader.texture('pal')(ctx.textures().pal.get().get());
    wallShader.texture('plu')(ctx.textures().plu.get().get());
    wallShader.texture('atlas')(ctx.textures().atlas.get());
    wallShader.texture('infos')(ctx.textures().infos.get());
    wallShader.texture('walls')(boardGl.walls);
    wallShader.texture('sectors')(boardGl.sectors);

    sectorShader.texture('pal')(ctx.textures().pal.get().get());
    sectorShader.texture('plu')(ctx.textures().plu.get().get());
    sectorShader.texture('atlas')(ctx.textures().atlas.get());
    sectorShader.texture('infos')(ctx.textures().infos.get());
    sectorShader.texture('walls')(boardGl.walls);
    sectorShader.texture('sectors')(boardGl.sectors);
    spriteShader.texture('pal')(ctx.textures().pal.get().get());

    spriteShader.texture('plu')(ctx.textures().plu.get().get());
    spriteShader.texture('atlas')(ctx.textures().atlas.get());
    spriteShader.texture('infos')(ctx.textures().infos.get());
    spriteShader.texture('sectors')(boardGl.sectors);
    spriteShader.texture('sprites')(boardGl.sprites);

    voxelShader.texture('pal')(ctx.textures().pal.get().get());
    voxelShader.texture('plu')(ctx.textures().plu.get().get());
    voxelShader.texture('infos')(ctx.textures().infos.get());
    voxelShader.texture('sectors')(boardGl.sectors);
    voxelShader.texture('sprites')(boardGl.sprites);
    const voxelTexture = voxelShader.texture('voxel');

    const wallBuilder = wallShader.builder();
    const wallSectorPart = wallBuilder.vec4('aWallSectorPart_u16');

    const sectorBuilder = sectorShader.builder();
    const sectorPos12 = sectorBuilder.vec4('aPos12');
    const sectorPos3SecPart = sectorBuilder.vec4('aPos3SecPart');

    const spriteBuilder = spriteShader.builder();
    const spriteId = spriteBuilder.scalar('aSpriteId_u16');

    const voxelBuilder = voxelShader.builder();
    const voxelSpriteId = voxelBuilder.scalar('aSpriteId_u16');

    const sectorPoints = iter(range(0, board.sectors.length)).toMap(identity(), s => triangulate(board, s));

    const sectors = (() => {
      sectorBuilder.start();
      board.sectors.forEach((sec, s) => {
        ctx.textures().get(sec.ceilingpicnum, sec.ceilingstat.parallaxing ? boardCtx.parallaxPicnums : 0).get();
        ctx.textures().get(sec.floorpicnum, sec.floorstat.parallaxing ? boardCtx.parallaxPicnums : 0).get();
        const points = sectorPoints.get(s);
        for (const [p1, p2, p3] of groups(points, 3)) {
          sectorPos12(p1[0], p1[1], p2[0], p2[1]);
          sectorPos3SecPart(p3[0], p3[1], s, 0);
          sectorBuilder.writeVertex();
          sectorPos12(p1[0], p1[1], p2[0], p2[1]);
          sectorPos3SecPart(p3[0], p3[1], s, 1);
          sectorBuilder.writeVertex();
        }
      });
      return sectorBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6);
    })();

    const walls = (() => {
      wallBuilder.start();
      board.sectors.forEach((sec, s) => iter(range(sec.wallptr, sec.wallptr + sec.wallnum)).forEach(w => {
        const wall = board.walls[w];
        ctx.textures().get(wall.picnum).get();
        ctx.textures().get(wall.overpicnum).get();
        if (wall.nextsector === -1) {
          wallSectorPart(w, s, 0, 0);
          wallBuilder.writeVertex();
        } else {
          wallSectorPart(w, s, 1, 0);
          wallBuilder.writeVertex();
          wallSectorPart(w, s, 2, 0);
          wallBuilder.writeVertex();
          if (wall.cstat.masking || wall.cstat.oneWay) {
            wallSectorPart(w, s, 3, 0);
            wallBuilder.writeVertex();
          }
        }
      }));
      return wallBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
    })();

    const sprites = (() => {
      spriteBuilder.start();
      iter(board.sprites)
        .enumerate()
        .forEach(([spr, s]) => {
          ctx.textures().get(spr.picnum).get();
          spriteId(s);
          spriteBuilder.writeVertex();
        });
      return spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6);
    })();

    const art = ctx.engine.artMap;

    const sprite = getPlayerStart(board);
    const ctl = new Controller3D(values);
    values.handleStandalone([ctl.projection], proj => P(proj));
    values.handleStandalone([ctl.camera.transform], view => { V(view); IV(mat4.invert(mat4.create(), view)) });

    const [posx, posy, posz] = build2gl(vec3.create(), vec3.fromValues(sprite.x, sprite.y, sprite.z + 1024 * ZSCALE));
    ctl.setPosition(posx, posy, posz);
    const viewPosition = createViewPosition(values, ctl, board, boardCtx.tror);
    const hitscan = createHitscan(values, ctl, viewPosition, art, boardCtx)

    const mousemove = (e: MouseEvent) => ctl.track(e.offsetX, e.offsetY, e.buttons === 1);
    const canvasValue = values.valueBuilder<HTMLCanvasElement>({ name: 'canvasValue', value: undefined, disposer: c => c?.removeEventListener('mousemove', mousemove) });
    values.addSubscribed(canvasValue, c => { if (c) ctl.setSize(c.clientWidth, c.clientHeight) });
    values.addSubscribed(canvasValue, c => c?.addEventListener('mousemove', mousemove));

    const vis = values.value('vis', (board as BloodBoard).visibility ?? 512);
    values.handleStandalone([vis], vis => globalVis(vis));
    const shadowOff = values.value('shadow-mod', 0);
    values.handleStandalone([shadowOff], shadow => globalShadow(shadow));

    const visible = new PvsBoardVisitorResult();
    const visCache = new Map<number, PvsBoardVisitorResult>();
    const all: DrawData = { sectors, walls, sprites, transSprites: null, transWalls: null, transSectors: null, blendSprites: new Map(), voxels: new Map(), rors: [] };

    function getDrawData(result: VisResult, pos: ViewPosition, forward: vec3, visited: Set<number>): DrawData {

      const rorsArr: [number, RorLink][] = [];
      const transSectorArr: [number, boolean][] = [];
      sectorBuilder.start();
      result.forSector(board, (board, sectorId) => {
        visited.add(sectorId);
        const sector = board.sectors[sectorId];
        const ceilingLink = boardCtx.ror.rorLinks.ceilLink(sectorId);
        if (ceilingLink !== undefined) rorsArr.push([sectorId, ceilingLink]);
        const floorLink = boardCtx.ror.rorLinks.floorLink(sectorId);
        if (floorLink !== undefined) rorsArr.push([sectorId, floorLink]);
        const points = sectorPoints.get(sectorId);
        const transCeiling = sector.ceilingstat.type >= 2;
        const transFloor = sector.floorstat.type >= 2;
        if (transCeiling) transSectorArr.push([sectorId, true]);
        if (transFloor) transSectorArr.push([sectorId, false]);
        for (let i = 0; i < points.length; i += 3) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];
          if (!transCeiling) {
            sectorPos12(p1[0], p1[1], p2[0], p2[1]);
            sectorPos3SecPart(p3[0], p3[1], sectorId, 0);
            sectorBuilder.writeVertex();
          }
          if (!transFloor) {
            sectorPos12(p1[0], p1[1], p2[0], p2[1]);
            sectorPos3SecPart(p3[0], p3[1], sectorId, 1);
            sectorBuilder.writeVertex();
          }
        }
      });

      const transWallsArr: [number, number, number][] = [];
      wallBuilder.start();
      result.forWall(board, (board, wallId, sectorId, dist) => {
        const wall = board.walls[wallId];
        if (wall.nextsector === -1) {
          wallSectorPart(wallId, sectorId, 0, 0);
          wallBuilder.writeVertex();
        } else {
          wallSectorPart(wallId, sectorId, 1, 0);
          wallBuilder.writeVertex();
          wallSectorPart(wallId, sectorId, 2, 0);
          wallBuilder.writeVertex();
          if (wall.cstat.masking || wall.cstat.oneWay) {
            if (wall.cstat.translucent || wall.cstat.translucentReversed) {
              transWallsArr.push([wallId, sectorId, dist]);
            } else {
              wallSectorPart(wallId, sectorId, 3, 0);
              wallBuilder.writeVertex();
            }
          }
        }
      });

      const transSpritesArr: [number, number][] = [];
      const blendSpritesMap = new Map<number, [number, number][]>();
      const voxelsMap = new Map<number, number[]>();
      spriteBuilder.start();
      voxelBuilder.start();
      result.forSprite(board, (board, s, dist) => {
        const sprite = board.sprites[s];
        const voxel = ctx.engine.spriteVoxelSwap.get()(sprite.picnum);
        if (voxel.isPresent()) {
          getOrCreate(voxelsMap, sprite.picnum, _ => []).push([s]);
        } else {
          if (sprite.cstat.translucent || sprite.cstat.tranclucentReversed) {
            if (sprite.blend !== 0) getOrCreate(blendSpritesMap, sprite.blend, _ => []).push([s, dist]);
            else transSpritesArr.push([s, dist]);
          } else {
            spriteId(s);
            spriteBuilder.writeVertex();
          }
        }
      });

      const sectors = sectorBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 3);
      const walls = wallBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
      const sprites = spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6);


      transWallsArr.sort((l, r) => r[2] - l[2]);
      transSpritesArr.sort((l, r) => r[1] - l[1]);

      wallBuilder.start();
      transWallsArr.forEach(([w, s, _]) => { wallSectorPart(w, s, 3, 0); wallBuilder.writeVertex() })
      spriteBuilder.start();
      transSpritesArr.forEach(([s, _]) => { spriteId(s); spriteBuilder.writeVertex() });
      sectorBuilder.start();
      transSectorArr.forEach(([sectorId, ceiling]) => {
        const points = sectorPoints.get(sectorId);
        for (let i = 0; i < points.length; i += 3) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];
          sectorPos12(p1[0], p1[1], p2[0], p2[1]);
          sectorPos3SecPart(p3[0], p3[1], sectorId, ceiling ? 0 : 1);
          sectorBuilder.writeVertex();
        }
      })

      const transSprites = transSpritesArr.length === 0 ? null : spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6);
      const transWalls = transWallsArr.length === 0 ? null : wallBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
      const transSectors = transSectorArr.length === 0 ? null : sectorBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 3);

      const blendSprites = new Map();
      blendSpritesMap.forEach((spr, blend) => {
        spriteBuilder.start();
        spr.forEach(([s, _]) => { spriteId(s); spriteBuilder.writeVertex() });
        blendSprites.set(blend, spriteBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 6));
      });

      const voxels = new Map<number, AttribDataInstanced>();
      voxelsMap.forEach((spr, picnum) => {
        voxelBuilder.start();
        spr.forEach(s => { voxelSpriteId(s); voxelBuilder.writeVertex() });
        const size = ctx.textures().voxels.get()(picnum).get().size;
        voxels.set(picnum, voxelBuilder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6 * size));
      });

      const rors: RorDrawData[] = [];
      rorsArr
        .filter(([, { dstSector }]) => !visited.has(dstSector))
        .forEach(([sectorId, { buildDiff, dstSector }]) => {
          const diff = build2gl(vec3.create(), buildDiff);
          const pvs = getOrCreate(visCache, sectorId, _ => new PvsBoardVisitorResult());
          const npos = vec3.sub(vec3.create(), vec3.fromValues(pos.x, pos.y, pos.z), buildDiff);
          const ms = { sec: dstSector, x: npos[0], y: npos[1], z: npos[2] }
          const result = pvs.visit(board, boardCtx.utils, boardCtx.tror, ms, forward);
          const drawData = getDrawData(result, ms, forward, visited);
          rors.push({ diff, drawData, sectorId });
        });

      return { sectors, sprites, walls, transSprites, transWalls, transSectors, blendSprites, voxels, rors };
    }

    const toRender = values.transformedTuple('toRender', [viewPosition, ctl.camera.forward], ([pos, forward]): DrawData =>
      pos.sec === -1 ? all : getDrawData(visible.visit(board, boardCtx.utils, boardCtx.tror, pos, forward), pos, forward, new Set()),
      { disposer: dd => { if (dd !== all) disposeDrawData(dd) } });

    const rasterizer = palRasterizer(ctx.engine.pal.get());
    const picRasterizer = (picnum: number, pal: number, canvas: HTMLCanvasElement) => {
      const info = ctx.engine.artMap.get().get(picnum);
      const p = iter(ctx.engine.plus.get()).first(p => p.id === pal).orElseGet(() => ctx.engine.plus.get()[0]).plu;
      drawToCanvas(transform(fit(128, 128, new ArtRaster(info), 255), c => c === 255 ? 255 : p[c]), canvas.getContext('2d'), rasterizer);
    }
    const picInfo = (picnum: number) => ctx.engine.artMap.get().get(picnum);

    const actionsCtx = actionDescriptors.sub('board-view');
    const bind = (name: string) => actionsCtx.get(name).bind().get();
    const inter = quadraticInterpolator(0.8);
    const forwardDamper = new DelayedValue(500, 0, inter, app.timer);
    const backDamper = new DelayedValue(500, 0, inter, app.timer);
    const leftDamper = new DelayedValue(500, 0, inter, app.timer);
    const rightDamper = new DelayedValue(500, 0, inter, app.timer);
    const states: StateChecker[] = [
      { bind: bind('forward'), action: s => forwardDamper.set(s ? 1 : 0) },
      { bind: bind('back'), action: s => backDamper.set(s ? -1 : 0) },
      { bind: bind('strife-left'), action: s => leftDamper.set(s ? -1 : 0) },
      { bind: bind('strife-right'), action: s => rightDamper.set(s ? 1 : 0) }
    ];

    const gl = glContext.gl;

    function draw(data: DrawData, v: mat4) {
      data.rors.forEach(ror => {
        const v = mat4.translate(mat4.create(), ctl.camera.transform.get(), ror.diff);
        draw(ror.drawData, v);
      });

      V(v);
      IV(mat4.invert(mat4.create(), v));

      state.drawInstanced(wallShader, data.walls);
      state.drawInstanced(sectorShader, data.sectors);
      state.drawInstanced(spriteShader, data.sprites);
      data.voxels.forEach((data, picnum) => {
        voxelTexture(ctx.textures().voxels.get()(picnum).get().texture);
        state.drawInstanced(voxelShader, data);
      });

      gl.enable(gl.BLEND);
      gl.blendFunc(ctx.engine.blends.get()(0).src, ctx.engine.blends.get()(0).dst);
      gl.depthMask(false);

      if (data.transWalls) state.drawInstanced(wallShader, data.transWalls);
      if (data.transSprites) state.drawInstanced(spriteShader, data.transSprites);
      if (data.transSectors) state.drawInstanced(sectorShader, data.transSectors);

      data.blendSprites.forEach((data, blend) => {
        gl.blendFunc(ctx.engine.blends.get()(blend).src, ctx.engine.blends.get()(blend).dst);
        state.drawInstanced(spriteShader, data);
      });

      gl.blendFunc(ctx.engine.blends.get()(0).src, ctx.engine.blends.get()(0).dst);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.flush();
    }

    const redraw = (dt: number) => {
      const canvas = canvasValue.get();
      if (!canvas) return;

      const [width, height] = ctl.getSize();
      const { offscreen } = glContext;
      offscreen.width = width;
      offscreen.height = height;

      time(app.timer.now());
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1.0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      draw(toRender.get(), ctl.camera.transform.get());

      canvas
        .getContext('bitmaprenderer')
        .transferFromImageBitmap(offscreen.transferToImageBitmap());

      ctl.moveForward((forwardDamper.get() + backDamper.get()) * 10 * dt);
      ctl.moveSideway((leftDamper.get() + rightDamper.get()) * 10 * dt);
    }

    const redrawTask = app.timer.onFrame(redraw);
    redrawTask.start();

    return new WindowBuilder('board-view', actionDescriptors, values)
      .titleFromId()
      .size(800, 600)
      .minSize(400, 400)
      .action('vis_inc', () => vis.mod(v => v * 2))
      .action('vis_dec', () => vis.mod(v => v / 2))
      .action('shadow_off_dec', () => shadowOff.mod(o => o - 1))
      .action('shadow_off_inc', () => shadowOff.mod(o => o + 1))
      .states(states)
      .disposable(redrawTask)
      .disposable(values)
      .disposable(state)
      .disposable(boardGl)
      .onClose(_ => disposeDrawData(all))
      .build(
        <UtilsContext.Provider value={{ picInfo, picRasterizer, alias: picnum => ctx.engine.aliases.get().get(picnum), viewPosition, boardCtx }}>
          <BoardViewWindow
            canvas={c => canvasValue.set(c)}
            states={states}
            board={board}
            ent={hitscan}
            drawData={toRender}
          />
        </UtilsContext.Provider>)
  });
}
