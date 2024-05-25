import React, { forwardRef, ForwardedRef, useContext, useRef, useImperativeHandle, useCallback, useEffect, useState } from "react";
import { ActionDescriptorsContext, ActionsChannelContext, CurrentActionsChannelContext, useValue } from "./commons";
import { Value } from "@utils/callbacks";
import { Function } from "@utils/types";
import { ActionItem, ActionList } from "./action-list";
import { FloatingPortal, autoUpdate, size, useFloating, useFocus, useInteractions } from "@floating-ui/react";

export type SearchBoxRef = { focus(): void };

export type SearchBoxProps = {
  value: Value<string>,
  channelName: string,
  focusWidth?: number,
  width?: number
  oracle?: Function<Value<string>, ActionItem[]>
}

export const SearchBox = forwardRef(function SearchBox(props: SearchBoxProps, ref: ForwardedRef<SearchBoxRef>) {
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>();
  const [isOpen, setIsOpen] = useState(false);

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

  useImperativeHandle(ref, () => {
    return { focus: () => inputRef.current.focus() } as SearchBoxRef
  }, []);

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', () => inputRef.current.blur());
    const suggestionsAction = ctx.bindSync('suggestions', () => setIsOpen(true));
    return [blurAction, suggestionsAction]
  }, [actionDescriptors]);

  useEffect(() => {
    return searchChannel.collector().add(...createActions());
  }, [createActions, searchChannel])

  return (
    <ActionsChannelContext.Provider value={searchChannel}>
      <>
        <div
          ref={refs.setReference}
          {...getReferenceProps()}
          className='text-box baseline-aligned flex-auto row-block'>
          <div className='fa-solid fa-magnifying-glass' />
          <input
            className='flex-fill'
            ref={inputRef}
            type='text'
            value={query}
            placeholder="Press '/'"
            onChange={e => props.value.set(e.target.value)}
            onFocus={_ => { currentActions(searchChannel); inputRef.current.select() }}
            onBlur={_ => currentActions(actionsChannel)}
          />
          {query.length > 0 ? <div className='fa-solid fa-xmark fa-active' onClick={_ => props.value.set('')}></div> : <></>}
        </div>
        {isOpen && (
          <FloatingPortal>
            <div
              className="menu"
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 99999 }}
              {...getFloatingProps()}
            >
              <ActionList items={props.oracle(props.value)} onAction={() => setIsOpen(false)} />
            </div>
          </FloatingPortal>
        )}
      </>
    </ActionsChannelContext.Provider>)
});