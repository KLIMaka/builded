import { getOrCreate } from "@utils/collections";
import { loadString } from "@utils/getter";
import { Plugin, provider } from "@utils/injector";
import { Consumer, Supplier } from "@utils/types";
import { Action, ActionDescriptor, ActionDescriptors, ActionHandler } from "app/apis/actions";
import { APP, Logger } from "app/apis/app1";
import { Bind } from "app/input/keymap";
import Optional from "optional-js";
import toml from "toml";


class ActionDescriptorImpl implements ActionDescriptor {
  constructor(
    private parent: Supplier<Optional<ActionDescriptor>>,
    private _label: Optional<string>,
    private _icon: Optional<string>,
    private _descr: Optional<string>,
    private _bind: Optional<Bind>,
  ) { }

  label() { return this._label.or(() => this.parent().flatMap(p => p.label())) }
  icon() { return this._icon.or(() => this.parent().flatMap(p => p.icon())) }
  descr() { return this._descr.or(() => this.parent().flatMap(p => p.descr())) }
  bind() { return this._bind.or(() => this.parent().flatMap(p => p.bind())) }
}


class ActionDescriptorsContext implements ActionDescriptors {
  constructor(private name: string, private actions: Map<string, ActionDescriptor>, private logger: Logger) { }

  get(localId: string): ActionDescriptor {
    const globalId = getId(this.name, localId);
    return getOrCreate(this.actions, globalId, _ => {
      this.logger.log("WARN", `Invalid action id: ${globalId}`);
      return new ActionDescriptorImpl(() => Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
    });
  }

  sub(localId: string): ActionDescriptors {
    return new ActionDescriptorsContext(getId(this.name, localId), this.actions, this.logger);
  }

  bind(id: string, handler: ActionHandler): Action {
    return { descriptor: this.get(id), handler };
  }

  bindSync(id: string, handler: Consumer<void>): Action {
    return this.bind(id, async () => handler());
  }
}

function getId(globalId: string, localId: string) {
  return (globalId ? globalId + '.' : '') + localId;
}

function parseBind(bind: string): Optional<Bind> {
  return bind ? Optional.of(new Bind(bind.split('+'))) : Optional.empty();
}

function parseRecord(object: any, actions: Map<string, ActionDescriptor>): ActionDescriptor {
  return new ActionDescriptorImpl(
    () => Optional.ofNullable(actions.get(object.parent)),
    Optional.ofNullable(object.label),
    Optional.ofNullable(object.icon),
    Optional.ofNullable(object.description),
    parseBind(object.bind),
  )
}

function parseActions(object: any, name: string, actions: Map<string, ActionDescriptor>) {
  if (typeof object != 'object') throw Error('');
  for (const k of Object.keys(object)) {
    const value = object[k];
    const id = getId(name, k);
    if (typeof value == 'object') parseActions(value, id, actions);
    else actions.set(name, parseRecord(object, actions));
  }
  return actions;
}

export const DefaultActionsConstructor: Plugin<ActionDescriptors> = provider(async injector => {
  const app = await injector.getInstance(APP);
  const actions = Optional.ofNullable(await loadString('actions.toml'))
    .map(f => parseActions(toml.parse(f), '', new Map()))
    .orElse(new Map());
  return new ActionDescriptorsContext('', actions, app.logger);
});