import { Disconnector, Source, Value, ValuesContainer } from 'ts-utils/callbacks';
import { getOrCreate } from 'ts-utils/collections';
import { iter } from 'ts-utils/iter';
import { Consumer, MultiConsumer, MultiFunction, Supplier, identity, nil, seq } from 'ts-utils/types';
import { Action, ActionDescriptors, ActionsProvider, StateChecker } from 'app/apis/actions';
import { Bind } from 'app/input/keymap';
import React, { ForwardedRef, HTMLProps, MouseEventHandler, ReactNode, RefObject, createContext, forwardRef, useContext, useRef, useSyncExternalStore } from 'react';
import { AutoSizer } from 'react-virtualized';
import { ActionItem } from './action-list';
import { Values } from 'app/apis/values';
import { progress } from 'ts-utils/scheduler';

export const Column = forwardRef(function Column({ children, className, ...rest }: React.HTMLProps<HTMLDivElement> & { className?: string }, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} {...rest} className={`column-block ${className ?? ''}`}>
      {children}
    </div>)
})

export const Row = forwardRef(function Row({ children, className, ...rest }: React.HTMLProps<HTMLDivElement> & { className?: string }, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} {...rest} className={`row-block ${className ?? ''}`} >
      {children}
    </div>)
})

export type SizedTextProps = { text: string, size: string }
export const SizedText = forwardRef(function SizedText(props: SizedTextProps, ref: ForwardedRef<HTMLDivElement>) {
  return (<div ref={ref} style={{ width: props.size }}>{props.text}</div>)
})

export const Icon = forwardRef(function Icon({ icon, type, ...rest }: React.HTMLProps<HTMLDivElement> & { icon: string, type?: 'solid' | 'regular' }, ref: ForwardedRef<HTMLDivElement>) {
  return <div ref={ref} {...rest} className={`fa-${type ?? 'solid'} fa-${icon} ${rest.className ?? ''}`} ></div>
})

export const Button = forwardRef(function Button({ ...rest }: React.HTMLProps<HTMLDivElement>, ref: ForwardedRef<HTMLDivElement>) {
  return <div ref={ref} {...rest} className={`button ${rest.className ?? ''}`} />
})

export const ToggleButton = forwardRef(function ToggleButton({ icon, pressedValue, children, ...rest }: React.HTMLProps<HTMLDivElement> & { icon?: string, pressedValue: Value<boolean> }, ref: ForwardedRef<HTMLDivElement>) {
  const pressed = useValue(pressedValue);
  return (
    <div
      ref={ref}
      {...rest}
      className={`row-block button gap-5 flex-auto ${rest.className ?? ''} ${pressed ? 'active' : ''}`}
      onClick={_ => pressedValue.mod(p => !p)}
    >
      {icon ? <div className={`fa-solid fa-${icon}`} /> : <></>}
      {children}
    </div>)
})

export function NonwrapLabel(props: { label: any }) {
  return <div className='flex-fill nonwrap-row-block-item' title={props.label}>{props.label}</div>
}

export function TextHeight() {
  return <div style={{ width: "0px" }}>&nbsp;</div>;
}

export type TextInputProps = {
  name: string,
  value: Value<string>,
}
export function TextInput(props: TextInputProps) {
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const searchChannel = actionsChannel.child(`input-text-${props.name}`, true);

  const ref = useRef<HTMLInputElement>(null);
  const value = useValue(props.value);

  return (<ActionsChannelContext.Provider value={searchChannel}>
    <div className="text-box flex-fill">
      <input
        className="flex-fill"
        ref={ref}
        type="text"
        value={value}
        onChange={e => props.value.set(e.target.value)}
        onFocus={_ => currentActions(searchChannel)}
        onBlur={_ => currentActions(actionsChannel)}
      />
    </div>
  </ActionsChannelContext.Provider>)
}

export function ActionButton({ action }: { action: Action }) {
  const enabled = useValue(action.enabled);
  const onClick: HTMLProps<HTMLDivElement> = !enabled ? {} : { onClick: _ => action.handler() }
  return (
    <div className={`row-block button flex-auto baseline-aligned gap-5 ${styles({ disabled: !enabled })}`} {...onClick} >
      {action.descriptor.icon().map(i => <Row className='baseline-aligned'><Icon icon={i} /><TextHeight /></Row>).orElse(<></>)}
      {action.descriptor.label().map(d => <div>{d}</div>).orElse(<></>)}
    </div>
  )
}

export function FieldValue(props: { label: string, value: Source<string> }) {
  const value = useValue(props.value);
  return <Row className='form-row'>
    <div className='form-row-label'>{props.label}</div>
    <div className='form-row-content'>{value}</div>
  </Row>
}

export function GroupItem({ label, selected, onSelected }: { label: string, selected: boolean, onSelected: MouseEventHandler }) {
  return (
    <div
      onClick={onSelected}
      className={`group-item-base vgroup-item group-label ${selected ? 'selected' : ''}`}>
      {label}
    </div>
  );
}

export function Group({ items, active }: { items: Source<string[]>, active: Value<string> }) {
  const itemsState = useValue(items);
  const selected = useValue(active);
  const groupItems = iter(itemsState)
    .enumerate()
    .map(([item, i]) => <GroupItem key={i} label={item} selected={item === selected} onSelected={_ => active.set(item)} />)
    .collect();
  return <div className='column-block padded-5 '>{groupItems}</div>
}

export type TabItem = {
  icon?: string,
  label: string,
  content: ReactNode
}

function TabButtons(props: { items: TabItem[], active: Value<number> }) {
  return <Row className='flex-auto'><Spacer /> <Row className='tabs'>
    {iter(props.items)
      .enumerate()
      .map(([t, i]) =>
        <Row key={i} className={`tab flex-auto gap-5 baseline-aligned ${styles({ active: props.active.get() === i })}`} onClick={_ => props.active.set(i)}>
          {t.icon ? <Icon icon={t.icon} /> : <></>}
          <div style={{ textWrap: 'nowrap' }} className='flex-fill'>{t.label}</div>
        </Row>)
      .collect()}
  </Row><Spacer /></Row>
}

export function Tabs(props: { items: TabItem[], active: Value<number> }) {
  const active = useValue(props.active);
  const activeItem = props.items[active];

  return <Column className='flex-fill tabs-container gap-5'>
    <TabButtons items={props.items} active={props.active} />
    {activeItem.content}
  </Column>
}


export function line(text: string): ActionItem {
  return {
    element: (<div className='row-block center-aligned'>
      <div className='line' />
      <div className='muted2 padded-10h'>{text}</div>
    </div>),
    action: nil(),
    disabled: true
  }
}

export function menuItemDescripted(title: string, desc: string, action: Consumer<void>): ActionItem {
  return {
    element: (<div className='row-block baseline-aligned'>
      <div className='flex-fill'>{title}</div>
      <div className='muted2'>{desc}</div>
    </div>),
    action
  }
}

function parseKey(key: string) {
  if (key === 'control') return 'Ctrl';
  return key?.toUpperCase();
}

function Key({ key1 }: { key1: string }) {
  return <div className='key'>{parseKey(key1)}</div>
}

function Plus() {
  return <div className='plus'>+</div>
}

export function KeyBind({ bind }: { bind: Bind }) {
  return (
    <div className='keybind'>
      {iter(bind.keys)
        .enumerate()
        .map(([k, i]) => <Key key={i} key1={k} />)
        .join(<Plus key='plus' />)
        .collect()}
    </div>
  )
}

export function ProgressBar(props: { progress: Source<number>, info: Source<string> }) {
  const progress = useValue(props.progress);
  const info = useValue(props.info);
  return <div className="flex-fill progress-container">
    <div className="progress-background" style={{ clipPath: `inset(0 0 0 ${progress}%)` }}><div className='progress-text'>{info}</div></div>
    <div className="progress-foreground" style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }} ><div className='progress-text'>{info}</div></div>
  </div>
}

export function actionsToActionItem(actions: Action[]): ActionItem[] {
  return actions.map(a => {
    const descr = a.descriptor;
    const action = a.handler;
    const element = (
      <div className='menu-item row-block'>
        {descr.icon().map(i => <div className={`fa-solid fa-fixwidth fa-${i}`}></div>).orElse(<></>)}
        <div className='flex-fill text-ellipsis text-stretch'>{descr.label().orElse('')}</div>
        {descr.bind().map(b => <KeyBind bind={b} />).orElse(<></>)}
      </div>
    )
    return { element, action }
  })
}

export function Spacer() {
  return <div className='flex-fill' />
}

export function styles<K extends keyof any>(input: Record<K, boolean>): string {
  return iter(Object.keys(input)).filter(k => (input as any)[k]).map(identity()).collect().join(' ');
}

export function asyncStateLoader<T>(loader: Supplier<Promise<T>>, consumer: Consumer<T>) {
  const load = async () => {
    const value = await loader();
    if (!ignore) consumer(value);
  }
  let ignore = false;
  load();
  return () => { ignore = true }
}

export class ActionsCollector implements ActionsProvider {
  private actionsSet = new Set<Action>();
  private statesSet = new Set<StateChecker>();

  add(...actions: Action[]): Disconnector {
    actions.forEach(a => this.actionsSet.add(a));
    return () => actions.forEach(a => this.actionsSet.delete(a));
  }

  addState(...states: StateChecker[]): Disconnector {
    states.forEach(a => this.statesSet.add(a));
    return () => states.forEach(a => this.statesSet.delete(a));
  }

  actions(): Iterable<Action> {
    return this.actionsSet;
  }

  states(): Iterable<StateChecker> {
    return this.statesSet;
  }
}

export function useValue<T>(value: Source<T>): T {
  // return useSyncExternalStore(l => { console.log(`${value.name} connected`); return seq(() => console.log(`${value.name} disconnected`), value.subscribe(l)) }, () => value.get());
  return useSyncExternalStore(l => value.subscribe(l), () => value.get());
}

export function useValuesContainer(name: string): ValuesContainer {
  const parentValues = useContext(ValuesContainerContext);
  const values = parentValues.createChild(`${name}-react`);
  return useSyncExternalStore(_ => () => values.dispose(), () => values);
}

export class ActionsNode implements ActionsProvider {
  constructor(
    private id: string,
    private parent: ActionsNode | null,
    private blocking = false,
    private actionsCollector = new ActionsCollector(),
    private children = new Map<string, ActionsNode>()
  ) { }

  child(id: string, blocking = false) {
    return getOrCreate(this.children, id, () => new ActionsNode(id, this, blocking, new ActionsCollector()));
  }

  collector() {
    return this.actionsCollector;
  }

  getParent() {
    return this.parent
  }

  isBlocking() {
    return this.blocking;
  }

  actions(): Iterable<Action> {
    return this.blocking || this.parent == null
      ? this.actionsCollector.actions()
      : iter(this.actionsCollector.actions()).chain(this.parent.actions())
  }

  states(): Iterable<StateChecker> {
    return this.blocking || this.parent == null
      ? this.actionsCollector.states()
      : iter(this.actionsCollector.states()).chain(this.parent.states())
  }
}

export const ActionsChannelContext = createContext<ActionsNode>(null as any as ActionsNode);
export const CurrentActionsChannelContext = createContext<Consumer<ActionsNode>>(null as any as Consumer<ActionsNode>);
export const ActionDescriptorsContext = createContext<ActionDescriptors>(null as any as ActionDescriptors);
export const ValuesContext = createContext<Values>(null as any as Values);
export const ValuesContainerContext = createContext<ValuesContainer>(null as any as ValuesContainer);


export function addEventListener<K extends keyof HTMLElementEventMap>(elem: HTMLElement, type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any): Disconnector {
  elem.addEventListener(type, listener);
  return () => elem.removeEventListener(type, listener);
}

export type WorkplaneBuilder = MultiConsumer<[HTMLCanvasElement | null, number, number]>;
export type WorkplaneContext = {
  xmouse: number,
  ymouse: number,
  xoff1: number,
  yoff1: number,
  xoff2: number,
  yoff2: number,
  scale: number,
  dragging: number,
  disable: boolean,
  buttons: number
}

export function defaultWorkplaneContext(def: Partial<WorkplaneContext>): WorkplaneContext {
  return {
    xmouse: 0,
    ymouse: 0,
    xoff1: 0,
    yoff1: 0,
    xoff2: 0,
    yoff2: 0,
    scale: 1,
    dragging: 0,
    disable: false,
    buttons: 0,
    ...def
  }
}

export function workplane(f: MultiFunction<[HTMLCanvasElement, number, number], Disconnector>): WorkplaneBuilder {
  let disconnector: Disconnector;
  return (canvas, width, height) => {
    disconnector?.();
    if (canvas != null) disconnector = f(canvas, width, height);
  }
}

export function workplaneController(ctx: Value<WorkplaneContext>): WorkplaneBuilder {
  function handleMouseMove(e: MouseEvent) {
    const ctxValue = ctx.get();
    const x = e.offsetX;
    const y = e.offsetY;
    if (ctxValue.dragging === 1) {
      const dx = x - ctxValue.xmouse;
      const dy = y - ctxValue.ymouse;
      ctx.modImmer(ctx => { ctx.xoff1 += dx; ctx.yoff1 += dy })
    }
    if (ctxValue.dragging === 2) {
      const dx = x - ctxValue.xmouse;
      const dy = y - ctxValue.ymouse;
      ctx.modImmer(ctx => { ctx.xoff2 += dx; ctx.yoff2 += dy })
    }
    ctx.modImmer(ctx => { ctx.xmouse = x; ctx.ymouse = y })
  }
  function handleWheel(e: WheelEvent) {
    ctx.modImmer(ctx => {
      const ds = e.deltaY > 0 ? (1 / 1.1) : e.deltaY < 0 ? 1.1 : 1;
      const x1 = ctx.xmouse / ctx.scale - ctx.xoff1 / ctx.scale;
      const y1 = ctx.ymouse / ctx.scale - ctx.yoff1 / ctx.scale;
      ctx.scale *= ds;
      const x2 = ctx.xmouse / ctx.scale - ctx.xoff1 / ctx.scale;
      const y2 = ctx.ymouse / ctx.scale - ctx.yoff1 / ctx.scale;
      ctx.xoff1 += (x2 - x1) * ctx.scale;
      ctx.yoff1 += (y2 - y1) * ctx.scale;
    })
  }
  function handleMouseButton(e: MouseEvent) {
    ctx.modImmer(c => c.buttons = e.buttons);
    if (!ctx.get().disable)
      ctx.modImmer(c => c.dragging = e.buttons)
  }
  return workplane((canvas, w, h) => {
    const moveD = addEventListener(canvas, 'mousemove', handleMouseMove);
    const wheelD = addEventListener(canvas, 'wheel', handleWheel);
    const mouseBtnDownD = addEventListener(canvas, 'mousedown', handleMouseButton);
    const mouseBtnUpD = addEventListener(canvas, 'mouseup', handleMouseButton);
    const contextD = addEventListener(canvas, 'contextmenu', e => e.preventDefault());
    return seq(moveD, wheelD, mouseBtnDownD, mouseBtnUpD, contextD);
  })
}

export function Workplane(props: { builders: WorkplaneBuilder[] }) {
  return (<div className='flex-fill'>
    <AutoSizer>
      {({ height, width }) => (<>{iter(props.builders)
        .enumerate()
        .map(([b, i]) =>
          <Plane width={width} height={height} builder={b} key={i} />
        ).collect()}</>)}
    </AutoSizer>
  </div>)
}


function Plane({ height, width, builder }: { height: number, width: number, builder: WorkplaneBuilder }) {
  return <canvas ref={ref => builder(ref, width, height)} height={height} width={width} style={{ position: 'absolute' }} />
}

export type GridMove = 'up' | 'down' | 'left' | 'right' | 'pageup' | 'pagedown';
export function getGridOff(move: GridMove, [cols, rows]: [number, number]): number {
  switch (move) {
    case "up": return -cols;
    case "down": return cols;
    case "left": return -1;
    case "right": return 1;
    case "pageup": return -cols * rows;
    case "pagedown": return cols * rows;
  }
}

export function checkClickInside(e: PointerEvent, ...refs: RefObject<HTMLElement>[]): boolean {
  const target = e.target as Node;
  return target !== null && iter(refs).any(r => r.current?.contains(target) ?? false)
}