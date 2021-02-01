import h from "stage0";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
import { create, lifecycle, Module, plugin } from "../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../apis/app";
import { BUS, busDisconnector, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, Frame } from "../edit/messages";


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
  table.appendChild(id);
  table.appendChild(pos);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(repeat);
  return [root,
    (id: number, s: Sprite) => {
      idUpdater(id);
      picnumUpdater(s.picnum);
      shadeUpdater(s.shade);
      palUpdater(s.pal);
      offsetUpdater(`${s.xoffset}, ${s.yoffset}`);
      repeatUpdater(`${s.xrepeat}, ${s.yrepeat}`);
      posUpdater(`${s.x}, ${s.y}, ${s.z}`);
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
  table.appendChild(id);
  table.appendChild(pos);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(repeat);
  return [root,
    (id: number, w: Wall) => {
      idUpdater(id);
      posUpdater(`${w.x}, ${w.y}`);
      picnumUpdater(w.picnum);
      shadeUpdater(w.shade);
      palUpdater(w.pal);
      offsetUpdater(`${w.xpanning}, ${w.ypanning}`);
      repeatUpdater(`${w.xrepeat}, ${w.yrepeat}`);
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
  table.appendChild(id);
  table.appendChild(picnum);
  table.appendChild(shade);
  table.appendChild(pal);
  table.appendChild(offset);
  table.appendChild(z);
  table.appendChild(heinum);
  return [root,
    (id: number, s: Sector, ceiling: boolean) => {
      idUpdater(id);
      picnumUpdater(ceiling ? s.ceilingpicnum : s.floorpicnum);
      shadeUpdater(ceiling ? s.ceilingshade : s.floorshade);
      palUpdater(ceiling ? s.ceilingpal : s.floorpal);
      offsetUpdater(ceiling ? `${s.ceilingxpanning}, ${s.ceilingypanning}` : `${s.floorxpanning}, ${s.floorypanning}`);
      zUpdater(ceiling ? s.ceilingz : s.floorz)
      heinumUpdater(ceiling ? s.ceilingheinum : s.floorheinum)
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