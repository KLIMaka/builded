import { Column, Tabs } from "@ui/commons";
import { SizeType, WindowBuilder } from "@ui/windows-common";
import { GL_CONTEXT, GlContext } from "@utils/gl/drawstruct";
import { ACTION_DESCRIPTORS } from "app/apis/actions";
import { App, APP } from "app/apis/app";
import { FS } from "app/apis/fs";
import { UI, Window } from "app/apis/ui";
import { Values, VALUES } from "app/apis/values";
import React from "react";
import { Value, ValuesContainer, ValuesMap } from "ts-utils/callbacks";
import { getInstances, Injector } from "ts-utils/injector";
import { createSavedState } from "../default/app/storage";
import { GlView } from "./tabs/gl";
import { TasksView } from "./tabs/tasks";
import { ValuesView } from "./tabs/vaules";

const ID = 'settings';

type SavedState = {
  size: SizeType
  position: SizeType,
  activeTab: number,
}

function createDefaultState(): SavedState {
  return {
    size: [800, 800],
    position: ['center', 'center'],
    activeTab: 0
  };
}

type TaskManagerActions = {}

class SettingsInstance {
  readonly actions: TaskManagerActions;
  readonly activeTab: Value<number>

  constructor(
    readonly values: Values,
    private localValues: ValuesContainer,
    private state: ValuesMap<SavedState>,
    readonly glContext: GlContext,
    readonly app: App,
  ) {
    this.actions = {};
    this.activeTab = this.state.get('activeTab');
  }
}


function LogView() {
  return <></>
}

function SettingsView(props: { instance: SettingsInstance }) {
  const { instance } = props;
  return <Column className="padded-5">
    <Tabs items={[
      { icon: 'table-list', label: 'Values', content: <ValuesView values={props.instance.values} /> },
      { icon: 'bars', label: 'Logs', content: <LogView /> },
      { icon: 'traffic-light', label: 'Tasks', content: <TasksView tasks={props.instance.app.scheduler.tasks} /> },
      { icon: '', label: 'GL Context', content: <GlView glCtx={props.instance.glContext} /> },
    ]} active={instance.activeTab} />
  </Column>
}

let globalWindow: Window | undefined;
export async function createSettings(injector: Injector): Promise<Window> {
  if (globalWindow !== undefined) return globalWindow;

  const [actionDescriptors, app, ui, fs, glCtx, values] = await getInstances(injector, ACTION_DESCRIPTORS, APP, UI, FS, GL_CONTEXT, VALUES);
  const localValues = values.create(ID);
  const windowStates = await app.storages('ui.window-states');
  const state = await createSavedState(localValues, windowStates, ID, createDefaultState(), app.timer);
  const instance = new SettingsInstance(values, localValues, state, glCtx, app);

  globalWindow = new WindowBuilder(ID, actionDescriptors, localValues)
    .titleFromId()
    .minSize(400, 400)
    .state(state)
    .actions(Object.values(instance.actions))
    .disposable(localValues)
    .onClose(() => globalWindow = undefined)
    .build(<SettingsView instance={instance} />)
  return globalWindow;
}