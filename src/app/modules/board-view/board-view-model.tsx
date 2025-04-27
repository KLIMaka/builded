import { WindowBuilder } from "@ui/windows-common";
import { Source, ValuesContainer, createContainer } from "@utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { getOrCreate, range } from "@utils/collections";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { drawToCanvas } from "@utils/imgutils";
import { Injector, getInstances } from "@utils/injector";
import { quadraticInterpolator } from "@utils/interpolator";
import { iter } from "@utils/iter";
import { int, memoize } from "@utils/mathutils";
import { fit, palRasterizer, transform } from "@utils/pixelprovider";
import { Stream } from "@utils/stream";
import { DelayedValue } from "@utils/timed";
import { Function, Result, first, pair } from "@utils/types";
import { ACTION_DESCRIPTORS, ActionDescriptors, StateChecker } from "app/apis/actions";
import { APP, App } from "app/apis/app1";
import { BoardContext, EngineContext, EngineSettings, GlBlend, RorLink } from "app/apis/engine";
import { UI, Window } from "app/apis/ui1";
import { Flip, NamedMessage, PanRepeat, Rotate } from "app/edit/messages";
import { EngineTextures } from "app/modules/gl/gl-context";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import { begin } from "app/modules/scheduler/work";
import { ArtRaster } from "build/artraster";
import { BloodBoard } from "build/blood/structs";
import { sectorWalls } from "build/board/loops";
import { findSector, sectorOfWall } from "build/board/query";
import { Board, Wall } from "build/board/structs";
import { VisResult, visitFromSector } from "build/boardvisitor";
import { EMPTY_ENTITY, Entity, EntityType } from "build/hitscan";
import { ZSCALE, build2gl, createSlopeCalculator, getPlayerStart, gl2build } from "build/utils";
import { mat4, vec2, vec3 } from "gl-matrix";
import React from "react";
import { LineRecord, NOOP_RENDERABLE, Renderable, SectorRecord, SpriteRecord, VoxelRecord, WallRecord, WallType, renderables } from "./api";
import { BoardRenderer3D, createRenderer3d } from "./boardRenderer3d";
import { createEntity, createHitscan, createSelection, createTargets, createTransform } from "./tools";
import { BoardViewWindow, UtilsContext } from "./ui/board-view-ui";
import { ViewPosition } from "./view";

type RorDrawData = {
  drawData: DrawData,
  diff: vec3,
}

type DrawData = {
  sectors: Renderable,
  walls: Renderable,
  sprites: Renderable,
  transSectors: Renderable,
  transWalls: Renderable,
  transSprites: Renderable,
  blendSprites: Map<number, Renderable>,
  voxels: Renderable,
  rors: RorDrawData[],
};

function disposeDrawData(data: DrawData) {
  data.sectors.dispose();
  data.walls.dispose();
  data.sprites.dispose();
  data.transSprites.dispose();
  data.transWalls.dispose();
  data.transSectors.dispose();
  data.blendSprites.values().forEach(s => s.dispose());
  data.voxels.dispose();
  data.rors.forEach(d => disposeDrawData(d.drawData));
}

function createViewPosition(values: ValuesContainer, ctl: Controller3D, boardCtx: BoardContext): Source<ViewPosition> {
  let lastSector = -1;
  return values.transformedTuple('viewPosition', [ctl.getPosition(), boardCtx.board], ([pos, board]) => {
    const [x, y, z] = gl2build(vec3.create(), pos);
    const { sec, x: nx, y: ny, z: nz } = findSector(board, boardCtx.tror, boardCtx.ror, x, y, z, lastSector);
    lastSector = sec;
    if (x !== nx || y !== ny || z !== nz) {
      const [nnx, nny, nnz] = build2gl(vec3.create(), vec3.fromValues(nx, ny, nz));
      ctl.setPosition(nnx, nny, nnz);
    }
    return { x: int(x), y: int(y), z: int(z), sec: lastSector } as ViewPosition
  });
}

function createToRender(renderer: Source<BoardRenderer3D>, boardCtx: BoardContext, engine: EngineContext, values: ValuesContainer, viewPosition: Source<ViewPosition>, fwd: Source<vec3>) {
  const all = values.transformedTuple('all', [boardCtx.board, renderer], ([board, renderer]) => createAll(renderer, board), { disposer: dd => disposeDrawData(dd) });
  return values.transformedTuple('toRender', [renderer, viewPosition, fwd, all, boardCtx.board], ([renderer, pos, forward, all, board]): DrawData => {
    if (pos.sec === -1) return all;
    const visibleRes = visitFromSector(pos, forward, board, boardCtx.tror, boardCtx.spritesBySector);
    return getDrawData(engine, board, boardCtx, renderer, visibleRes, pos, forward, new Set());
  },
    { disposer: dd => { if (dd !== all.get()) disposeDrawData(dd) } })
}

function getDrawData(engine: EngineContext, board: Board, boardCtx: BoardContext, renderer: BoardRenderer3D, result: VisResult, pos: ViewPosition, forward: vec3, visited: Set<number>): DrawData {
  const rorsArr: [number, RorLink][] = [];
  const sectorsArr: SectorRecord[] = [];
  const transSectorArr: SectorRecord[] = [];
  result.forSector(sectorId => {
    visited.add(sectorId);
    const sector = board.sectors[sectorId];
    const ceilingLink = boardCtx.ror.rorLinks.ceilLink(sectorId);
    if (ceilingLink?.transparent) rorsArr.push([sectorId, ceilingLink]);
    const floorLink = boardCtx.ror.rorLinks.floorLink(sectorId);
    if (floorLink?.transparent) rorsArr.push([sectorId, floorLink]);
    const transCeiling = sector.ceilingstat.type >= 2;
    const transFloor = sector.floorstat.type >= 2;
    if (transCeiling || transFloor) transSectorArr.push({ sectorId, ceiling: transCeiling, floor: transFloor });
    if (!transCeiling || !transFloor) sectorsArr.push({ sectorId, ceiling: !transCeiling, floor: !transFloor })
  });

  const transWallsArr: [WallRecord, number][] = [];
  const wallsArr: WallRecord[] = [];
  result.forWall((wallId, sectorId, dist) => {
    const wall = board.walls[wallId];
    if (wall.nextsector === -1) {
      wallsArr.push({ wallId, sectorId, type: WallType.VOID });
    } else {
      if (wall.cstat.masking || wall.cstat.oneWay) {
        if (wall.cstat.translucent || wall.cstat.translucentReversed) {
          wallsArr.push({ wallId, sectorId, type: WallType.NONMASKED });
          transWallsArr.push([{ wallId, sectorId, type: WallType.ONLY_MASKED }, dist]);
        } else wallsArr.push({ wallId, sectorId, type: WallType.MASKED });
      } else wallsArr.push({ wallId, sectorId, type: WallType.NONMASKED });
    }
  });

  const spritesArr: SpriteRecord[] = [];
  const transSpritesArr: [SpriteRecord, number][] = [];
  const blendSpritesMap = new Map<number, SpriteRecord[]>();
  const voxelsArr: VoxelRecord[] = [];
  result.forSprite((spriteId, dist) => {
    const sprite = board.sprites[spriteId];
    const voxelPicnum = sprite.picnum;
    const voxel = engine.spriteVoxelSwap.get()(voxelPicnum);
    if (voxel.isPresent()) voxelsArr.push({ spriteId, voxelPicnum });
    else {
      if (sprite.cstat.translucent || sprite.cstat.tranclucentReversed) {
        if (sprite.blend !== 0) getOrCreate(blendSpritesMap, sprite.blend, _ => []).push({ spriteId });
        else transSpritesArr.push([{ spriteId }, dist]);
      } else spritesArr.push({ spriteId });
    }
  });

  const sectors = renderer.writeSectors(sectorsArr);
  const walls = renderer.writeWalls(wallsArr);
  const sprites = renderer.writeSprites(spritesArr);
  const transWalls = renderer.writeWalls(transWallsArr.sort((l, r) => r[1] - l[1]).map(first));
  const transSprites = renderer.writeSprites(transSpritesArr.sort((l, r) => r[1] - l[1]).map(first));
  const transSectors = renderer.writeSectors(transSectorArr);
  const blendSprites = iter(blendSpritesMap.entries()).toMap(first, ([_, sprs]) => renderer.writeSprites(sprs));
  const voxels = renderer.writeVoxels(voxelsArr);
  const rors = rorsArr
    .filter(([, { dstSector }]) => !visited.has(dstSector))
    .map(([sectorId, { buildDiff, dstSector }]) => {
      const diff = build2gl(vec3.create(), buildDiff);
      const npos = vec3.sub(vec3.create(), vec3.fromValues(pos.x, pos.y, pos.z), buildDiff);
      const ms = { sec: dstSector, x: npos[0], y: npos[1], z: npos[2] }
      const result = visitFromSector(ms, forward, board, boardCtx.tror, boardCtx.spritesBySector);
      const drawData = getDrawData(engine, board, boardCtx, renderer, result, ms, forward, visited);
      return { diff, drawData };
    });

  return { sectors, sprites, walls, transSprites, transWalls, transSectors, blendSprites, voxels, rors };
}

const off = vec2.fromValues(-2.5, 2.5);
const size = vec2.fromValues(5, 5);
function getOverlay([hitscan, board, settings, renderer]: [Entity, Board, EngineSettings, BoardRenderer3D]) {
  const picnum = settings.pointPicnum;
  if (hitscan === EMPTY_ENTITY) return NOOP_RENDERABLE;
  if (hitscan.isSector()) {
    const sectorId = hitscan.id;
    const sector = board.sectors[sectorId];
    const ceiling = hitscan.type === EntityType.CEILING;
    const slope = createSlopeCalculator(board, sectorId, ceiling);
    const pos = memoize((wallId: number) => {
      const wall = board.walls[wallId];
      const z = slope(wall.x, wall.y) / ZSCALE;
      return vec3.fromValues(wall.x, z, wall.y);
    });
    const points = iter(range(sector.wallptr, sector.wallptr + sector.wallnum)).map(w => ({ picnum, pos: pos(w), off, size })).collect();
    const sectorR = renderer.writeSectorSelect([{ ceiling, floor: hitscan.type === EntityType.FLOOR, sectorId: hitscan.id }]);
    const contour: LineRecord[] = [];
    let fw = sector.wallptr;
    sectorWalls(board, sectorId).forEach(w => {
      const wall = board.walls[w];
      if (fw !== w) contour.push({ start: pos(w - 1), end: pos(w) });
      if (wall.point2 === fw) {
        contour.push({ start: pos(w), end: pos(fw) });
        fw = w + 1;
      }
    })
    return renderables(sectorR, renderer.writeLines(contour), renderer.writeScreenSprites(points));
  } else if (hitscan.isWall()) {
    const rs = iter([hitscan.id])
      .map(wallId => {
        const wall = board.walls[wallId];
        // const wall2 = board.walls[wall.point2];
        const sectorId = sectorOfWall(board, wallId);
        // const sector = board.sectors[sectorId];
        // const slope = createSlopeCalculator(board, sectorId);
        // const z1c = slope(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
        // const z1f = slope(wall.x, wall.y, sector.floorheinum) + sector.floorz;
        // const z2c = slope(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
        // const z2f = slope(wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
        return wall.nextsector === -1
          ? { wallId, sectorId, type: 0 }
          : hitscan.type === EntityType.MID_WALL
            ? { wallId, sectorId, type: 3 }
            : { wallId, sectorId, type: 1 }
        // return renderables(wallR, renderer.writeScreenSprites([
        //   { picnum, pos: vec3.fromValues(wall.x, z1c / -16, wall.y), off, size },
        //   { picnum, pos: vec3.fromValues(wall.x, z1f / -16, wall.y), off, size },
        //   { picnum, pos: vec3.fromValues(wall2.x, z2c / -16, wall2.y), off, size },
        //   { picnum, pos: vec3.fromValues(wall2.x, z2f / -16, wall2.y), off, size }]));
      }).collect();
    return renderer.writeWallSelect(rs);

  } else if (hitscan.isSprite()) {
    const sprite = board.sprites[hitscan.id];
    return renderer.writeScreenSprites([{ picnum, pos: vec3.fromValues(sprite.x, sprite.z / -16, sprite.y), off, size }]);
  }
  return NOOP_RENDERABLE;
}

async function loadBoardContext(ctx: EngineContext, mapName: string) {
  const resources = ctx.resources;
  const mapFile = await resources.get().read(mapName).then(o => o.orElseThrow(() => new Error(`Map ${mapName} not found`)));
  return ctx.loadBoard(new Stream(mapFile));
}

export async function createBoardView(injector: Injector, ctx: EngineContext, textures: EngineTextures, mapName: string): Promise<Result<Window>> {
  return createContainer('board-view').initializeAsync(async values => {
    values.handleStandalone([ctx.settings], settings => {
      textures.get(settings.fontPicnum).get();
      textures.get(settings.pointPicnum).get();
    });
    const [app, actionDescriptors, glContext, ui] = await getInstances(injector, APP, ACTION_DESCRIPTORS, GL_CONTEXT, UI);
    const task = app.scheduler.exec(begin()
      .thenPass('Loading map', () => loadBoardContext(ctx, mapName))
      .thenWorkPass(async (handle, boardCtx) => createRenderer3d(values, glContext, ctx, textures, boardCtx)(handle))
      .then('Creaate Window', async (boardCtx, renderer) => createWindow(values, ctx, boardCtx, renderer, glContext, app, actionDescriptors))
      .finishUntuple());
    return waitFor(ui, actionDescriptors, `Opening map ${mapName}`, task);
  });
}

function createAll(renderer: BoardRenderer3D, board: Board): DrawData {
  const sectors = renderer.writeSectors(iter(range(0, board.numsectors))
    .map(sectorId => ({ sectorId, ceiling: true, floor: true }))
    .collect());
  const wallType = (wall: Wall): WallType => wall.nextsector === -1 ? WallType.VOID : (wall.cstat.masking || wall.cstat.oneWay) ? WallType.MASKED : WallType.NONMASKED;
  const walls = renderer.writeWalls(iter(range(0, board.numsectors))
    .map(s => pair(board.sectors[s], s))
    .map(([sec, sectorId]) => iter(range(sec.wallptr, sec.wallptr + sec.wallnum))
      .map(wallId => ({ wallId, sectorId, type: wallType(board.walls[wallId]) }))
      .collect())
    .flatten()
    .collect());
  const sprites = renderer.writeSprites(iter(range(0, board.numsprites)).map(spriteId => ({ spriteId })).collect());
  return {
    sectors,
    walls,
    sprites,
    transSprites: NOOP_RENDERABLE,
    transWalls: NOOP_RENDERABLE,
    transSectors: NOOP_RENDERABLE,
    blendSprites: new Map(),
    voxels: NOOP_RENDERABLE,
    rors: []
  };
}

function createUtils(values: ValuesContainer, engine: EngineContext) {
  const rasterizer = values.transformed('pal-rasterizer', engine.pal, pal => palRasterizer(pal));
  const picRasterizer = values.transformedTuple('pic-rasterizer', [engine.artMap, engine.plus, rasterizer],
    ([art, plus, rasterizer]) => (picnum: number, pal: number, canvas: HTMLCanvasElement) => {
      const info = art.get(picnum);
      const p = iter(plus).first(p => p.id === pal).orElseGet(() => plus[0]).plu;
      drawToCanvas(transform(fit(128, 128, new ArtRaster(info), 255), c => c === 255 ? 255 : p[c]), canvas.getContext('2d'), rasterizer);
    });
  const picInfo = values.transformed('pic-info', engine.artMap, art => (picnum: number) => art.get(picnum));
  const alias = values.transformed('alias', engine.aliases, aliases => (picnum: number) => aliases.get(picnum));
  return { picRasterizer, picInfo, alias };
}

function drawImpl(renderer: BoardRenderer3D, gl: WebGL2RenderingContext, blends: Function<number, GlBlend>, rootView: mat4, data: DrawData, view: mat4) {
  data.rors.forEach(ror => {
    const view = mat4.translate(mat4.create(), rootView, ror.diff);
    drawImpl(renderer, gl, blends, rootView, ror.drawData, view)
  });

  renderer.view(view);

  data.walls.render(gl);
  data.sectors.render(gl);
  data.sprites.render(gl);
  data.voxels.render(gl);

  gl.enable(gl.BLEND);
  gl.blendFunc(blends(0).src, blends(0).dst);
  gl.depthMask(false);

  data.transSprites.render(gl);
  data.transWalls.render(gl);
  data.transSectors.render(gl);

  data.blendSprites.forEach((renderable, blend) => {
    gl.blendFunc(blends(blend).src, blends(blend).dst);
    renderable.render(gl);
  });

  gl.blendFunc(blends(0).src, blends(0).dst);
  gl.disable(gl.BLEND);
  gl.depthMask(true);
  gl.flush();
}

function drawOverlayImpl(gl: WebGL2RenderingContext, r: Renderable) {
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  r.render(gl);
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

function createWindow(values: ValuesContainer, engine: EngineContext, boardCtx: BoardContext, renderer: Source<BoardRenderer3D>, glContext: GlContext, app: App, actionDescriptors: ActionDescriptors): Window {
  values.handleStandalone([renderer], renderer => {
    renderer.depthShadowScale(1024);
    renderer.parallaxPics(boardCtx.parallaxPicnums);
  })
  const board = boardCtx.board.get();

  const sprite = getPlayerStart(board);
  const ctl = new Controller3D(values);
  values.handleStandalone([ctl.projection, renderer], ([proj, renderer]) => renderer.projection(proj));

  const [posx, posy, posz] = build2gl(vec3.create(), vec3.fromValues(sprite.x, sprite.y, sprite.z));
  ctl.setPosition(posx, posy, posz);
  const viewPosition = createViewPosition(values, ctl, boardCtx);
  const hitscan = createHitscan(values, ctl, viewPosition, engine.artMap, boardCtx);
  const targets = createTargets(values, hitscan);
  const entity = createEntity(values, targets);
  const selection = createSelection(values, entity, boardCtx);
  const moveState = values.value('move-state', false);
  const verticalState = values.value('vertical-state', false);
  const parallelState = values.value('parallel-state', false);
  createTransform(values, ctl, moveState, parallelState, verticalState, hitscan, selection);

  const mousemove = (e: MouseEvent) => ctl.track(e.offsetX, e.offsetY, lookaim);
  const canvasValue = values.valueBuilder<HTMLCanvasElement>({ name: 'canvasValue', value: undefined, disposer: c => c?.removeEventListener('mousemove', mousemove) });
  values.addSubscribed(canvasValue, c => { if (c) ctl.setSize(c.clientWidth, c.clientHeight) });
  values.addSubscribed(canvasValue, c => c?.addEventListener('mousemove', mousemove));

  const vis = values.value('vis', (board as BloodBoard).visibility ?? 512);
  values.handleStandalone([vis, renderer], ([vis, renderer]) => renderer.globalVis(vis));
  const shadowOff = values.value('shadow-mod', 0);
  values.handleStandalone([shadowOff, renderer], ([shadow, renderer]) => renderer.globalShadow(shadow));
  values.handleStandalone([boardCtx.grid.size, renderer], ([gridSize, renderer]) => renderer.grid(gridSize));

  const toRender = createToRender(renderer, boardCtx, engine, values, viewPosition, ctl.camera.forward);
  const overlay = values.transformedTuple('overlay', [entity, boardCtx.board, engine.settings, renderer], getOverlay, { disposer: dd => dd.dispose() })
  const utils = createUtils(values, engine);

  const actionsCtx = actionDescriptors.sub('board-view');
  const bind = (name: string) => actionsCtx.get(name).bind().get();
  const inter = quadraticInterpolator(0.8);
  const forwardDamper = new DelayedValue(500, 0, inter, app.timer);
  const backDamper = new DelayedValue(500, 0, inter, app.timer);
  const leftDamper = new DelayedValue(500, 0, inter, app.timer);
  const rightDamper = new DelayedValue(500, 0, inter, app.timer);
  let lookaim = false;
  const states: StateChecker[] = [
    { bind: bind('forward'), action: s => forwardDamper.set(s ? 1 : 0) },
    { bind: bind('back'), action: s => backDamper.set(s ? -1 : 0) },
    { bind: bind('strife-left'), action: s => leftDamper.set(s ? -1 : 0) },
    { bind: bind('strife-right'), action: s => rightDamper.set(s ? 1 : 0) },
    { bind: bind('lookaim'), action: s => lookaim = s },
    { bind: bind('move'), action: s => moveState.set(s) },
    { bind: bind('move-vertical'), action: s => verticalState.set(s) },
    { bind: bind('move-parallel'), action: s => parallelState.set(s) },
  ];

  const gl = glContext.gl;
  const draw = values.transformedTuple('draw', [engine.blends, toRender, ctl.camera.transform, renderer],
    ([blends, data, view, renderer]) => () => drawImpl(renderer, gl, blends, view, data, view));

  const redraw = (dt: number) => {
    const canvas = canvasValue.get();
    if (!canvas) return;

    const [width, height] = ctl.getSize();
    const { offscreen } = glContext;
    offscreen.width = width;
    offscreen.height = height;

    renderer.get().screenSize(width, height);
    renderer.get().time(app.timer.now());

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1.0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    draw.get()();
    drawOverlayImpl(gl, overlay.get());

    canvas
      .getContext('bitmaprenderer')
      .transferFromImageBitmap(offscreen.transferToImageBitmap());

    ctl.moveForward((forwardDamper.get() + backDamper.get()) * 10 * dt);
    ctl.moveSideway((leftDamper.get() + rightDamper.get()) * 10 * dt);
  }

  const redrawTask = app.timer.onFrame(redraw);
  redrawTask.onError(e => app.logger.log('ERROR', e));
  redrawTask.start();
  const actionsFactory = (desc: ActionDescriptors) => {
    return [
      desc.bindSync('undo', () => boardCtx.undo()),
      desc.bindSync('pan-up', () => selection.get().handle(new PanRepeat(0, 8, 0, 0, false))),
      desc.bindSync('pan-down', () => selection.get().handle(new PanRepeat(0, -8, 0, 0, false))),
      desc.bindSync('flip', () => selection.get().handle(new Flip())),
      desc.bindSync('delete', () => selection.get().handle(new NamedMessage('delete'))),
      desc.bindSync('up', () => selection.get().handle(new NamedMessage('up'))),
      desc.bindSync('down', () => selection.get().handle(new NamedMessage('down'))),
      desc.bindSync('rot-up', () => selection.get().handle(new Rotate(128))),
      desc.bindSync('rot-down', () => selection.get().handle(new Rotate(-128))),
      desc.bindSync('grid-inc', () => boardCtx.grid.incGridSize()),
      desc.bindSync('grid-dec', () => boardCtx.grid.decGridSize()),
    ];
  }

  return new WindowBuilder('board-view', actionDescriptors, values)
    .titleFromId()
    .size(800, 600)
    .minSize(400, 400)
    .action('vis_inc', () => vis.mod(v => v * 2))
    .action('vis_dec', () => vis.mod(v => v / 2))
    .action('shadow_off_dec', () => shadowOff.mod(o => o - 1))
    .action('shadow_off_inc', () => shadowOff.mod(o => o + 1))
    .actionsFactory(actionsFactory)
    .states(states)
    .disposable(redrawTask)
    .disposable(values)
    .disposable(boardCtx)
    .build(
      <UtilsContext.Provider value={{ ...utils, viewPosition, boardCtx, engine }}>
        <BoardViewWindow
          canvas={c => canvasValue.set(c)}
          states={states}
          board={boardCtx.board}
          ent={entity}
        />
      </UtilsContext.Provider>)
}
