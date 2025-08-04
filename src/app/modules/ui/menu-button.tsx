import { autoUpdate, FloatingPortal, size, useClick, useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import { constSource, Source, Value } from "ts-utils/callbacks";
import { EMPTY_NAVIGATOR, NavigateAction, Navigator } from "ts-utils/navigators";
import { seq } from "ts-utils/types";
import React, { ReactElement, useCallback, useContext, useEffect } from "react";
import { match } from "ts-pattern";
import { ActionItem, ActionList } from "./action-list";
import { ActionDescriptorsContext, ActionsChannelContext, CurrentActionsChannelContext, Icon, styles, useValue } from "./commons";

export type MenuButtonProps = {
  label: Source<ReactElement>,
  labelAutoSize?: boolean,
  items: Source<ActionItem[]>,
  openValue: Value<boolean>,
  navigator?: Source<Navigator>,
  menuMinWidth?: number
  menuMaxWidth?: number
}

const emptyNavigator = constSource('emptyNavigator', EMPTY_NAVIGATOR);

export function MenuButton(props: MenuButtonProps) {
  const openValue = props.openValue;
  const items = useValue(props.items);
  const label = useValue(props.label);
  const navigator = useValue(props.navigator ?? emptyNavigator);
  const isOpen = useValue(openValue);
  const { refs, floatingStyles, context } = useFloating({
    placement: "bottom-start",
    open: isOpen,
    onOpenChange: o => openValue.set(o),
    whileElementsMounted: autoUpdate,
    middleware: [
      size({
        apply({ rects, elements, availableHeight }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${availableHeight}px`,
            minWidth: `${Math.max(rects.reference.width, props.menuMinWidth ?? 0)}px`,
            maxWidth: `${props.menuMaxWidth ?? 0}px`
          })
        },
        padding: 10,
      }),
    ],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, { escapeKey: false });
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);
  const closeMenu = useCallback(() => openValue.set(false), [openValue]);

  const actionDescriptors = useContext(ActionDescriptorsContext);
  const actionsChannel = useContext(ActionsChannelContext);
  const currentActions = useContext(CurrentActionsChannelContext);
  const listChannel = actionsChannel.child("list", true);

  useEffect(() => {
    const openValueDisconnector = openValue.subscribe(o => currentActions(o ? listChannel : actionsChannel));
    const closeAction = actionDescriptors.bindSync('close', () => closeMenu());
    return seq(openValueDisconnector, listChannel.collector().add(closeAction));
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

  return (
    <>
      <div
        ref={refs.setReference}
        className={`row-block button gap-5 ${(props.labelAutoSize ?? true) ? 'flex-auto' : 'flex-fill'} ${styles({ active: isOpen })}`}
        {...getReferenceProps()}
        onWheel={e => handleWheel(e.deltaY, e.altKey, e.shiftKey, e.ctrlKey, navigator)}
      >
        {label}
        <Icon icon='angle-down' />
      </div>
      {isOpen && (
        <ActionsChannelContext.Provider value={listChannel}>
          <FloatingPortal>
            <div
              className="menu"
              ref={refs.setFloating}
              style={{ ...floatingStyles, zIndex: 99999 }}
              {...getFloatingProps()}
            >
              <ActionList items={items} onAction={closeMenu} />
            </div>
          </FloatingPortal>
        </ActionsChannelContext.Provider>
      )}
    </>
  );
}