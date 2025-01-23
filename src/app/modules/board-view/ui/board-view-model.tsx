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
import { Board } from "build/board/structs";
import { Entity, EntityType, Hitscan, Ray, hitscan } from "build/hitscan";
import { ZSCALE, build2gl, getPlayerStart, gl2build } from "build/utils";
import { vec3 } from "gl-matrix";
import React from "react";
import { AutoSizer } from "react-virtualized";
import { match } from "ts-pattern";
import { createRenderer3D } from "../boardrenderer3d";
import { ViewPosition } from "../view";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { GL_CONTEXT } from "@utils/gl/drawstruct";

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
  return <Column className="form-panel">
    <InfoRow label="Sector Id" value={props.ent.id} />
    <InfoRow label="Picnum" value={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
    <InfoRow label="Shade" value={props.ent.type === EntityType.CEILING ? sec.ceilingshade : sec.floorshade} />
    <InfoRow label="Pal" value={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} />
    <InfoRow label="Offset" value={props.ent.type === EntityType.CEILING ? `${sec.ceilingxpanning}, ${sec.ceilingypanning}` : `${sec.floorxpanning}, ${sec.floorypanning}`} />
    <InfoRow label="Z" value={props.ent.type === EntityType.CEILING ? sec.ceilingz : sec.floorz} />
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

    const art = ctx.engine.artMap;
    const bgl = await ctx.bgl();
    const cache = await ctx.cache(boardCtx);
    const renderer = createRenderer3D(bgl, boardCtx, cache);

    const sprite = getPlayerStart(board);
    const ctl = new Controller3D(values);
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

    const redraw = (dt: number) => {
      const canvas = canvasValue.get();
      if (!canvas) return;

      const [width, height] = ctl.getSize();
      const { offscreen } = glContext;
      offscreen.width = width;
      offscreen.height = height;
      bgl.setVisibility(vis.get());
      bgl.setShadowOffset(shadowOff.get());
      bgl.newFrame(width, height);
      renderer.draw({
        viewPosition: viewPosition.get(),
        forward: ctl.getForward(),
        position: ctl.getPosition().get(),
        transform: ctl.getTransformMatrix(),
        projection: ctl.getProjectionMatrix()
      });

      const target = hitscan.get()
      if (target !== null) {
        const renderable = match(target.type)
          .with(EntityType.SPRITE, () => [cache.helpers.sprite(target.id)])
          .with(EntityType.MID_WALL, () => [cache.helpers.wall(target.id).mid])
          .with(EntityType.LOWER_WALL, () => [cache.helpers.wall(target.id).bot])
          .with(EntityType.UPPER_WALL, () => [cache.helpers.wall(target.id).top])
          .with(EntityType.FLOOR, () => [cache.helpers.sector(target.id).floor])
          .with(EntityType.CEILING, () => [cache.helpers.sector(target.id).ceiling])
          .otherwise(() => []);
        renderer.drawTools(renderable);
      }

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
      .disposable(cache)
      .build(<BoardViewWindow
        canvas={c => canvasValue.set(c)}
        states={states}
        board={board}
        ent={hitscan}
      />)
  });
}
