import { wallStats } from "build/maploader";
import h from "stage0";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../apis/app";
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, Frame } from "../edit/messages";
import { Stream } from "../../utils/stream";


export async function InfoModule(module: Module) {
  module.bind(plugin('Info'), lifecycle(async (injector, lifecycle) => {
    const bus = await injector.getInstance(BUS);
    const info = await create(injector, Info, VIEW, BOARD);
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

const rowsTemplate = h`<table class="table-striped"><thead><tr><th style="width:50px">Type</th><th>#type</th></tr></thead><tbody #table></tbody></table>`;
function createSprite(): [HTMLElement, (id: number, sprite: Sprite) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table } = rowsTemplate.collect(root);
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
    }];
}

function createWall(): [HTMLElement, (id: number, wall: Wall) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table } = rowsTemplate.collect(root);
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
  return [root,
    (id: number, w: Wall) => {
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
    }];
}

function createSector(): [HTMLElement, (id: number, sector: Sector, ceiling: boolean) => void] {
  const root = <HTMLElement>rowsTemplate.cloneNode(true);
  const { type, table } = rowsTemplate.collect(root);
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
  return [root,
    (id: number, s: Sector, ceiling: boolean) => {
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
    }];
}


const NULL_ENT = new Entity(-1, EntityType.SPRITE);

export class Info extends MessageHandlerReflective {
  private sector: HTMLElement;
  private wall: HTMLElement;
  private sprite: HTMLElement;
  private sectorUpdate: (id: number, sector: Sector, ceiling: boolean) => void;
  private wallUpdate: (id: number, wall: Wall) => void;
  private spriteUpdate: (id: number, sprite: Sprite) => void;
  private lastEnt: Entity = NULL_ENT;



  constructor(
    private view: View,
    private board: BoardProvider
  ) {
    super();
    [this.sector, this.sectorUpdate] = createSector();
    [this.wall, this.wallUpdate] = createWall();
    [this.sprite, this.spriteUpdate] = createSprite();
    const panel = document.getElementById('info_panel');
    panel.appendChild(this.sector);
    panel.appendChild(this.wall);
    panel.appendChild(this.sprite);
  }

  public Frame(msg: Frame) {
    const ent = this.view.snapTarget().entity;
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
      this.sectorUpdate(ent.id, board.sectors[ent.id], ent.type == EntityType.CEILING);
      this.sector.classList.remove('hidden');
    } else if (ent.isSprite()) {
      this.wall.classList.add('hidden');
      this.sector.classList.add('hidden');
      this.spriteUpdate(ent.id, board.sprites[ent.id]);
      this.sprite.classList.remove('hidden');
    } else if (ent.isWall()) {
      this.sector.classList.add('hidden');
      this.sprite.classList.add('hidden');
      this.wallUpdate(ent.id, board.walls[ent.id]);
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