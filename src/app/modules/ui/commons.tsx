import { Disconnector, Source, Value } from '@utils/callbacks';
import { getOrCreate } from '@utils/collections';
import { iter } from '@utils/iter';
import { Consumer, Supplier, identity, nil } from '@utils/types';
import { Action, ActionDescriptors, ActionsProvider } from 'app/apis/actions';
import { Bind } from 'app/input/keymap';
import * as React from 'react';
import { ForwardedRef, HTMLProps, MouseEventHandler, ReactNode, createContext, forwardRef, useSyncExternalStore } from 'react';
import { ActionItem } from './action-list';

export const Column = forwardRef(function Column({ children, className }: { children: ReactNode, className?: string }, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} className={`column-block ${className ?? ''}`}>
      {children}
    </div>
  )
})

export const Row = forwardRef(function Row({ children, className }: { children: ReactNode, className?: string }, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} className={`row-block ${className ?? ''}`}>
      {children}
    </div>
  )
})

export type SizedTextProps = { text: string, size: string }
export const SizedText = forwardRef(function SizedText(props: SizedTextProps, ref: ForwardedRef<HTMLDivElement>) {
  return (<div ref={ref} style={{ width: props.size }}>{props.text}</div>)
})

export const Empty = forwardRef(function Empty({ clazz }: { clazz: string }, ref: ForwardedRef<HTMLDivElement>) {
  return (<div ref={ref} className={clazz}></div>)
})

export type IconProps = { icon: string }
export const Icon = forwardRef(function Icon(props: IconProps, ref: ForwardedRef<HTMLDivElement>) {
  return <Empty ref={ref} clazz={`fa-solid fa-${props.icon}`} />
})

export const DropdownButton = forwardRef(function DropdownButton({ children, ...rest }: React.HTMLProps<HTMLDivElement>, ref: ForwardedRef<HTMLDivElement>) {
  return (
    <div ref={ref} {...rest} className={`row-block button baseline-aligned gap-5 flex-auto ${rest.className}`}>
      {children}
      <div className='fa-solid fa-angle-down' />
    </div>)
})

export function TextHeight() {
  return <div style={{ width: "0px" }}>&nbsp;</div>;
}

export function ActionButton({ action }: { action: Action }) {
  const enabled = useValue(action.enabled);
  const onClick: HTMLProps<HTMLDivElement> = !enabled ? {} : { onClick: _ => action.handler() }
  return (
    <div className={`row-block button flex-auto baseline-aligned gap-5 ${!enabled ? 'disabled' : ''}`} {...onClick} >
      {action.descriptor.icon().map(i => <Icon icon={i} />).orElse(<></>)}
      {action.descriptor.label().map(d => <div>{d}</div>).orElse(<TextHeight />)}
    </div>
  )
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

export function actionsToActionItem(actions: Action[]): ActionItem[] {
  return actions.map(a => {
    const descr = a.descriptor;
    const action = a.handler;
    const element = (
      <div className='menu-item row-block'>
        {descr.icon().map(i => <div className={`fa-solid fa-fixwidth fa-${i}`}></div>).orElse(<></>)}
        <div className='flex-fill'>{descr.label().orElse('')}</div>
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
  return iter(Object.keys(input)).filter(k => input[k]).map(identity()).collect().join(' ');
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

  add(...actions: Action[]): Disconnector {
    actions.forEach(a => this.actionsSet.add(a));
    return () => actions.forEach(a => this.actionsSet.delete(a));
  }

  actions(): Iterable<Action> {
    return this.actionsSet;
  }
}

export function useValue<T>(value: Source<T>) {
  return useSyncExternalStore(l => value.subscribe(l), () => value.get());
}

export class ActionsNode implements ActionsProvider {
  constructor(
    private id: string,
    private parent: ActionsNode,
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
}

export const ActionsChannelContext = createContext<ActionsNode>(null);
export const CurrentActionsChannelContext = createContext<Consumer<ActionsNode>>(null);
export const ActionDescriptorsContext = createContext<ActionDescriptors>(null);
