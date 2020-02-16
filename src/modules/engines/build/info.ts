import { Element, span, Table } from "../../ui/ui";
import { BuildContext } from "./api";
import { Frame } from "./edit/messages";
import { MessageHandlerReflective } from "./handlerapi";
import { Entity, EntityType } from "./hitscan";

export class Info extends MessageHandlerReflective {
  private wallTable: Element;
  private wallFields: { [index: string]: Element } = {};
  private sectorTable: Element;
  private sectorFields: { [index: string]: Element } = {};
  private spriteTable: Element;
  private spriteFields: { [index: string]: Element } = {};

  constructor() {
    super();
    this.prepareWallTable();
    this.prepareSectorTable();
    this.prepareSpriteTable();
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    this.clear();
    const ent = ctx.view.snapTarget().entity;
    if (ent == null) return;
    if (ent.isWall()) this.renderWall(ctx, ent.id);
    else if (ent.isSector()) this.renderSector(ctx, ent);
    else if (ent.isSprite()) this.renderSprite(ctx, ent.id);
  }

  private clear() {
    this.wallTable.css('display', 'none');
    this.sectorTable.css('display', 'none');
    this.spriteTable.css('display', 'none');
  }

  private renderSprite(ctx: BuildContext, id: number) {
    const sprite = ctx.board.sprites[id];
    this.spriteTable.css('display', '');
    this.spriteFields['id'].text(`${id}`);
    this.spriteFields['offset'].text(`${sprite.xoffset}, ${sprite.yoffset}`);
    this.spriteFields['repeat'].text(`${sprite.xrepeat}, ${sprite.yrepeat}`);
    this.spriteFields['shade'].text(`${sprite.shade}`);
    this.spriteFields['picnum'].text(`${sprite.picnum}`);
    this.spriteFields['pal'].text(`${sprite.pal}`);
    this.spriteFields['z'].text(`${sprite.z}`);
  }

  private renderSector(ctx: BuildContext, sectorEnt: Entity) {
    const id = sectorEnt.id;
    const type = sectorEnt.type;
    const sector = ctx.board.sectors[id];
    this.sectorTable.css('display', '');
    this.sectorFields['id'].text(`${id}`);
    if (type == EntityType.CEILING) {
      this.sectorFields['panning'].text(`${sector.ceilingxpanning}, ${sector.ceilingypanning}`);
      this.sectorFields['shade'].text(`${sector.ceilingshade}`);
      this.sectorFields['picnum'].text(`${sector.ceilingpicnum}`);
      this.sectorFields['pal'].text(`${sector.ceilingpal}`);
      this.sectorFields['z'].text(`${sector.ceilingz}`);
    } else {
      this.sectorFields['panning'].text(`${sector.floorxpanning}, ${sector.floorypanning}`);
      this.sectorFields['shade'].text(`${sector.floorshade}`);
      this.sectorFields['picnum'].text(`${sector.floorpicnum}`);
      this.sectorFields['pal'].text(`${sector.floorpal}`);
      this.sectorFields['z'].text(`${sector.floorz}`);
    }
  }

  private renderWall(ctx: BuildContext, id: number) {
    this.wallTable.css('display', '');
    const wall = ctx.board.walls[id];
    this.wallFields['id'].text(`${id}`);
    this.wallFields['panning'].text(`${wall.xpanning}, ${wall.ypanning}`);
    this.wallFields['repeat'].text(`${wall.xrepeat}, ${wall.yrepeat}`);
    this.wallFields['shade'].text(`${wall.shade}`);
    this.wallFields['picnum'].text(`${wall.picnum}`);
    this.wallFields['pal'].text(`${wall.pal}`);
  }

  private prepareWallTable() {
    const table = this.wallTable = new Table();
    table.className("table-striped");
    table.css('display', 'none');
    table.row([span().text('Type'), span().text('Wall')]);
    this.wallFields['id'] = span();
    this.wallFields['panning'] = span();
    this.wallFields['repeat'] = span();
    this.wallFields['shade'] = span();
    this.wallFields['picnum'] = span();
    this.wallFields['pal'] = span();
    table.row([span().text("Id"), this.wallFields['id']]);
    table.row([span().text("Picnum"), this.wallFields['picnum']]);
    table.row([span().text("Shade"), this.wallFields['shade']]);
    table.row([span().text("Palette"), this.wallFields['pal']]);
    table.row([span().text("Panning"), this.wallFields['panning']]);
    table.row([span().text("Repeat"), this.wallFields['repeat']]);
    document.getElementById('info_panel').appendChild(table.elem());
  }

  private prepareSectorTable() {
    const table = this.sectorTable = new Table();
    table.className("table-striped");
    table.css('display', 'none');
    table.row([span().text('Type'), span().text('Sector')]);
    this.sectorFields['id'] = span();
    this.sectorFields['panning'] = span();
    this.sectorFields['shade'] = span();
    this.sectorFields['picnum'] = span();
    this.sectorFields['pal'] = span();
    this.sectorFields['z'] = span();
    table.row([span().text("Id"), this.sectorFields['id']]);
    table.row([span().text("Picnum"), this.sectorFields['picnum']]);
    table.row([span().text("Shade"), this.sectorFields['shade']]);
    table.row([span().text("Palette"), this.sectorFields['pal']]);
    table.row([span().text("Panning"), this.sectorFields['panning']]);
    table.row([span().text("Z"), this.sectorFields['z']]);
    document.getElementById('info_panel').appendChild(table.elem());
  }

  private prepareSpriteTable() {
    const table = this.spriteTable = new Table();
    table.className("table-striped");
    table.css('display', 'none');
    table.row([span().text('Type'), span().text('Sprite')]);
    this.spriteFields['id'] = span();
    this.spriteFields['offset'] = span();
    this.spriteFields['repeat'] = span();
    this.spriteFields['shade'] = span();
    this.spriteFields['picnum'] = span();
    this.spriteFields['pal'] = span();
    this.spriteFields['z'] = span();
    table.row([span().text("Id"), this.spriteFields['id']]);
    table.row([span().text("Picnum"), this.spriteFields['picnum']]);
    table.row([span().text("Shade"), this.spriteFields['shade']]);
    table.row([span().text("Palette"), this.spriteFields['pal']]);
    table.row([span().text("Offset"), this.spriteFields['offset']]);
    table.row([span().text("Repeat"), this.spriteFields['repeat']]);
    table.row([span().text("Z"), this.spriteFields['z']]);
    document.getElementById('info_panel').appendChild(table.elem());
  }
}