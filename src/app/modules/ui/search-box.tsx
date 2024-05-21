import React, { forwardRef, ForwardedRef, useContext, useRef, useImperativeHandle, useCallback, useEffect } from "react";
import { ActionDescriptorsContext, ActionsChannelContext, CurrentActionsChannelContext, useValue } from "./commons";
import { Value } from "@utils/callbacks";

export type SearchBoxRef = { focus(): void };

export const SearchBox = forwardRef(function SearchBox(props: { value: Value<string>, channelName: string }, ref: ForwardedRef<SearchBoxRef>) {
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const searchChannel = actionsChannel.child(props.channelName, true);
  const query = useValue(props.value);
  const inputRef = useRef<HTMLInputElement>();

  useImperativeHandle(ref, () => {
    return { focus: () => inputRef.current.focus() } as SearchBoxRef
  }, []);

  const createActions = useCallback(() => {
    const ctx = actionDescriptors.sub('controls.textbox');
    const blurAction = ctx.bindSync('close', () => inputRef.current.blur());
    return [blurAction]
  }, [actionDescriptors]);

  useEffect(() => {
    return searchChannel.collector().add(...createActions());
  }, [createActions, searchChannel])

  return (
    <ActionsChannelContext.Provider value={searchChannel}>
      <div className='text-box baseline-aligned flex-auto row-block' style={{ width: '150px' }}>
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
    </ActionsChannelContext.Provider>)
});