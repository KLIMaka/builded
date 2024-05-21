import { Value, value } from "@utils/callbacks";
import { Module, Plugin, provider } from "@utils/injector";
import { iter } from "@utils/iter";
import { Consumer } from "@utils/types";
import { ACTION_DESCRIPTORS, Action, ActionDescriptors } from "app/apis/actions";
import { UI, Ui, Window, WindowRenderer } from "app/apis/ui1";
import * as React from 'react';
import { Fragment } from 'react';
import { createRoot } from "react-dom/client";
import 'winbox/dist/css/winbox.min.css';
import { ActionDescriptorsContext, ActionsChannelContext, ActionsCollector, ActionsNode, CurrentActionsChannelContext, useValue } from "./commons";


function WindowsStackImpl({ windowsValue }: { windowsValue: Value<[WindowRenderer, Consumer<Window>][]> }) {
  const windows = useValue(windowsValue);
  const onCloseHandelr = (win: WindowRenderer) => { windowsValue.mod(s => s.filter(w => w[0] !== win)) }
  return iter(windows).enumerate()
    .map(([[renderer, consumer], i]) => <Fragment key={i}> {renderer(() => onCloseHandelr(renderer), consumer)} </Fragment>)
    .collect();
}

function WindowsStack(windowsValue: Value<[WindowRenderer, Consumer<Window>][]>, actionDescriptors: ActionDescriptors, currentActions: Consumer<ActionsNode>, actions: ActionsNode) {
  return (
    <ActionDescriptorsContext.Provider value={actionDescriptors}>
      <CurrentActionsChannelContext.Provider value={currentActions}>
        <ActionsChannelContext.Provider value={actions}>
          <WindowsStackImpl windowsValue={windowsValue} />
        </ActionsChannelContext.Provider>
      </CurrentActionsChannelContext.Provider>
    </ActionDescriptorsContext.Provider>
  )
}

class ReactUi implements Ui {
  private windows = value<[WindowRenderer, Consumer<Window>][]>([]);
  private globalUiActions = new ActionsNode('global', null);
  private currentActions: ActionsNode;

  constructor(private actionDescriptors: ActionDescriptors) {
    createRoot(this.createDesktop())
      .render(WindowsStack(this.windows, this.actionDescriptors, a => this.setCurrentActions(a), this.globalUiActions))
  }

  private setCurrentActions(node: ActionsNode) {
    console.log(node);
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

  private createDesktop(): HTMLElement {
    const desktop = document.createElement('div');
    desktop.className = 'desktop'
    document.body.appendChild(desktop)
    return desktop;
  }

  async showWindow(renderer: WindowRenderer): Promise<Window> {
    return new Promise<Window>((ok, error) => {
      this.windows.modImmer(s => s.push([renderer, ok]))
    });
  }
}

const ReactUiConstructor: Plugin<Ui> = provider(async injector => {
  const descriptors = await injector.getInstance(ACTION_DESCRIPTORS);
  return new ReactUi(descriptors);
});

export function ReactUiModule(module: Module) {
  module.bind(UI, ReactUiConstructor);
}