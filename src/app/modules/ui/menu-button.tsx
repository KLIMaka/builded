import React, { ReactElement, useCallback, useContext, useEffect, useRef } from "react";
import { match } from "ts-pattern";
import { constSource, Source, Value } from "ts-utils/callbacks";
import { EMPTY_NAVIGATOR, NavigateAction, Navigator } from "ts-utils/navigators";
import { seq } from "ts-utils/types";
import { ActionItem, ActionList } from "./action-list";
import { ActionDescriptorsContext, ActionsChannelContext, checkClickInside, CurrentActionsChannelContext, Icon, styles, useValue } from "./commons";

export type MenuButtonProps = {
  label: Source<ReactElement>,
  labelAutoSize?: boolean,
  items: Source<ActionItem[]>,
  openValue: Value<boolean>,
  navigator?: Source<Navigator>,
  menuMinWidth?: number
}

const emptyNavigator = constSource('emptyNavigator', EMPTY_NAVIGATOR);

export function MenuButton(props: MenuButtonProps) {
  const openValue = props.openValue;
  const anchorName = `--menu-${openValue.name}`;
  const items = useValue(props.items);
  const label = useValue(props.label);
  const navigator = useValue(props.navigator ?? emptyNavigator);
  const isOpen = useValue(openValue);
  const closeMenu = useCallback(() => openValue.set(false), [openValue]);
  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const listChannel = actionsChannel.child("list", true);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const openValueDisconnector = openValue.subscribe(o => currentActions(o ? listChannel : actionsChannel));
    const closeAction = actionDescriptors.bindSync('close', () => closeMenu());
    const clickOutsideHandler = (e: PointerEvent) => {
      if (isOpen && !checkClickInside(e, popupRef, buttonRef)) openValue.set(false);
    }
    document.addEventListener('pointerdown', clickOutsideHandler);
    return seq(openValueDisconnector, listChannel.collector().add(closeAction), () => document.removeEventListener('pointerdown', clickOutsideHandler));
  }, [actionDescriptors, actionsChannel, currentActions, isOpen, listChannel, closeMenu, openValue]);

  const handleWheel = (deltaY: number, alt: boolean, shift: boolean, ctrl: boolean, navigator: Navigator) => {
    const up = deltaY < 0;
    const action = match([up, alt, shift, ctrl])
      .returnType<NavigateAction>()
      .with([true, false, false, false], () => 'prev')
      .with([false, false, false, false], () => 'next')
      .with([true, false, true, false], () => 'prevMacro')
      .with([false, false, true, false], () => 'nextMacro')
      .with([true, true, false, false], () => 'start')
      .with([false, true, false, false], () => 'end')
      .otherwise(() => 'nop')
    navigator(action);
  }
  const width = props.menuMinWidth
    ? `max(${props.menuMinWidth}px, anchor-size(width))`
    : `anchor-size(width)`;

  return (
    <>
      <div
        ref={buttonRef}
        className={`row-block button gap-5 ${(props.labelAutoSize ?? true) ? 'flex-auto' : 'flex-fill'} ${styles({ active: isOpen })}`}
        onWheel={e => handleWheel(e.deltaY, e.altKey, e.shiftKey, e.ctrlKey, navigator)}
        style={{ ['anchorName' as any]: anchorName }}
        onClick={_ => openValue.mod(open => !open)}
      >
        {label}
        <Icon icon='angle-down' />
      </div>
      {isOpen && (
        <ActionsChannelContext.Provider value={listChannel}>
          <div
            ref={popupRef}
            className="menu flex-fill"
            style={{ position: 'absolute', zIndex: 99999, ['positionAnchor' as any]: anchorName, ['positionArea' as any]: 'bottom span-right', width }}
          >
            <ActionList items={items} onAction={closeMenu} />
          </div>
        </ActionsChannelContext.Provider>
      )}
    </>
  );
}