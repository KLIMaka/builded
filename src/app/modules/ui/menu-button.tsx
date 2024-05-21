import { useFloating, autoUpdate, size, useClick, useDismiss, useInteractions, FloatingPortal } from "@floating-ui/react";
import React, { ReactElement, useCallback, useContext, useEffect } from "react";
import { ActionItem, ActionList } from "./action-list";
import { useValue, ActionDescriptorsContext, ActionsChannelContext, CurrentActionsChannelContext, DropdownButton } from "./commons";
import { Source, Value } from "@utils/callbacks";
import { seq } from "@utils/types";

export type MenuButtonProps = {
  label: Source<ReactElement>,
  items: Source<ActionItem[]>,
  openValue: Value<boolean>,
  menuMinWidth?: number
  menuMaxWidth?: number
}

export function MenuButton(props: MenuButtonProps) {
  const openValue = props.openValue;
  const items = useValue(props.items);
  const label = useValue(props.label);
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
    const openValueDisconnector = openValue.subscribe(o => currentActions(o ? listChannel : actionsChannel))
    const closeAction = actionDescriptors.bindSync('close', () => closeMenu());
    return seq(listChannel.collector().add(closeAction), openValueDisconnector);
  }, [actionDescriptors, actionsChannel, currentActions, isOpen, listChannel, closeMenu, openValue]);

  return (
    <>
      <DropdownButton
        ref={refs.setReference}
        {...getReferenceProps()}
        className={`${isOpen ? 'active' : ''}`}
      >{label}</DropdownButton>
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