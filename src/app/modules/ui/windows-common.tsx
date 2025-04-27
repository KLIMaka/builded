import { Disposable, Source, Value, ValuesContainer } from "@utils/callbacks";
import { Consumer, Function, seq } from "@utils/types";
import { Action, ActionDescriptor, ActionDescriptors, StateChecker } from "app/apis/actions";
import { Disconnector } from "app/apis/app1";
import { Window } from "app/apis/ui1";
import Optional from "optional-js";
import React, { ReactElement, useContext, useEffect, useRef } from "react";
import WinBox, { WinBoxPropType } from "react-winbox";
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

  getId(): string {
    return this.builder.id;
  }
}

export type SizeType = [number | string, number | string];
export class WindowBuilder {
  props: WinBoxPropType = {};
  _size: Value<SizeType>;
  _position: Value<SizeType>;
  _actions: Action[] = [];
  _states: StateChecker[] = [];
  _onClose = new Set<Consumer<boolean>>();
  _onFocus = new Set<Consumer<void>>();

  constructor(
    public id: string,
    public actionDescriptors: ActionDescriptors,
    public values: ValuesContainer,
  ) {
    this._size = values.value('size', [800, 800]);
    this.props.width = this._size.get()[0];
    this.props.height = this._size.get()[1];
    this._position = values.value('positions', ['center', 'center']);
    this.props.x = this._position.get()[0];
    this.props.y = this._position.get()[1];
    this.props.onResize = (w, h) => this._size.modImmer(d => { d[0] = w; d[1] = h });
    this.props.onMove = (x, y) => this._position.modImmer(d => { d[0] = x; d[1] = y });
    this.props.onClose = forece => this._onClose.forEach(h => h(forece));
    this.props.onFocus = () => this._onFocus.forEach(h => h());
  }

  titleFromId(): this {
    this.props.title = this.actionDescriptors.get(this.id).label().orElse(this.id);
    return this;
  }

  title(title: string): this {
    this.props.title = title;
    return this;
  }

  position(x: number | string, y: number | string): this {
    this._position.set([x, y]);
    this.props.x = x;
    this.props.y = y;
    return this;
  }


  positionValue(position: Value<SizeType>): this {
    this._position = position;
    const [x, y] = position.get();
    this.props.x = x;
    this.props.y = y;
    return this;
  }

  size(w: number, h: number): this {
    this._size.set([w, h]);
    this.props.width = w;
    this.props.height = h;
    return this;
  }

  sizeValue(size: Value<SizeType>): this {
    this._size = size;
    const [w, h] = size.get();
    this.props.width = w;
    this.props.height = h;
    return this;
  }

  action(id: string, action: Consumer<void>, enabled?: Source<boolean>): this {
    this._actions.push(this.actionDescriptors.sub(this.id).bindSync(id, action, enabled));
    return this;
  }

  actions(actions: Action[]): this {
    actions.forEach(a => this._actions.push(a));
    return this;
  }

  actionsFactory(factory: Function<ActionDescriptors, Action[]>): this {
    return this.actions(factory(this.actionDescriptors.sub(this.id)));
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
  const winRef = useRef();
  const currentActions = useContext(CurrentActionsChannelContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const channel = actionsChannel.child(props.builder.id);

  useEffect(() => {
    props.windowConsumer(winRef.current);
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

export function modalResult<T>(close: Consumer<void>, result: Consumer<Optional<T>>): [Consumer<T>, Consumer<boolean>] {
  let resultWasSent = false;
  return [
    res => { resultWasSent = true; close(); result(Optional.ofNullable(res)) },
    () => { if (!resultWasSent) result(Optional.empty()) }
  ];
}