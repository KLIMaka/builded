import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Signal, Value } from "ts-utils/callbacks";
import { nil, notNull, seq, Supplier } from "ts-utils/types";
import { ActionItem, ActionList } from "./action-list";
import { ActionsChannelContext, checkClickInside, Icon, UiContext, useValue } from "./commons";

export type SearchBoxProps = {
  value: Value<string>,
  channelName: string,
  width?: string,
  focusedWidth?: string,
  focusSignal?: Signal;
}

export function SearchBox(props: SearchBoxProps) {
  const { actionDescriptors, currentActions } = useContext(UiContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const width = props.width ?? '200px'
  const focusedWidth = props.focusedWidth ?? width;

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', () => inputRef.current?.blur());
    return [blurAction]
  }, [actionDescriptors]);

  useEffect(() => {
    return seq(
      props.focusSignal ? props.focusSignal.subscribe(() => inputRef.current?.focus()) : nil(),
      searchChannel.collector().add(...createActions())
    );
  }, [createActions, props.focusSignal, searchChannel])

  return (
    <ActionsChannelContext.Provider value={searchChannel}>
      <>
        <div
          ref={elementRef}
          style={{ width }}
          className='text-box baseline-aligned flex-auto row-block'>
          <Icon icon='magnifying-glass' />
          <input
            className='flex-fill'
            ref={inputRef}
            type='text'
            value={query}
            placeholder="Press '/'"
            onChange={e => props.value.set(e.target.value)}
            onFocus={_ => { currentActions(searchChannel); inputRef.current?.select(); notNull(elementRef.current).style.width = focusedWidth }}
            onBlur={_ => { currentActions(actionsChannel); notNull(elementRef.current).style.width = width }}
          />
          {query.length > 0
            ? <Icon icon='xmark' className='fa-active' onClick={_ => props.value.set('')} />
            : <></>
          }
        </div>
      </>
    </ActionsChannelContext.Provider>)
}

export function SearchBoxOracle(props: SearchBoxProps & { oracle: Supplier<ActionItem[]> }) {
  const { actionDescriptors, currentActions } = useContext(UiContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const blurInput = () => inputRef.current?.blur();
  const focusInput = () => inputRef.current?.focus();
  const width = props.width ?? '200px'
  const focusedWidth = props.focusedWidth ?? width;
  const listRef = useRef<HTMLDivElement>(null);

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', blurInput);
    // const suggestionsAction = ctx.bindSync('suggestions', () => setIsOpen(true));
    return [blurAction/*, suggestionsAction*/]
  }, [actionDescriptors]);

  useEffect(() => {
    const clickOutsideHandler = (e: PointerEvent) => { if (isOpen && !checkClickInside(e, listRef, inputRef)) setIsOpen(false) };
    document.addEventListener('pointerdown', clickOutsideHandler);
    return seq(
      () => document.removeEventListener('pointerdown', clickOutsideHandler),
      props.focusSignal ? props.focusSignal.subscribe(focusInput) : nil(),
      searchChannel.collector().add(...createActions())
    );
  }, [createActions, isOpen, props.focusSignal, searchChannel])

  return (
    <ActionsChannelContext.Provider value={searchChannel}>
      <>
        <div
          style={{ width: isOpen ? focusedWidth : width, ['anchorName' as any]: '--searchbox' }}
          className='text-box baseline-aligned flex-auto row-block'>
          <Icon icon='magnifying-glass' />
          <input
            className='flex-fill'
            ref={inputRef}
            type='text'
            value={query}
            placeholder="Press '/'"
            onChange={e => props.value.set(e.target.value)}
            onFocus={_ => { currentActions(searchChannel); inputRef.current?.select(); setIsOpen(true); }}
            onBlur={_ => { currentActions(actionsChannel); }}
          />
          {query.length > 0
            ? <Icon icon='xmark' className='fa-active' onClick={_ => props.value.set('')} />
            : <></>
          }
        </div>
        {isOpen && (
          <div
            ref={listRef}
            className="menu"
            style={{ position: 'absolute', zIndex: 99999, ['positionAnchor' as any]: '--searchbox', ['positionArea' as any]: 'bottom span-right', width: 'anchor-size(width)' }}
          >
            <ActionList items={props.oracle()} onAction={() => setIsOpen(false)} />
          </div>
        )}
      </>
    </ActionsChannelContext.Provider>)
}