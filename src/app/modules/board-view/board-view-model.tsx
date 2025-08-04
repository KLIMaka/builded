import { WindowBuilder } from "@ui/windows-common";
import { Controller3D } from "@utils/camera/controller3d";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { ACTION_DESCRIPTORS, ActionDescriptors, StateChecker } from "app/apis/actions";
import { APP, App } from "app/apis/app1";
import { BoardContext, EMPTY_INFO_EXTENDED, EngineContext } from "app/apis/engine";
import { UI, Ui, Window } from "app/apis/ui1";
import { EngineTextures } from "app/modules/gl/gl-context";
import { waitFor } from "app/modules/scheduler/ui/task-propgress";
import { ArtRaster } from "build/artraster";
import { BloodBoard } from "build/blood/structs";
import { findSector } from "build/board/query";
import { Sector, Sprite, Wall } from "build/board/structs";
import { build2gl, getPlayerStart, gl2build, sectorNormal, wallNormal } from "build/utils";
import { vec3 } from "gl-matrix";
import React from "react";
import { Source, ValuesContainer, createContainer, disposer } from "ts-utils/callbacks";
import { getOrDefault, range } from "ts-utils/collections";
import { drawToCanvas } from "ts-utils/imgutils";
import { Injector, getInstances } from "ts-utils/injector";
import { quadraticInterpolator } from "ts-utils/interpolator";
import { iter } from "ts-utils/iter";
import { clamp, int } from "ts-utils/mathutils";
import { applyNotNullish } from "ts-utils/objects";
import { fit, palRasterizer, transform } from "ts-utils/pixelprovider";
import { Scheduler } from "ts-utils/scheduler";
import { Stream } from "ts-utils/stream";
import { DelayedValue } from "ts-utils/timed";
import { Result } from "ts-utils/types";
import { Work, begin } from "ts-utils/work";
import { createBoardGlContext } from "../gl/board-context";
import { Renderable } from "./api";
import { BoardRenderer3D } from "./boardRenderer3d";
import { createToRender, drawImpl } from "./draw-data";
import { getOverlay } from "./overlay";
import { createHitscan, createSelection, createSnapTarget, createTargets } from "./tools";
import { createDrawSectorTool } from "./tools/drawsector";
import { createTransform } from "./tools/transform";
import { createUtilsTool } from "./tools/utils";
import { BoardViewWindow, UtilsContext } from "./ui/board-view-ui";
import { ViewPosition } from "./view";

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

async function loadBoardContext(ctx: EngineContext, mapName: string) {
  const mapFile = await ctx.resources.get().read(mapName).then(o => o.orElseThrow(() => new Error(`Map ${mapName} not found`)));
  return ctx.loadBoard(new Stream(mapFile), mapName);
}

export async function createBoardView(injector: Injector, ctx: EngineContext, textures: EngineTextures, rendererProvider: Work<[], Source<BoardRenderer3D>>, mapName: string): Promise<Result<Window>> {
  return createContainer(`board-view`).initializeAsync(async values => {
    values.handleStandalone([ctx.settings], settings => {
      textures.get(settings.fontPicnum).get();
      textures.get(settings.pointPicnum).get();
    });
    const [app, actionDescriptors, glContext, ui] = await getInstances(injector, APP, ACTION_DESCRIPTORS, GL_CONTEXT, UI);
    const task = app.scheduler.exec(begin()
      .thenPass('Loading map', () => loadBoardContext(ctx, mapName))
      .forkPass(p => p
        .threadWork(rendererProvider)
        .threadWork(async (handle, boardCtx) => {
          const loadSectorTextures = (sector: Sector) => {
            textures.get(sector.ceilingpicnum, sector.ceilingstat.parallaxing ? boardCtx.parallaxPicnums : 1).get();
            textures.get(sector.floorpicnum, sector.floorstat.parallaxing ? boardCtx.parallaxPicnums : 1).get();
          }
          const loadSpriteTextures = (sprite: Sprite) => {
            textures.get(sprite.picnum).get()
            ctx.spriteVoxelSwap.get()(sprite.picnum).ifPresent(_ => textures.voxels.get()(sprite.picnum))
          }
          const loadWallTextures = (wall: Wall) => {
            textures.get(wall.picnum).get();
            textures.get(wall.overpicnum).get();
          }
          boardCtx.onSectorsChange(ss => ss.forEach(s => applyNotNullish(boardCtx.board.get().sectors[s], loadSectorTextures)));
          boardCtx.onSpritesChange(ss => ss.forEach(s => applyNotNullish(boardCtx.board.get().sprites[s], loadSpriteTextures)));
          boardCtx.onWallsChange(ws => ws.forEach(w => applyNotNullish(boardCtx.board.get().walls[w], loadWallTextures)));
          const tasks = iter(boardCtx.board.get().sectors).map(s => () => loadSectorTextures(s))
            .chain(iter(boardCtx.board.get().sprites).map(s => () => loadSpriteTextures(s)))
            .chain(iter(boardCtx.board.get().walls).map(w => () => loadWallTextures(w)))
            .collect();
          await handle.waitForBatchTask(tasks, 'Preloading textures');
          return []
        }))
      .then('Constructing window', async (boardCtx, [renderer]) => createWindow(values, ctx, boardCtx, renderer, glContext, app, ui, actionDescriptors, injector))
      .finishUntuple());
    return waitFor(ui, actionDescriptors, `Opening map ${mapName}`, task);
  });
}


function createUtils(values: ValuesContainer, engine: EngineContext) {
  const rasterizer = values.transformed('pal-rasterizer', engine.pal, pal => palRasterizer(pal));
  const picRasterizer = values.transformedTuple('pic-rasterizer', [engine.artMap, engine.plus, rasterizer],
    ([art, plus, rasterizer]) => (picnum: number, pal: number, canvas: HTMLCanvasElement) => {
      const info = getOrDefault(art, picnum, EMPTY_INFO_EXTENDED);
      const p = iter(plus).first(p => p.id === pal).orElseGet(() => plus[0]).plu;
      drawToCanvas(transform(fit(128, 128, new ArtRaster(info), 255), c => c === 255 ? 255 : p[c]), canvas.getContext('2d'), rasterizer);
    });
  const picInfo = values.transformed('pic-info', engine.artMap, art => (picnum: number) => getOrDefault(art, picnum, EMPTY_INFO_EXTENDED));
  const alias = values.transformed('alias', engine.aliases, aliases => (picnum: number) => aliases.get(picnum));
  return { picRasterizer, picInfo, alias };
}

function drawOverlayImpl(gl: WebGL2RenderingContext, ...rs: Renderable[]) {
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  rs.forEach(r => r.render(gl));
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

function shade(boardCtx: BoardContext, ctl: Controller3D): void {
  const dir = ctl.getForward();
  const sh = (x: number) => int(32 + clamp(x, -1, 0) * 64);
  boardCtx.modifyBoard('shade', board => {
    iter(range(0, board.numsectors)).forEach(s => {
      const cn = sectorNormal(vec3.create(), board, s, true);
      const fn = sectorNormal(vec3.create(), board, s, false);
      const cdot = vec3.dot(dir, cn);
      const fdot = vec3.dot(dir, fn);
      board.sectors[s].ceilingshade = sh(cdot);
      board.sectors[s].floorshade = sh(fdot);
    });
    iter(range(0, board.numwalls)).forEach(w => {
      const n = wallNormal(vec3.create(), board, w);
      const dot = vec3.dot(dir, n);
      board.walls[w].shade = sh(dot);
    })
  });
}

async function saveBoard(engine: EngineContext, boardCtx: BoardContext, ui: Ui, actionDescriptors: ActionDescriptors, scheduler: Scheduler) {
  await waitFor(ui, actionDescriptors, "Save", scheduler.exec(async () => {
    const writable = await engine.resources.get().writable();
    writable.ifPresent(async fs => fs.write(boardCtx.name, await boardCtx.save()))
  }));
}

function createWindow(values: ValuesContainer, engine: EngineContext, boardCtx: BoardContext, renderer: Source<BoardRenderer3D>, glContext: GlContext, app: App, ui: Ui, actionDescriptors: ActionDescriptors, injector: Injector): Window {
  values.handleStandalone([renderer], renderer => {
    renderer.depthShadowScale(1024);
    renderer.parallaxPics(boardCtx.parallaxPicnums);
  })
  const boardGlCtx = createBoardGlContext(values, glContext, boardCtx);
  const board = boardCtx.board.get();

  const sprite = getPlayerStart(board);
  const ctl = new Controller3D(values);

  const [posx, posy, posz] = build2gl(vec3.create(), vec3.fromValues(sprite.x, sprite.y, sprite.z));
  ctl.setPosition(posx, posy, posz);
  const viewPosition = createViewPosition(values, ctl, boardCtx);
  const hitscan = createHitscan(values, ctl, viewPosition, engine.artMap, boardCtx);
  const targets = createTargets(values, hitscan);
  const snapTarget = createSnapTarget(values, hitscan, boardCtx);
  // const entity = createEntity(values, targets);
  const entity = values.transformed('entyty', snapTarget, st => st.entity);
  const selection = createSelection(values, entity, boardCtx, engine);
  const moveState = values.value('move-state', false);
  const verticalState = values.value('vertical-state', false);
  const parallelState = values.value('parallel-state', false);
  const transform = createTransform(values, ctl, moveState, parallelState, verticalState, hitscan, selection, renderer);

  let lookaim = false;
  const mousemove = (e: MouseEvent) => ctl.track(e.offsetX, e.offsetY, lookaim);
  const canvasValue = values.valueBuilder<HTMLCanvasElement>({ name: 'canvasValue', value: undefined, disposer: c => c?.removeEventListener('mousemove', mousemove) });
  values.addSubscribed(canvasValue, c => { if (c) ctl.setSize(c.clientWidth, c.clientHeight) });
  values.addSubscribed(canvasValue, c => c?.addEventListener('mousemove', mousemove));

  const vis = values.value('vis', (board as BloodBoard).visibility ?? 512);
  const shadowOff = values.value('shadow-mod', 0);
  values.handleStandalone([vis, renderer], ([vis, renderer]) => renderer.globalVis(vis));
  values.handleStandalone([shadowOff, renderer], ([shadow, renderer]) => renderer.globalShadow(shadow));
  values.handleStandalone([boardCtx.grid.size, renderer], ([gridSize, renderer]) => renderer.grid(gridSize));

  const toRender = createToRender(renderer, boardCtx, boardGlCtx, engine, values, viewPosition, ctl.camera.forward);
  const overlay = values.transformedTuple('overlay', [entity, boardCtx.board, engine.settings, renderer, engine.aliases, engine.artMap], getOverlay(boardGlCtx), { disposer })
  const utils = createUtils(values, engine);
  const drawSectorTool = createDrawSectorTool(values, ctl, renderer, engine.settings, hitscan, boardCtx, engine);
  const utilsTool = createUtilsTool(boardCtx, selection, hitscan, engine, injector);

  const actionsCtx = actionDescriptors.sub('board-view');
  const bind = (name: string) => actionsCtx.get(name).bind().get();
  const inter = quadraticInterpolator(0.8);
  const forwardDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const backDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const leftDamper = new DelayedValue(250, 0, inter, app.timer.now);
  const rightDamper = new DelayedValue(250, 0, inter, app.timer.now);
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

  const redrawProc = values.transformedTuple('redraw', [ctl.size, ctl.projection, canvasValue, renderer, draw, overlay, drawSectorTool.renderable, transform],
    ([size, projection, canvas, renderer, draw, overlay, renderable, transform]) => (dt: number) => {
      if (!canvas) return;

      const [width, height] = size;
      const { offscreen } = glContext;
      offscreen.width = width;
      offscreen.height = height;

      renderer.screenSize(width, height);
      renderer.time(app.timer.now());
      renderer.projection(projection);

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1.0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      draw();
      drawOverlayImpl(gl, overlay, renderable, transform);

      canvas
        .getContext('bitmaprenderer')
        .transferFromImageBitmap(offscreen.transferToImageBitmap());

      ctl.moveForward((forwardDamper.get() + backDamper.get()) * 5 * dt);
      ctl.moveSideway((leftDamper.get() + rightDamper.get()) * 5 * dt);
    })

  const redrawTask = app.timer.onFrame(dt => redrawProc.get()(dt));
  redrawTask.onError(e => app.logger.log('ERROR', e));
  redrawTask.start();
  const actionsFactory = (desc: ActionDescriptors) => {
    return [
      desc.bindSync('undo', () => boardCtx.undo()),
      desc.bindSync('grid-inc', () => boardCtx.grid.incGridSize()),
      desc.bindSync('grid-dec', () => boardCtx.grid.decGridSize()),
      desc.bindSync('shade', () => shade(boardCtx, ctl)),
      desc.bind('save', async () => saveBoard(engine, boardCtx, ui, actionDescriptors, app.scheduler)),
      ...drawSectorTool.registerActions(desc),
      ...utilsTool.registerActions(desc)
    ];
  }

  return new WindowBuilder('board-view', actionDescriptors, values)
    .title(boardCtx.name)
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
    .disposable(boardGlCtx)
    .build(
      <UtilsContext.Provider value={{ ...utils, viewPosition, boardCtx, engine }}>
        <BoardViewWindow
          canvas={c => canvasValue.set(c)}
          states={states}
          board={boardCtx.board}
          ent={entity}
          ctl={ctl}
        />
      </UtilsContext.Provider>)
}

