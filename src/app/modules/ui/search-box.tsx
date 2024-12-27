import { autoUpdate, FloatingPortal, size, useFloating, useFocus, useInteractions } from "@floating-ui/react";
import { Signal, Value } from "@utils/callbacks";
import { nil, seq, Supplier } from "@utils/types";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ActionItem, ActionList } from "./action-list";
import { ActionDescriptorsContext, ActionsChannelContext, CurrentActionsChannelContext, Icon, useValue } from "./commons";

export type SearchBoxProps = {
  value: Value<string>,
  channelName: string,
  width?: string,
  focusedWidth?: string,
  focusSignal?: Signal;
}

export function SearchBox(props: SearchBoxProps) {
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>();
  const elementRef = useRef<HTMLDivElement>();
  const width = props.width ?? '200px'
  const focusedWidth = props.focusedWidth ?? width;

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', () => inputRef.current.blur());
    return [blurAction]
  }, [actionDescriptors]);

  useEffect(() => {
    return seq(
      props.focusSignal ? props.focusSignal.subscribe(() => inputRef.current.focus()) : nil(),
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
            onFocus={_ => { currentActions(searchChannel); inputRef.current.select(); elementRef.current.style.width = focusedWidth }}
            onBlur={_ => { currentActions(actionsChannel); elementRef.current.style.width = width }}
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
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>();
  const elementRef = useRef<HTMLDivElement>();
  const [isOpen, setIsOpen] = useState(false);
  const blurInput = () => inputRef.current.blur();
  const focusInput = () => inputRef.current.focus();
  const width = props.width ?? '200px'
  const focusedWidth = props.focusedWidth ?? width;

  const { refs, floatingStyles, context } = useFloating<HTMLInputElement>({
    placement: "bottom-start",
    open: isOpen,
    onOpenChange: setIsOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
            minWidth: `${rects.reference.width}px`,
          })
        },
        padding: 10,
      }),
    ],
  });
  const focus = useFocus(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([focus]);

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', blurInput);
    // const suggestionsAction = ctx.bindSync('suggestions', () => setIsOpen(true));
    return [blurAction/*, suggestionsAction*/]
  }, [actionDescriptors]);

  useEffect(() => {
    return seq(
      props.focusSignal ? props.focusSignal.subscribe(focusInput) : nil(),
      searchChannel.collector().add(...createActions())
    );
  }, [createActions, props.focusSignal, searchChannel])

  return (
    <ActionsChannelContext.Provider value={searchChannel}>
      <>
        <div
          ref={ref => { refs.setReference(ref); elementRef.current = ref }}
          style={{ width }}
          {...getReferenceProps()}
          className='text-box baseline-aligned flex-auto row-block'>
          <Icon icon='magnifying-glass' />
          <input
            className='flex-fill'
            ref={inputRef}
            type='text'
            value={query}
            placeholder="Press '/'"
            onChange={e => props.value.set(e.target.value)}
            onFocus={_ => { currentActions(searchChannel); inputRef.current.select(); elementRef.current.style.width = focusedWidth; }}
            onBlur={_ => { currentActions(actionsChannel); elementRef.current.style.width = width }}
          />
          {query.length > 0
            ? <Icon icon='xmark' className='fa-active' onClick={_ => props.value.set('')} />
            : <></>
          }
        </div>
        {isOpen && (
          <FloatingPortal>
            <div
              className="menu"
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 99999 }}
              {...getFloatingProps()}
            >
              <ActionList items={props.oracle()} onAction={() => { setIsOpen(false); blurInput() }} />
            </div>
          </FloatingPortal>
        )}
      </>
    </ActionsChannelContext.Provider>)
}