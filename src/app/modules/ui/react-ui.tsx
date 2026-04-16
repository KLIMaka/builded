import { Action, ACTION_DESCRIPTORS, ActionDescriptors, StateChecker } from "app/apis/actions";
import { App, APP } from "app/apis/app";
import { UI, Ui, Window } from "app/apis/ui";
import { VALUES } from "app/apis/values";
import * as React from 'react';
import { Fragment } from 'react';
import { createRoot } from "react-dom/client";
import { Disconnector, Value, ValuesContainer } from "ts-utils/callbacks";
import { getInstances, lifecycle, Module, Plugin } from "ts-utils/injector";
import { iter } from "ts-utils/iter";
import { Consumer } from "ts-utils/types";
import 'winbox/dist/css/winbox.min.css';
import { ActionsChannelContext, ActionsCollector, ActionsNode, UiContext, useValue } from "./commons";


function WindowsStackImpl({ windowsValue }: { windowsValue: Value<Map<Window, WindowDescriptor>> }) {
  const windows = useValue(windowsValue);
  return iter(windows.entries()).map(([w, d]) => <Fragment key={d.id}>{w.content}</Fragment>)
    .collect();
}

function WindowsStack(windowsValue: Value<Map<Window, WindowDescriptor>>, actionDescriptors: ActionDescriptors, currentActions: Consumer<ActionsNode>, actions: ActionsNode) {
  return (
    // <StrictMode>
    <UiContext.Provider value={{ currentActions, actionDescriptors }}>
      <ActionsChannelContext.Provider value={actions}>
        <WindowsStackImpl windowsValue={windowsValue} />
      </ActionsChannelContext.Provider>
    </UiContext.Provider>
    // </StrictMode>
  )
}

type WindowDescriptor = {
  modalParent: Window | null,
  disconnectors: Disconnector[],
  id: number,
}

class ReactUi implements Ui {
  private windows: Value<Map<Window, WindowDescriptor>>;
  private lastId = 0;
  private globalUiActions = new ActionsNode('global', null);
  private currentActions: ActionsNode | null = null;
  private focusedWindow: Window | null = null;

  constructor(
    private actionDescriptors: ActionDescriptors,
    private app: App,
    private localValues: ValuesContainer,
  ) {
    this.windows = localValues.value<Map<Window, WindowDescriptor>>('windows', new Map());
    createRoot(this.createDesktop())
      .render(WindowsStack(this.windows, this.actionDescriptors, a => this.setCurrentActions(a), this.globalUiActions))
  }

  private setCurrentActions(node: ActionsNode) {
    this.currentActions = node;
  }

  globalActions(): ActionsCollector {
    return this.globalUiActions.collector();
  }

  actions(): Iterable<Action> {
    return this.currentActions != null
      ? this.currentActions.actions()
      : this.globalUiActions.actions();
  }

  states(): Iterable<StateChecker> {
    return this.currentActions != null
      ? this.currentActions.states()
      : this.globalUiActions.states();
  }

  private createDesktop(): HTMLElement {
    const desktop = document.createElement('div');
    desktop.className = 'desktop'
    document.body.appendChild(desktop)
    return desktop;
  }

  addWindow(window: Window): void {
    this.app.timer.delayed(() => {
      if (this.windows.get().has(window)) window.focus();
      else this.windows.modImmer(ws => ws.set(window, this.createDescriptor(window)))
    });
  }

  private createDescriptor(window: Window): WindowDescriptor {
    const disconnectors = [
      window.onClose(() => this.removeWindow(window)),
      window.onFocus(() => this.focus(window))
    ];
    const id = this.lastId++;
    return { id, modalParent: this.focusedWindow, disconnectors }
  }

  private focus(window:Window) {
    this.focusedWindow = window;
  }

  removeWindow(window: Window): void {
    if (this.focusedWindow === window) this.focusedWindow = null;
    const desc = this.windows.get().get(window);
    this.windows.modImmer(ws => ws.delete(window));
    desc?.disconnectors.forEach(d => d());
    if (window.isModal() && desc?.modalParent) desc.modalParent.focus();
  }
}

export const ReactUiConstructor: Plugin<Ui> = lifecycle(async (injector, lifecycle) => {
  const [descriptors, app, values] = await getInstances(injector, ACTION_DESCRIPTORS, APP, VALUES);
  const localValues = lifecycle(values.create('ui'), v => v.dispose());
  return new ReactUi(descriptors, app, localValues);
});

export function ReactUiModule(module: Module) {
  module.bind(UI, ReactUiConstructor);
}