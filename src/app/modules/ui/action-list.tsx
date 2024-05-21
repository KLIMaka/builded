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
  setActive: Consumer<number>
}


function ActionListItem({ children, id, action, selected, active, setActive, disabled }: ActionItemProps) {
  const actions: HTMLProps<HTMLDivElement> = disabled ? {} : { onClick: _ => action(), onMouseEnter: _ => setActive(id), onMouseLeave: _ => setActive(-1) }
  return (
    <div className={'action-list-item ' + styles({ selected, disabled, active: active === id })} {...actions} >
      {children}
    </div>
  )
}

function scrollToView(parent: HTMLElement) {
  const parentRect = parent.getBoundingClientRect()
  const activeList = parent.getElementsByClassName('active');
  if (activeList.length !== 1) return;
  const [active] = activeList;
  const activeRect = active.getBoundingClientRect();
  if (activeRect.top < parentRect.top) active.scrollIntoView(true)
  else if (activeRect.bottom > parentRect.bottom) active.scrollIntoView(false);
}

export type ActionItem = { element: ReactNode, disabled?: boolean, action: Consumer<void>, selected?: boolean }

export type ActionListProps = {
  items: ActionItem[],
  onAction?: Consumer<void>
}

export function ActionList(props: ActionListProps) {
  const [active, setActive] = useState(-1);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const listContainerRef = useRef<HTMLDivElement>();
  const onAction = props.onAction ?? nil();

  const moveActive = useCallback((current: number, off: number) => {
    const next = clamp(current + off, 0, props.items.length - 1);
    setTimeout(() => scrollToView(listContainerRef.current));
    return next;
  }, [props.items.length])

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('list');
    const next = ctx.bindSync('next', () => setActive(i => moveActive(i, 1)))
    const prev = ctx.bindSync('prev', () => setActive(i => moveActive(i, -1)))
    const select = ctx.bindSync('select', () => { props.items[active]?.action(); onAction() });
    return [next, prev, select];
  }, [actionDescriptors, active, moveActive, onAction, props.items]);

  useEffect(() => {
    return actionsChannel.collector().add(...createActions());
  }, [actionsChannel, createActions]);

  return (
    <div className='actions-list' ref={listContainerRef}>
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
        >
          {item.element}
        </ActionListItem>)
        .collect()}
    </div>
  )
}
