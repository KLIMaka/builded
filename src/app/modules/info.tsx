import { createState, Match, SetStateFunction, State, Switch } from "solid-js";
import { render } from "solid-js/dom";
import { Sector, Sprite, Wall } from "../../build/board/structs";
import { EntityType, isSector, isSprite, isWall } from "../../build/hitscan";
import { create, Injector } from "../../utils/injector";
import { BOARD, BoardProvider, View, VIEW } from "../apis/app";
import { BUS, MessageHandlerReflective } from "../apis/handler";
import { BoardInvalidate, Frame } from "../edit/messages";


export async function InfoModule(injector: Injector) {
  const bus = await injector.getInstance(BUS);
  bus.connect(await create(injector, Info, VIEW, BOARD))
}

const Row = (ref: { name: string, value: any }) => {
  return () => <tr>
    <td>{ref.name}</td>
    <td><span>{ref.value ? ref.value : ""}</span></td>
  </tr>
}

const SpriteProperties = (ref: { id: number, sprite: Sprite }) => {
  return () => <>
    <Row name="Type" value="Sprite" />
    <Row name="Id" value={ref.id} />
    <Row name="Picnum" value={ref.sprite?.picnum} />
    <Row name="Shade" value={ref.sprite?.shade} />
    <Row name="Palette" value={ref.sprite?.pal} />
    <Row name="Offset" value={`${ref.sprite?.xoffset ?? ''}, ${ref.sprite?.yoffset ?? ''}`} />
    <Row name="Repeat" value={`${ref.sprite?.xrepeat ?? ''}, ${ref.sprite?.yrepeat ?? ''}`} />
    <Row name="Z" value={ref.sprite?.z} />
  </>
}

const WallProperties = (ref: { id: number, wall: Wall }) => {
  return () => <>
    <Row name="Type" value="Wall" />
    <Row name="Id" value={ref.id} />
    <Row name="Picnum" value={ref.wall?.picnum} />
    <Row name="Shade" value={ref.wall?.shade} />
    <Row name="Palette" value={ref.wall?.pal} />
    <Row name="Panning" value={`${ref.wall?.xpanning ?? ''}, ${ref.wall?.ypanning ?? ''}`} />
    <Row name="Repeat" value={`${ref.wall?.xrepeat ?? ''}, ${ref.wall?.yrepeat ?? ''}`} />
  </>
}

const SectorProperties = (ref: { id: number, sector: Sector }) => {
  return () => <>
    <Row name="Type" value="Sector" />
    <Row name="Id" value={ref.id} />
    <Row name="Picnum" value={ref.sector?.floorpicnum} />
    <Row name="Shade" value={ref.sector?.floorshade} />
    <Row name="Palette" value={ref.sector?.floorpal} />
    <Row name="Panning" value={`${ref.sector?.floorxpanning ?? ''}, ${ref.sector?.floorypanning ?? ''}`} />
    <Row name="Z" value={ref.sector?.floorz} />
  </>
}

const InfoPanel = ({ state }: { state: InfoPanelState }) => {
  return () =>
    <Switch fallback={<Row name="Type" value="Value" />}>
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
  private state: State<InfoPanelState>;
  private setState: SetStateFunction<InfoPanelState>;

  constructor(
    private view: View,
    private board: BoardProvider
  ) {
    super();
    const [state, setState] = createState(new InfoPanelState(this.board));
    this.state = state;
    this.setState = setState;
    render(() => <InfoPanel state={state} />, document.getElementById('info_panel'));
  }

  public Frame(msg: Frame) {
    const ent = this.view.snapTarget().entity;
    if (ent == null) this.setState({ id: 0, type: null });
    else this.setState({ id: ent.id, type: ent.type });
  }

  public BoardInvalidate(msg: BoardInvalidate) {
    if (msg.ent == null) this.setState('type', this.state.type);
    else if (this.state.type == null) return;
    else if (msg.ent.id == this.state.id) this.setState('type', this.state.type);
  }
}