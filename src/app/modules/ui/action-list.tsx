import { iter } from '@utils/iter';
import { clamp } from '@utils/mathutils';
import * as React from 'react';
import { HTMLProps, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActionDescriptorsContext, ActionsChannelContext, styles } from './commons';
import { Consumer, nil, seq } from '@utils/types';

type ActionItemProps = {
  children: ReactNode,
  id: number,
  action: Consumer<void>,
  selected: boolean,
  disabled: boolean,
  active: number,
  setActive: Consumer<number>,
  stripped: boolean,
}


function ActionListItem({ children, id, action, selected, active, setActive, disabled, stripped }: ActionItemProps) {
  const actions: HTMLProps<HTMLDivElement> = disabled ? {} : { onClick: _ => action(), onMouseEnter: _ => setActive(id), onMouseLeave: _ => setActive(-1) }
  return (
    <div className={'action-list-item ' + styles({ selected, disabled, active: active === id, even: stripped && (id % 2 === 0) })} {...actions} >
      {children}
    </div>
  )
}

function scrollToView(parent: HTMLElement) {
  if (!parent) return;
  const parentRect = parent.getBoundingClientRect()
  const activeList = parent.getElementsByClassName('active');
  if (activeList.length !== 1) return;
  const [active] = activeList;
  const activeRect = active.getBoundingClientRect();
  if (activeRect.top < parentRect.top) active.scrollIntoView(true)
  else if (activeRect.bottom > parentRect.bottom) active.scrollIntoView(false);
}

export type ActionItem = { element: ReactNode, disabled?: boolean, action: Consumer<void>, selected?: boolean }
export function createActionItem(element: ReactNode, action: Consumer<void>, disabled?: boolean, selected?: boolean): ActionItem {
  return { element, action, disabled, selected }
}

export type ActionListProps = {
  items: ActionItem[],
  onAction?: Consumer<void>
  className?: string,
  stripped?: boolean,
}

export function ActionList(props: ActionListProps & HTMLProps<HTMLDivElement>) {
  const [active, setActive] = useState(-1);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const listContainerRef = useRef<HTMLDivElement>();
  const onAction = props.onAction ?? nil();
  const stripped = props.stripped ?? false;

  const moveActive = useCallback((current: number, off: number) => {
    const items = props.items;
    if (items.length === 0) return -1;
    const skipDisabled = (idx: number, dir: number, first = true) => {
      let ptr = idx;
      for (; ;) {
        if (!items[ptr].disabled) return ptr;
        if (dir > 0 && ptr >= items.length - 1) return first ? skipDisabled(idx, -dir, false) : idx;
        if (dir < 0 && ptr === 0) return first ? skipDisabled(idx, -dir, false) : idx;
        ptr += dir;
      }
    }
    const next = clamp(current + off, 0, props.items.length - 1);
    setTimeout(() => scrollToView(listContainerRef.current));
    return skipDisabled(next, Math.sign(off));
  }, [props.items])

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('list');
    const next = ctx.bindSync('next', () => setActive(i => moveActive(i, 1)))
    const prev = ctx.bindSync('prev', () => setActive(i => moveActive(i, -1)))
    const pgdwn = ctx.bindSync('next-page', () => setActive(i => moveActive(i, 10)))
    const pgup = ctx.bindSync('prev-page', () => setActive(i => moveActive(i, -10)))
    const select = ctx.bindSync('select', () => { props.items[active]?.action(); onAction() });
    return [next, prev, select, pgup, pgdwn];
  }, [actionDescriptors, active, moveActive, onAction, props.items]);

  useEffect(() => {
    return actionsChannel.collector().add(...createActions());
  }, [actionsChannel, createActions]);

  return (
    <div className={`actions-list ${props.className ?? ''}`} ref={listContainerRef} style={props.style}>
      {iter(props.items)
        .enumerate()
        .map(([item, i]) => <ActionListItem
          key={i}
          id={i}
          action={seq(item.action, onAction)}
          selected={item.selected}
          disabled={item.disabled}
          active={active}
          setActive={setActive}
          stripped={stripped}>
          {item.element}
        </ActionListItem>)
        .collect()}
    </div>
  )
}

export function ActionList1(props: ActionListProps & HTMLProps<HTMLDivElement>) {

}
