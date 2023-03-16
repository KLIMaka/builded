import { art } from "build/artraster";
import { ArtInfoProvider } from "build/formats/art";
import h from "stage0";
import { createEmptyCanvas, clearCanvas, drawToCanvas } from "utils/imgutils";
import { fit, palRasterizer, Rasterizer, transform } from "utils/pixelprovider";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { ART, ArtProvider, BOARD, BoardProvider, View, VIEW } from "../apis/app";
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, Frame } from "../edit/messages";
import { Palette, RAW_PAL, RAW_PLUs } from "../modules/artselector"

type ArtRenderer = { canvas: HTMLCanvasElement, renderer: (picnum: number, pal: number) => void };
function artRenderer(arts: ArtInfoProvider, rasterizer: Rasterizer<number>, pals: Palette[]): ArtRenderer {
  const canvas = createEmptyCanvas(140, 140);
  const renderer = (picnum: number, pal: number) => {
    const info = arts.getInfo(picnum);
    if (info == null) {
      clearCanvas(canvas, 'white');
    } else {
      const raster = transform(fit(140, 140, art(info), 0), x => pals[pal].plu[x]);
      const ctx = canvas.getContext('2d');
      drawToCanvas(raster, ctx, rasterizer);
    }
  }
  return { canvas, renderer };
}

export async function InfoModule(module: Module) {
  module.bind(plugin('Info'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const info = await create(injector, Info, VIEW, BOARD, ART, RAW_PAL, RAW_PLUs);
    lifecycle(bus.connect(info), busDisconnector(bus));
    lifecycle(info, async i => i.stop());
  }));
}

const rowTemplate = h`<tr><td>#nameNode</td><td>#valueNode</td></tr>`;
function createRow(name: string): [Node, (v: any) => void] {
  const root = rowTemplate.cloneNode(true);
  const { nameNode, valueNode } = rowTemplate.collect(root);
  nameNode.nodeValue = name;
  const update = (v: any) => valueNode.nodeValue = v;
  return [root, update];
}

const rowsTemplate = h`<div><table class="table-striped"><thead><tr><th style="width:50px">Type</th><th>#type</th></tr></thead><tbody #table></tbody></table><div #pic style="padding:10px; position:absolute; bottom:0;"></div></div>`;
function createSprite(artRenderer: ArtRenderer): [HTMLElement, (id: number, sprite: Sprite) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table, pic } = rowsTemplate.collect(root);
  type.nodeValue = 'Sprite';
  const [id, idUpdater] = createRow("Id");
  const [pos, posUpdater] = createRow("Position");
  const [picnum, picnumUpdater] = createRow("Picnum");
  const [shade, shadeUpdater] = createRow("Shade");
  const [pal, palUpdater] = createRow("Palette");
  const [offset, offsetUpdater] = createRow("Offset");
  const [repeat, repeatUpdater] = createRow("Repeat");
  const [lotag, lotagUpdater] = createRow("Lo-Tag");
  const [hitag, hitagUpdater] = createRow("Hi-Tag");
  const [clipdist, clipdistUpdater] = createRow("Clip Dist");
  const [angle, angleUpdater] = createRow("Angle");
  const [realCenter, realCenterUpdater] = createRow("Real Center");
  const [xflip, xflipUpdater] = createRow("X Flip");
  const [yflip, yflipUpdater] = createRow("Y Flip");

  table.appendChild(id);
  table.appendChild(pos);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(repeat);
  table.appendChild(lotag);
  table.appendChild(hitag);
  table.appendChild(clipdist);
  table.appendChild(angle);
  table.appendChild(realCenter);
  table.appendChild(xflip);
  table.appendChild(yflip);
  pic.appendChild(artRenderer.canvas);
  return [root,
    (id: number, s: Sprite) => {
      idUpdater(id);
      picnumUpdater(s.picnum);
      shadeUpdater(s.shade);
      palUpdater(s.pal);
      offsetUpdater(`${s.xoffset}, ${s.yoffset}`);
      repeatUpdater(`${s.xrepeat}, ${s.yrepeat}`);
      posUpdater(`${s.x}, ${s.y}, ${s.z}`);
      lotagUpdater(s.lotag);
      hitagUpdater(s.hitag);
      clipdistUpdater(s.clipdist);
      angleUpdater(s.ang);
      realCenterUpdater(s.cstat.realCenter);
      xflipUpdater(s.cstat.xflip);
      yflipUpdater(s.cstat.yflip);
      artRenderer.renderer(s.picnum, s.pal);
    }];
}

function createWall(artRenderer: ArtRenderer): [HTMLElement, (id: number, wall: Wall, type: EntityType) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table, pic } = rowsTemplate.collect(root);
  type.nodeValue = 'Wall';
  const [id, idUpdater] = createRow("Id");
  const [pos, posUpdater] = createRow("Position");
  const [picnum, picnumUpdater] = createRow("Picnum");
  const [shade, shadeUpdater] = createRow("Shade");
  const [pal, palUpdater] = createRow("Palette");
  const [offset, offsetUpdater] = createRow("Offset");
  const [repeat, repeatUpdater] = createRow("Repeat");
  const [lotag, lotagUpdater] = createRow("Lo-Tag");
  const [hitag, hitagUpdater] = createRow("Hi-Tag");
  const [blocking, blockingUpdater] = createRow("Blocking");
  const [swapBottoms, swapBottomsUpdater] = createRow("Swap Bottoms");
  const [alignBottom, alignBottomUpdater] = createRow("Align Bottom");
  const [xflip, xflipUpdater] = createRow("X Flip");
  const [masking, maskingUpdater] = createRow("Masking");
  const [oneWay, oneWayUpdater] = createRow("One Way");
  const [blocking2, blocking2Updater] = createRow("Hit Scan");
  const [translucent, translucentUpdater] = createRow("Translucent");
  const [yflip, yflipUpdater] = createRow("Y Flip");
  const [translucentReversed, translucentReversedUpdater] = createRow("Translucent 2");
  table.appendChild(id);
  table.appendChild(pos);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(repeat);
  table.appendChild(lotag);
  table.appendChild(hitag);
  table.appendChild(blocking);
  table.appendChild(swapBottoms);
  table.appendChild(alignBottom);
  table.appendChild(xflip);
  table.appendChild(masking);
  table.appendChild(oneWay);
  table.appendChild(blocking2);
  table.appendChild(translucent);
  table.appendChild(yflip);
  table.appendChild(translucentReversed);
  pic.appendChild(artRenderer.canvas);
  return [root,
    (id: number, w: Wall, type: EntityType) => {
      idUpdater(id);
      posUpdater(`${w.x}, ${w.y}`);
      picnumUpdater(w.picnum);
      shadeUpdater(w.shade);
      palUpdater(w.pal);
      offsetUpdater(`${w.xpanning}, ${w.ypanning}`);
      repeatUpdater(`${w.xrepeat}, ${w.yrepeat}`);
      lotagUpdater(w.lotag);
      hitagUpdater(w.hitag);
      blockingUpdater(w.cstat.blocking);
      swapBottomsUpdater(w.cstat.swapBottoms);
      alignBottomUpdater(w.cstat.alignBottom);
      xflipUpdater(w.cstat.xflip);
      maskingUpdater(w.cstat.masking);
      oneWayUpdater(w.cstat.oneWay);
      blocking2Updater(w.cstat.blocking2);
      translucentUpdater(w.cstat.translucent);
      yflipUpdater(w.cstat.yflip);
      translucentReversedUpdater(w.cstat.translucentReversed);
      if (type == EntityType.MID_WALL && w.nextwall != -1) artRenderer.renderer(w.overpicnum, w.pal);
      else artRenderer.renderer(w.picnum, w.pal)
    }];
}

function createSector(artRenderer: ArtRenderer): [HTMLElement, (id: number, sector: Sector, type: EntityType) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table, pic } = rowsTemplate.collect(root);
  type.nodeValue = 'Sector';
  const [id, idUpdater] = createRow("Id");
  const [picnum, picnumUpdater] = createRow("Picnum");
  const [shade, shadeUpdater] = createRow("Shade");
  const [pal, palUpdater] = createRow("Palette");
  const [offset, offsetUpdater] = createRow("Offset");
  const [z, zUpdater] = createRow("Z");
  const [heinum, heinumUpdater] = createRow("Heinum");
  const [lotag, lotagUpdater] = createRow("Lo-Tag");
  const [hitag, hitagUpdater] = createRow("Hi-Tag");
  const [dubleRes, dubleResUpdater] = createRow("Double Res");
  const [swapXY, swapXYUpdater] = createRow("Swap XY");
  const [xflip, xflipUpdater] = createRow("X Flip");
  const [yflip, yflipUpdater] = createRow("Y Flip");
  const [aligned, alignedUpdater] = createRow("Aligned");
  table.appendChild(id);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(z);
  table.appendChild(heinum);
  table.appendChild(lotag);
  table.appendChild(hitag);
  table.appendChild(dubleRes);
  table.appendChild(swapXY);
  table.appendChild(xflip);
  table.appendChild(yflip);
  table.appendChild(aligned);
  pic.appendChild(artRenderer.canvas);
  return [root,
    (id: number, s: Sector, type: EntityType) => {
      const ceiling = type == EntityType.CEILING;
      idUpdater(id);
      picnumUpdater(ceiling ? s.ceilingpicnum : s.floorpicnum);
      shadeUpdater(ceiling ? s.ceilingshade : s.floorshade);
      palUpdater(ceiling ? s.ceilingpal : s.floorpal);
      offsetUpdater(ceiling ? `${s.ceilingxpanning}, ${s.ceilingypanning}` : `${s.floorxpanning}, ${s.floorypanning}`);
      zUpdater(ceiling ? s.ceilingz : s.floorz)
      heinumUpdater(ceiling ? s.ceilingheinum : s.floorheinum)
      lotagUpdater(s.lotag);
      hitagUpdater(s.hitag);
      dubleResUpdater((ceiling ? s.ceilingstat : s.floorstat).doubleSmooshiness);
      swapXYUpdater((ceiling ? s.ceilingstat : s.floorstat).swapXY);
      xflipUpdater((ceiling ? s.ceilingstat : s.floorstat).xflip);
      yflipUpdater((ceiling ? s.ceilingstat : s.floorstat).yflip);
      alignedUpdater((ceiling ? s.ceilingstat : s.floorstat).alignToFirstWall);
      artRenderer.renderer(ceiling ? s.ceilingpicnum : s.floorpicnum, ceiling ? s.ceilingpal : s.floorpal);
    }];
}


const NULL_ENT = new Entity(-1, EntityType.SPRITE);

export class Info extends MessageHandlerReflective {
  private sector: HTMLElement;
  private wall: HTMLElement;
  private sprite: HTMLElement;
  private sectorUpdate: (id: number, sector: Sector, type: EntityType) => void;
  private wallUpdate: (id: number, wall: Wall, type: EntityType) => void;
  private spriteUpdate: (id: number, sprite: Sprite) => void;
  private lastEnt: Entity = NULL_ENT;



  constructor(
    private view: View,
    private board: BoardProvider,
    private arts: ArtProvider,
    private pal: Uint8Array,
    private pals: Palette[],
  ) {
    super();
    const rasterizer = palRasterizer(pal);
    [this.sector, this.sectorUpdate] = createSector(artRenderer(arts, rasterizer, pals));
    [this.wall, this.wallUpdate] = createWall(artRenderer(arts, rasterizer, pals));
    [this.sprite, this.spriteUpdate] = createSprite(artRenderer(arts, rasterizer, pals));
    const panel = document.getElementById('info_panel');
    panel.appendChild(this.sector);
    panel.appendChild(this.wall);
    panel.appendChild(this.sprite);
  }

  public Frame(msg: Frame) {
    const ent = this.view.target().entity;
    const board = this.board();
    if (this.lastEnt.equals(ent)) return;
    this.lastEnt = ent == null ? NULL_ENT : ent;
    if (ent == null) {
      this.sector.classList.add('hidden');
      this.wall.classList.add('hidden');
      this.sprite.classList.add('hidden');
    } else if (ent.isSector()) {
      this.wall.classList.add('hidden');
      this.sprite.classList.add('hidden');
      this.sectorUpdate(ent.id, board.sectors[ent.id], ent.type);
      this.sector.classList.remove('hidden');
    } else if (ent.isSprite()) {
      this.wall.classList.add('hidden');
      this.sector.classList.add('hidden');
      this.spriteUpdate(ent.id, board.sprites[ent.id]);
      this.sprite.classList.remove('hidden');
    } else if (ent.isWall()) {
      this.sector.classList.add('hidden');
      this.sprite.classList.add('hidden');
      this.wallUpdate(ent.id, board.walls[ent.id], ent.type);
      this.wall.classList.remove('hidden');
    }
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    this.lastEnt = NULL_ENT;
  }

  public stop() {
    const panel = document.getElementById('info_panel');
    panel.removeChild(this.sector);
    panel.removeChild(this.wall);
    panel.removeChild(this.sprite);
  }
}