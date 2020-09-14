import { createState, For, Match, SetStateFunction, Switch } from "solid-js";
import { render } from "solid-js/dom";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { Entity, EntityType, isSector, isSprite, isWall } from "../../build/hitscan";
import { create, Injector } from "../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../apis/app";
import { BUS, MessageHandlerReflective } from "../apis/handler";
import { Frame } from "../edit/messages";


export async function InfoModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Info, VIEW, BOARD))
}

const Rows = ({ rows }: { rows: { name: string, value: any }[] }) => {
  return () => <table class='table-striped'><tbody>
    <For each={rows}>
      {row => <Row {...row} />}
    </For>
  </tbody></table>
}

const Row = ({ name, value }: { name: string, value: any }) => {
  return () => <tr>
    <td>{name}</td>
    <td><span>{value ? value : ""}</span></td>
  </tr>
}

const SpriteProperties = (ref: { id: number, sprite: Sprite }) => {
  return () => <Rows rows={[
    { name: "Type", value: "Sprite" },
    { name: "Id", value: ref.id },
    { name: "Picnum", value: ref.sprite?.picnum },
    { name: "Shade", value: ref.sprite?.shade },
    { name: "Palette", value: ref.sprite?.pal },
    { name: "Offset", value: `${ref.sprite?.xoffset ?? ''}, ${ref.sprite?.yoffset ?? ''}` },
    { name: "Repeat", value: `${ref.sprite?.xrepeat ?? ''}, ${ref.sprite?.yrepeat ?? ''}` },
    { name: "Z", value: ref.sprite?.z },
  ]} />
}

const WallProperties = (ref: { id: number, wall: Wall }) => {
  return () => <Rows rows={[
    { name: "Type", value: 'Wall' },
    { name: "Id", value: ref.id },
    { name: "Picnum", value: ref.wall?.picnum },
    { name: "Shade", value: ref.wall?.shade },
    { name: "Palette", value: ref.wall?.pal },
    { name: "Panning", value: `${ref.wall?.xpanning ?? ''}, ${ref.wall?.ypanning ?? ''}` },
    { name: "Repeat", value: `${ref.wall?.xrepeat ?? ''}, ${ref.wall?.yrepeat ?? ''}` },
  ]} />
}

const SectorProperties = (ref: { id: number, sector: Sector }) => {
  return () => <Rows rows={[
    { name: "Type", value: "Sector" },
    { name: "Id", value: ref.id },
    { name: "Picnum", value: ref.sector?.floorpicnum },
    { name: "Shade", value: ref.sector?.floorshade },
    { name: "Palette", value: ref.sector?.floorpal },
    { name: "Panning", value: `${ref.sector?.floorxpanning ?? ''}, ${ref.sector?.floorypanning ?? ''}` },
    { name: "Z", value: ref.sector?.floorz },
  ]} />
}

const InfoPanel = ({ state }: { state: InfoPanelState }) => {
  return () =>
    <Switch fallback={<Rows rows={[{ name: "Type", value: "Value" }]} />}>
      <Match when={isSprite(state.type)}><SpriteProperties id={state.id} sprite={state.board().sprites[state.id]} /></Match>
      <Match when={isSector(state.type)}><SectorProperties id={state.id} sector={state.board().sectors[state.id]} /></Match>
      <Match when={isWall(state.type)}><WallProperties id={state.id} wall={state.board().walls[state.id]} /></Match>
    </Switch>
}


class InfoPanelState {
  public id: number;
  public type: EntityType;
  constructor(public board: BoardProvider) { }
}

export class Info extends MessageHandlerReflective {
  private setState: SetStateFunction<InfoPanelState>;
  private lastId: number;
  private lastType: EntityType;

  constructor(
    private view: View,
    private board: BoardProvider
  ) {
    super();
    const [state, setState] = createState(new InfoPanelState(this.board));
    this.setState = setState;
    render(() => <InfoPanel state={state} />, document.getElementById('info_panel'));
  }

  public Frame(msg: Frame) {
    const ent = this.view.snapTarget().entity;
    // if (this.check(ent)) return;
    if (ent == null) this.setState({ id: 0, type: null });
    else this.setState({ id: ent.id, type: ent.type });
  }

  // check(ent: Entity) {
  //   if (ent == null) return false;
  //   if (this.lastId != ent.id || this.lastType != ent.type) {
  //     this.setState('ent', null);
  //     this.lastId = ent.id;
  //     this.lastType = ent.type;
  //     return false;
  //   }
  //   return true;
  // }
}