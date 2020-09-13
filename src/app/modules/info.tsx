import { createState, For, Match, SetStateFunction, Switch } from "solid-js";
import { render } from "solid-js/dom";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { Entity, EntityType } from "../../build/hitscan";
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

class InfoPanelState {
  public type: string;

  public sectorId: number;
  public wallId: number;
  public spriteId: number;

  public sector: Sector;
  public wall: Wall;
  public sprite: Sprite;
}

const InfoPanel = ({ state }: { state: InfoPanelState }) => {
  return () =>
    <Switch fallback={<Rows rows={[{ name: "Type", value: "Value" }]} />}>
      <Match when={state.type === "sprite"}>
        <Rows rows={[
          { name: "Type", value: "Sprite" },
          { name: "Id", value: state.sectorId },
          { name: "Picnum", value: state.sprite?.picnum },
          { name: "Shade", value: state.sprite?.shade },
          { name: "Palette", value: state.sprite?.pal },
          { name: "Offset", value: `${state.sprite?.xoffset ?? ''}, ${state.sprite?.yoffset ?? ''}` },
          { name: "Repeat", value: `${state.sprite?.xrepeat ?? ''}, ${state.sprite?.yrepeat ?? ''}` },
          { name: "Z", value: state.sprite?.z },
        ]} />
      </Match>
      <Match when={state.type === "sector"}>
        <Rows rows={[
          { name: "Type", value: "Sector" },
          { name: "Id", value: state.sectorId },
          { name: "Picnum", value: state.sector?.floorpicnum },
          { name: "Shade", value: state.sector?.floorshade },
          { name: "Palette", value: state.sector?.floorpal },
          { name: "Panning", value: `${state.sector?.floorxpanning ?? ''}, ${state.sector?.floorypanning ?? ''}` },
          { name: "Z", value: state.sector?.floorz },
        ]} />
      </Match>
      <Match when={state.type === "wall"}>
        <Rows rows={[
          { name: "Type", value: 'Wall' },
          { name: "Id", value: state.wallId },
          { name: "Picnum", value: state.wall?.picnum },
          { name: "Shade", value: state.wall?.shade },
          { name: "Palette", value: state.wall?.pal },
          { name: "Panning", value: `${state.wall?.xpanning ?? ''}, ${state.wall?.ypanning ?? ''}` },
          { name: "Repeat", value: `${state.wall?.xrepeat ?? ''}, ${state.wall?.yrepeat ?? ''}` },
        ]} />
      </Match>
    </Switch>
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
    const [state, setState] = createState(new InfoPanelState());
    this.setState = setState;
    render(() => <InfoPanel state={state} />, document.getElementById('info_panel'));
  }

  public Frame(msg: Frame) {
    const ent = this.view.snapTarget().entity;
    if (ent == null) return;
    if (this.check(ent)) return;
    if (ent.isSprite()) {
      const sprite = this.board().sprites[ent.id];
      if (sprite == undefined) return;
      this.setState({ type: 'sprite', sprite: sprite, spriteId: ent.id });
    } else if (ent.isWall()) {
      const wall = this.board().walls[ent.id];
      if (wall == undefined) return;
      this.setState({ type: 'wall', wall: wall, wallId: ent.id });
    } else if (ent.isSector()) {
      const sector = this.board().sectors[ent.id];
      if (sector == undefined) return;
      this.setState({ type: 'sector', sector: sector, sectorId: ent.id });
    }
  }

  check(ent: Entity) {
    if (this.lastId != ent.id || this.lastType != ent.type) {
      this.setState('type', '');
      this.lastId = ent.id;
      this.lastType = ent.type;
      return false;
    }
    return true;
  }
}