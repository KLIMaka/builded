import { Axes } from "@ui/axes";
import { Column, Row, Spacer, useValue } from "@ui/commons";
import { Controller3D } from "@utils/camera/controller3d";
import { StateChecker } from "app/apis/actions";
import { ArtInfoExtended, BoardContext, EngineContext } from "app/apis/engine";
import { Board, SectorStats, SpriteStats, WallStats } from "build/board/structs";
import { EMPTY_ENTITY, Entity, EntityType } from "build/hitscan";
import React, { createContext, useContext, useEffect, useRef } from "react";
import { AutoSizer } from "react-virtualized";
import { Source } from "ts-utils/callbacks";
import { iter } from "ts-utils/iter";
import { objectKeys } from "ts-utils/objects";
import { Consumer } from "ts-utils/types";
import { ViewPosition } from "../view";

function InfoRow(props: { label: string, value: any }) {
  return <Row className='form-row'>
    <div className='form-row-label'>{props.label}</div>
    <div className='form-row-content'>{props.value}</div>
  </Row>
}

function View(props: { canvas: Consumer<HTMLCanvasElement | null>, }) {
  return <AutoSizer className="flex-fill" >
    {({ height, width }) => (
      <canvas tabIndex={1} height={height} width={width} ref={c => props.canvas(c)} />
    )}
  </AutoSizer>
}

type Utils = {
  picInfo: Source<(picnum: number) => ArtInfoExtended>,
  picRasterizer: Source<(picnum: number, pal: number, canvas: HTMLCanvasElement | null) => void>,
  alias: Source<(picnum: number) => string>,
  readonly viewPosition: Source<ViewPosition>,
  readonly boardCtx: BoardContext,
  readonly engine: EngineContext,
}

export const UtilsContext = createContext<Utils>(null as any as Utils);

function PicPreview(props: { picnum: number, pal: number }) {
  const utils = useContext(UtilsContext);
  const picInfo = useValue(utils.picInfo);
  const aliasInfo = useValue(utils.alias);
  const picRasterizer = useValue(utils.picRasterizer);
  const info = picInfo(props.picnum);
  const alias = aliasInfo(props.picnum);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => picRasterizer(props.picnum, props.pal, canvasRef.current));
  return <div>
    <div>{`Alias: ${alias}`}</div>
    <div>{`Size: ${info.w}x${info.h}`}</div>
    <div>{`Offs: ${info.attrs.xoff},${info.attrs.yoff}`}</div>
    <div>{`Type: ${info.attrs.type}`}</div>
    <div>{`File: ${info.artFile}`}</div>
    <canvas style={{ width: '128px', height: '128px' }} height={128} width={128} ref={canvasRef} />
  </div>
}

function SectorInfo(props: { ent: Entity, board: Board }) {
  const utils = useContext(UtilsContext);
  const sec = props.board.sectors[props.ent.id];
  const settings = useValue(utils.engine.settings);
  const getStat = (s: SectorStats) => iter(objectKeys(s)).filter(k => s[k] === 1 || s[k] === true).map(k => k.toString()).join(', ').collect()
  return <Column className="form-panel">
    <InfoRow label="Sector Id" value={props.ent.id} />
    <InfoRow label="Picnum" value={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
    <InfoRow label="Shade" value={props.ent.type === EntityType.CEILING ? sec.ceilingshade : sec.floorshade} />
    <InfoRow label="Pal" value={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} />
    <InfoRow label="Offset" value={props.ent.type === EntityType.CEILING ? `${sec.ceilingxpanning}, ${sec.ceilingypanning}` : `${sec.floorxpanning}, ${sec.floorypanning}`} />
    <InfoRow label="Z" value={props.ent.type === EntityType.CEILING ? sec.ceilingz : sec.floorz} />
    <InfoRow label="Cstat" value={props.ent.type === EntityType.CEILING ? getStat(sec.ceilingstat) : getStat(sec.floorstat)} />
    <InfoRow label="Lo-Tag" value={`${sec.lotag} ${settings.lotagSectorText(sec)} `} />
    <InfoRow label="Hi-Tag" value={sec.hitag} />
    <PicPreview pal={props.ent.type === EntityType.CEILING ? sec.ceilingpal : sec.floorpal} picnum={props.ent.type === EntityType.CEILING ? sec.ceilingpicnum : sec.floorpicnum} />
  </Column>
}

function SpriteInfo(props: { ent: Entity, board: Board }) {
  const utils = useContext(UtilsContext);
  const settings = useValue(utils.engine.settings);
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
    <InfoRow label="Statnum" value={spr.statnum} />
    <InfoRow label="Blend" value={spr.blend} />
    <InfoRow label="Lo-Tag" value={`${spr.lotag} ${settings.lotagSpriteText(spr)}`} />
    <InfoRow label="Hi-Tag" value={spr.hitag} />
    <PicPreview pal={spr.pal} picnum={spr.picnum} />
  </Column>
}

function getWallId(ent: Entity, board: Board): number {
  const refWall = board.walls[ent.id];
  return ent.type === EntityType.LOWER_WALL && refWall.cstat.swapBottoms
    ? refWall.nextwall
    : ent.id;
}

function WallInfo(props: { ent: Entity, board: Board }) {
  const { engine } = useContext(UtilsContext);
  const settings = useValue(engine.settings);
  const wallId = getWallId(props.ent, props.board);
  const wall = props.board.walls[wallId];
  const getStat = (s: WallStats) => iter(objectKeys(s)).filter(k => s[k] === 1).map(k => k.toString()).join(', ').collect();
  const picnum = (() => {
    if (wall.cstat.swapBottoms === 1 && props.ent.type === EntityType.LOWER_WALL)
      return props.board.walls[wall.nextwall].picnum;
    return wall.cstat.masking && props.ent.type === EntityType.MID_WALL ? wall.overpicnum : wall.picnum;
  })();
  return <Column className="form-panel">
    <InfoRow label="Wall Id" value={wallId} />
    <InfoRow label="Pos" value={`${wall.x}, ${wall.y}`} />
    <InfoRow label="Picnum" value={wall.picnum} />
    <InfoRow label="OPicnum" value={wall.overpicnum} />
    <InfoRow label="Shade" value={wall.shade} />
    <InfoRow label="Pal" value={wall.pal} />
    <InfoRow label="Pan" value={`${wall.xpanning}, ${wall.ypanning}`} />
    <InfoRow label="Repeat" value={`${wall.xrepeat}, ${wall.yrepeat}`} />
    <InfoRow label="Cstat" value={getStat(wall.cstat)} />
    <InfoRow label="Lo-Tag" value={`${wall.lotag} ${settings.lotagWallText(wall)}`} />
    <InfoRow label="Hi-Tag" value={wall.hitag} />
    <PicPreview pal={wall.pal} picnum={picnum} />
  </Column>
}

function InfoPanel(props: { board: Source<Board>, ent: Source<Entity> }) {
  const ent = useValue(props.ent);
  const board = useValue(props.board);
  if (ent === EMPTY_ENTITY) return <></>
  if (ent.isSector()) return <SectorInfo board={board} ent={ent} />;
  if (ent.isWall() || ent.isEdge()) return <WallInfo board={board} ent={ent} />;
  if (ent.isSprite()) return <SpriteInfo board={board} ent={ent} />
  return <></>;
}

function Footer(props: { board: Source<Board> }) {
  const utils = useContext(UtilsContext);
  const viewPos = useValue(utils.viewPosition);
  const board = useValue(props.board);
  return <div className='row-block window-footer flex-auto gap-5'>
    <Spacer />
    <div className='padded-5'>{board.sectors.length} Sector(s) {board.walls.length} Wall(s) {board.sprites.length} Sprites(s) {`x:${viewPos.x} y:${viewPos.y} z:${viewPos.z} sec:${viewPos.sec}`}</div>
  </div>
}

export function BoardViewWindow(props: { canvas: Consumer<HTMLCanvasElement | null>, states: StateChecker[], board: Source<Board>, ent: Source<Entity>, ctl: Controller3D }) {
  return (
    <Column>
      <Column>
        <View canvas={props.canvas} />
        <div style={{ position: 'absolute', right: 0, bottom: 0, padding: '5px', width: '200px' }} ><InfoPanel board={props.board} ent={props.ent} /></div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, padding: '5px' }} ><Axes cameraAngles={props.ctl.camera.angle} /></div>
      </Column>
      <Footer board={props.board} />
    </Column>
  );
}
