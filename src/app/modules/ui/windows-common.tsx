import { Action, ActionDescriptors, StateChecker } from "app/apis/actions";
import { Disconnector } from "app/apis/app";
import { Window } from "app/apis/ui";
import Optional from "optional-js";
import React, { ReactElement, useContext, useEffect, useRef } from "react";
import WinBox, { WinBoxPropType } from "react-winbox";
import { Disposable, Source, Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { getOrCreate } from "ts-utils/collections";
import { Id, UniqueIds } from "ts-utils/objects";
import { Consumer, Function, notNull, seq, Supplier } from "ts-utils/types";
import { ActionsChannelContext, CurrentActionsChannelContext, ValuesContainerContext } from "./commons";

class WindowImpl implements Window {
  constructor(
    public content: ReactElement,
    private winbox: Promise<WinBox>,
    private builder: WindowBuilder,
  ) { }

  async focus(): Promise<void> {
    const win = await this.winbox;
    win.winBoxObj?.focus();
  }

  onFocus(handle: Consumer<void>): Disconnector {
    this.builder._onFocus.add(handle);
    return () => this.builder._onFocus.delete(handle);
  }

  async close(force = false): Promise<void> {
    const win = await this.winbox;
    win.winBoxObj?.close(force);
  }

  onClose(handle: Consumer<boolean>): Disconnector {
    this.builder._onClose.add(handle);
    return () => this.builder._onClose.delete(handle);
  }

  async show(): Promise<void> {
    await this.winbox;
  }

  isModal(): boolean {
    return this.builder.props.modal ?? false;
  }
}

export type WindowSavedState = {
  position: SizeType,
  size: SizeType,
}

export type SizeType = [number | string, number | string];
const uniqueIds = new Map<string, UniqueIds>();
export class WindowBuilder {
  uniqueId: Id;
  uniqueName: string;
  props: WinBoxPropType = {};
  _size: Supplier<Value<SizeType>>;
  _position: Supplier<Value<SizeType>>;
  _actions: Action[] = [];
  _states: StateChecker[] = [];
  _onClose = new Set<Consumer<boolean>>();
  _onFocus = new Set<Consumer<void>>();

  constructor(
    public name: string,
    public actionDescriptors: ActionDescriptors,
    public values: ValuesContainer,
  ) {
    this.uniqueId = getOrCreate(uniqueIds, name, _ => new UniqueIds()).get();
    this.values.addDisposable(this.uniqueId);
    this.uniqueName = `${this.name}-${this.uniqueId.value}`;
    const sizeValue = values.value<SizeType>('size', [800, 800]);
    this._size = () => sizeValue;
    this.props.width = 800;
    this.props.height = 800;
    const positionValue = values.value<SizeType>('position', ['center', 'center'])
    this._position = () => positionValue;
    this.props.x = 'center';
    this.props.y = 'center';
    this.props.onResize = (w, h) => this._size().modImmer(d => { d[0] = w; d[1] = h });
    this.props.onMove = (x, y) => this._position().modImmer(d => { d[0] = x; d[1] = y });
    this.props.onClose = force => this._onClose.forEach(h => h(force));
    this.props.onFocus = () => this._onFocus.forEach(h => h());
  }

  state<T extends WindowSavedState>(def: ValuesMap<T>): this {
    this.sizeValue(def.get('size'));
    this.positionValue(def.get('position'));
    return this;
  }

  position(x: number | string, y: number | string): this {
    this._position().set([x, y]);
    this.props.x = x;
    this.props.y = y;
    return this;
  }

  private positionValue(position: Value<SizeType>): this {
    this.values.remove(this._position());
    this._position = () => position;
    const [x, y] = position.get();
    this.props.x = x;
    this.props.y = y;
    return this;
  }

  size(w: number, h: number): this {
    this.props.width = w;
    this.props.height = h;
    this._size().set([w, h]);
    return this;
  }

  private sizeValue(size: Value<SizeType>): this {
    this.values.remove(this._size());
    this._size = () => size;
    const [w, h] = size.get();
    this.props.width = w;
    this.props.height = h;
    return this;
  }

  titleFromId(): this {
    this.props.title = this.actionDescriptors.get(this.name).label().orElse(this.name);
    return this;
  }

  title(title: string): this {
    this.props.title = title;
    return this;
  }

  action(id: string, action: Consumer<void>, enabled?: Source<boolean>): this {
    this._actions.push(this.actionDescriptors.sub(this.name).bindSync(id, action, enabled));
    return this;
  }

  actions(actions: Action[]): this {
    actions.forEach(a => this._actions.push(a));
    return this;
  }

  actionsFactory(factory: Function<ActionDescriptors, Action[]>): this {
    return this.actions(factory(this.actionDescriptors.sub(this.name)));
  }

  states(states: StateChecker[]): this {
    states.forEach(s => this._states.push(s));
    return this;
  }

  onClose(disposer: Consumer<boolean>): this {
    this._onClose.add(disposer);
    return this;
  }

  disposable(disposable: Disposable): this {
    this._onClose.add(() => disposable.dispose());
    return this;
  }

  onFocus(handler: Consumer<void>): this {
    this._onFocus.add(handler);
    return this;
  }

  minSize(w: number, h: number): this {
    this.props.minWidth = w;
    this.props.minHeight = h;
    return this;
  }

  maxSize(w: number, h: number): this {
    this.props.maxWidth = w;
    this.props.maxHeight = h;
    return this;
  }

  modal(): this {
    this.props.modal = true;
    return this;
  }

  build(children: ReactElement): Window {
    const winboxPromise = Promise.withResolvers<WinBox>();
    const windowElement = <WindowCommon
      builder={this}
      windowConsumer={winboxPromise.resolve}
      children={children}
    />
    return new WindowImpl(windowElement, winboxPromise.promise, this);
  }
}

function WindowCommon(props: { builder: WindowBuilder, windowConsumer: Consumer<WinBox>, children: ReactElement }) {
  const winRef = useRef<WinBox>(null);
  const currentActions = useContext(CurrentActionsChannelContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const channel = actionsChannel.child(props.builder.uniqueName);

  useEffect(() => {
    props.windowConsumer(notNull(winRef.current));
    return seq(
      channel.collector().add(...props.builder._actions),
      channel.collector().addState(...props.builder._states)
    );
  }, [channel, props]);

  return (
    <ValuesContainerContext.Provider value={props.builder.values} >
      <ActionsChannelContext.Provider value={channel}>
        <WinBox
          ref={winRef}
          className="window"
          noFull={true}
          {...props.builder.props}
          onFocus={() => { currentActions(channel); props.builder.props.onFocus?.() }}
        >
          {props.children}
        </WinBox>
      </ActionsChannelContext.Provider>
    </ValuesContainerContext.Provider>)
}

export function modalResult<T>(close: Consumer<void>, result: Consumer<Optional<T>>): [Consumer<T | null>, Consumer<boolean>] {
  let resultWasSent = false;
  return [
    res => { resultWasSent = true; close(); result(Optional.ofNullable(res)) },
    () => { if (!resultWasSent) result(Optional.empty()) }
  ];
}