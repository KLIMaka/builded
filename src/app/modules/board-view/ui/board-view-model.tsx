import { Column, Row, Spacer, useValue } from "@ui/commons";
import { WindowBuilder } from "@ui/windows-common";
import { Source, ValuesContainer, createContainer } from "@utils/callbacks";
import { Controller3D } from "@utils/camera/controller3d";
import { Injector, getInstances } from "@utils/injector";
import { quadraticInterpolator } from "@utils/interpolator";
import { int } from "@utils/mathutils";
import { Stream } from "@utils/stream";
import { DelayedValue } from "@utils/timed";
import { Consumer } from "@utils/types";
import { ACTION_DESCRIPTORS, StateChecker } from "app/apis/actions";
import { APP } from "app/apis/app1";
import { ArtInfoExtended, BoardContext } from "app/apis/engine";
import { Window } from "app/apis/ui1";
import { BuildGlEngineContext } from "app/modules/gl/buildgl";
import { BloodBoard } from "build/blood/structs";
import { findSector } from "build/board/query";
import { Board, SectorStats } from "build/board/structs";
import { Entity, EntityType, Hitscan, Ray, hitscan } from "build/hitscan";
import { ZSCALE, build2gl, getPlayerStart, gl2build } from "build/utils";
import { mat4, vec3 } from "gl-matrix";
import React from "react";
import { AutoSizer } from "react-virtualized";
import { match } from "ts-pattern";
import { createRenderer3D } from "../boardrenderer3d";
import { ViewPosition } from "../view";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { GL_CONTEXT } from "@utils/gl/drawstruct";
import { createBoardGlContext } from "app/modules/gl/board-context";
import { BufferAllocator, StateGl1 } from "@utils/gl/stategl1";
import { createShader } from "@utils/gl/shaders";
import { iter } from "@utils/iter";
import { groups, range } from "@utils/collections";
import { triangulate } from "app/modules/gl/geometry/builders/sector";
import { sectorStats } from "build/maploader";

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

function Sector(props: { ent: Entity, board: Board }) {
  const sec = props.board.sectors[props.ent.id];
  const buff = new ArrayBuffer(2);
  const view = new Uint16Array(buff);
  const stream = new Stream(buff);
  const getStat = (s: SectorStats) => { stream.setOffset(0); sectorStats.write(stream, s); return view[0] }
  return <Column className="form-panel">
    <InfoRow label="Sector Id" value={props.ent.id} />
    <InfoRow label="Picnum" value={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
    <InfoRow label="Shade" value={props.ent.type === EntityType.CEILING ? sec.ceilingshade : sec.floorshade} />
    <InfoRow label="Pal" value={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} />
    <InfoRow label="Offset" value={props.ent.type === EntityType.CEILING ? `${sec.ceilingxpanning}, ${sec.ceilingypanning}` : `${sec.floorxpanning}, ${sec.floorypanning}`} />
    <InfoRow label="Z" value={props.ent.type === EntityType.CEILING ? sec.ceilingz : sec.floorz} />
    <InfoRow label="Cstat" value={props.ent.type === EntityType.CEILING ? getStat(sec.ceilingstat) : getStat(sec.floorstat)} />
    <InfoRow label="Lo-Tag" value={sec.lotag} />
    <InfoRow label="Hi-Tag" value={sec.hitag} />
  </Column>
}

function Sprite(props: { ent: Entity, board: Board }) {
  const spr = props.board.sprites[props.ent.id];
  return <Column className="form-panel">
    <InfoRow label="Sprite Id" value={props.ent.id} />
    <InfoRow label="Picnum" value={spr.picnum} />
    <InfoRow label="Shade" value={spr.shade} />
    <InfoRow label="Pal" value={spr.pal} />
    <InfoRow label="Offset" value={`${spr.xoffset}, ${spr.yoffset}`} />
    <InfoRow label="Repeat" value={`${spr.xrepeat}, ${spr.yrepeat}`} />
    <InfoRow label="Lo-Tag" value={spr.lotag} />
    <InfoRow label="Hi-Tag" value={spr.hitag} />
  </Column>
}

function Wall(props: { ent: Entity, board: Board }) {
  return <></>
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

function Footer(props: { board: Board }) {
  return <div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{props.board.sectors.length} Sector(s) {props.board.walls.length} Wall(s) {props.board.sprites.length} Sprites(s)</div>
  </div>
}

function BoardViewWindow(props: { canvas: Consumer<HTMLCanvasElement>, states: StateChecker[], board: Board, ent: Source<Entity> }) {
  return (
    <Column>
      <PanelGroup direction={"horizontal"} className="flex-fill box-sized">
        <Panel className="column-block" defaultSize={80} minSize={10}>
          <Column>
            <View canvas={props.canvas} />
          </Column>
        </Panel>
        <PanelResizeHandle className="hspacer" />
        <Panel className="column-block padded-5" defaultSize={20} minSize={10}>
          <InfoPanel board={props.board} ent={props.ent} />
        </Panel>
      </PanelGroup>
      <Footer board={props.board} />
    </Column>
  );
}

function createViewPosition(values: ValuesContainer, ctl: Controller3D, board: Board): Source<ViewPosition> {
  let lastSector = -1;
  return values.transformed('viewPosition', ctl.getPosition(), pos => {
    const [x, y, z] = gl2build(vec3.create(), pos);
    lastSector = findSector(board, x, y, lastSector);
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
    const defs = ['PALSWAPS (' + (ctx.engine.maxPluId.get() + 1) + '.0)', 'SHADOWSTEPS (' + ctx.engine.shadowsteps.get() + '.0)'];
    state.register('wall-instance1', await createShader(glContext, 'resources/shaders/wall-instance1', [...defs]));
    state.register('sector-instance', await createShader(glContext, 'resources/shaders/sector-instance', [...defs]));
    const wallShader = state.getShader('wall-instance1');
    const sectorShader = state.getShader('sector-instance');
    const matrices = wallShader.uniformBlock('Matrices');
    const P = matrices.writer<[mat4]>('P');
    const V = matrices.writer<[mat4]>('V');
    const IV = matrices.writer<[mat4]>('IV');

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


    const wallData = (() => {
      const builder = wallShader.builder();
      const wallSectorPart = builder.vec4('aWallSectorPart_u16');
      builder.start();
      board.sectors.forEach((sec, s) => iter(range(sec.wallptr, sec.wallptr + sec.wallnum)).forEach(w => {
        const wall = board.walls[w];
        ctx.textures().get(wall.picnum).get();
        ctx.textures().get(wall.overpicnum).get();
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
      }));
      return builder.buildInstanced(WebGL2RenderingContext.TRIANGLE_STRIP, 4);
    })();

    const sectorData = (() => {
      const builder = sectorShader.builder();
      const pos12 = builder.vec4('aPos12');
      const pos3Sec = builder.vec4('aPos3Sec');
      builder.start();
      board.sectors.forEach((sec, s) => {
        ctx.textures().get(sec.ceilingpicnum).get();
        ctx.textures().get(sec.floorpicnum).get();
        const points = triangulate(board, s);
        for (const [p1, p2, p3] of groups(points, 3)) {
          pos12(p1[0], p1[1], p2[0], p2[1]);
          pos3Sec(p3[0], p3[1], s, 0);
          builder.writeVertex();
        }
      });
      return builder.buildInstanced(WebGL2RenderingContext.TRIANGLES, 6);
    })();

    const art = ctx.engine.artMap;

    const sprite = getPlayerStart(board);
    const ctl = new Controller3D(values);
    values.handleStandalone([ctl.projection], proj => P(proj));
    values.handleStandalone([ctl.camera.transform], view => { V(view); IV(mat4.invert(mat4.create(), view)) });

    const [posx, posy, posz] = build2gl(vec3.create(), vec3.fromValues(sprite.x, sprite.y, sprite.z + 1024 * ZSCALE));
    ctl.setPosition(posx, posy, posz);
    const viewPosition = createViewPosition(values, ctl, board);
    const hitscan = createHitscan(values, ctl, viewPosition, art, boardCtx)

    const mousemove = (e: MouseEvent) => ctl.track(e.offsetX, e.offsetY, e.buttons === 1);
    const canvasValue = values.valueBuilder<HTMLCanvasElement>({ name: 'canvasValue', value: undefined, disposer: c => c?.removeEventListener('mousemove', mousemove) });
    values.addSubscribed(canvasValue, c => { if (c) ctl.setSize(c.clientWidth, c.clientHeight) });
    values.addSubscribed(canvasValue, c => c?.addEventListener('mousemove', mousemove));

    const vis = values.value('vis', (board as BloodBoard).visibility ?? 512);
    const shadowOff = values.value('shadow-mod', 0);
    values.addSubscribed(vis, v => console.log(`vis = ${v}`));

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

    const redraw = (dt: number) => {
      const canvas = canvasValue.get();
      if (!canvas) return;

      const [width, height] = ctl.getSize();
      const { offscreen } = glContext;
      offscreen.width = width;
      offscreen.height = height;

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1.0);
      gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      state.drawInstanced(wallShader, wallData);
      state.drawInstanced(sectorShader, sectorData);

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
      .build(<BoardViewWindow
        canvas={c => canvasValue.set(c)}
        states={states}
        board={board}
        ent={hitscan}
      />)
  });
}
