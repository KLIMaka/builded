import { Collection, Deck, EMPTY_COLLECTION } from "../../collections";
import { InputState } from "../../input";
import { warning } from "../../logger";
import { ContextedValue, State } from "./api";
import { Message } from "./handlerapi";

export type InputHandler = (state: InputState) => boolean;

export function keyPress(key: string): InputHandler { return (state) => state.keysPress[key]; }
export function key(key: string): InputHandler { return (state) => state.keys[key]; }
export function mouseClick(button: number): InputHandler { return (state) => state.mouseClicks[button]; }
export function mouseButton(button: number): InputHandler { return (state) => state.mouseButtons[button]; }
export function combination(lh: InputHandler, rh: InputHandler): InputHandler { return (state) => lh(state) && rh(state) }
export const wheelUp: InputHandler = (state) => state.wheel > 0;
export const wheelDown: InputHandler = (state) => state.wheel < 0;


function parseMod(str: string): InputHandler {
  if (str == 'mouse0') return mouseButton(0);
  if (str == 'mouse1') return mouseButton(1);
  if (str == 'mouse2') return mouseButton(2);
  return key(str.toUpperCase());
}

function parseKey(str: string): InputHandler {
  if (str == 'wheelup') return wheelUp;
  if (str == 'wheeldown') return wheelDown;
  if (str == 'mouse0') return mouseClick(0);
  if (str == 'mouse1') return mouseClick(1);
  if (str == 'mouse2') return mouseClick(2);
  return keyPress(str.toUpperCase());
}

function canonizeBind(key: string, mods: string[]) {
  key = key.toLowerCase();
  mods = mods.map((s) => s.toLowerCase());
  mods.sort();
  return [...mods, key].join('+');
}

function createHandler(key: string, mods: string[]): InputHandler {
  let handler = parseKey(key);
  for (let i = 0; i < mods.length; i++) handler = combination(handler, parseMod(mods[i]));
  return handler;
}

export class Binder {
  private binds: string[] = [];
  private handlers: InputHandler[] = [];
  private messages: Deck<ContextedValue<Message>>[] = [];
  private sorttable: number[] = [];

  private stateBinds: string[] = [];
  private stateHandlers: InputHandler[] = [];
  private stateValues: [string, any, any][][] = [];

  public poolEvents(state: InputState): Collection<ContextedValue<Message>> {
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      if (this.handlers[i](state))
        return this.messages[i];
    }
    return EMPTY_COLLECTION;
  }

  public updateState(input: InputState, state: State) {
    for (let i = 0; i < this.stateHandlers.length; i++) {
      for (let value of this.stateValues[i]) {
        state.set(value[0], this.stateHandlers[i](input) ? value[1] : value[2]);
      }
    }
  }

  public addStateBind(name: string, enabled: any, disabled: any, ...keys: string[]) {
    let last = keys.pop();
    let bindName = canonizeBind(last, keys);
    let idx = this.stateBinds.indexOf(bindName);
    if (idx == -1) {
      this.stateBinds.push(bindName);
      let handler = parseMod(last);
      for (let key of keys) handler = combination(handler, parseMod(key));
      this.stateHandlers.push(handler);
      this.stateValues.push([[name, enabled, disabled]]);
    } else {
      this.stateValues[idx].push([name, enabled, disabled]);
    }
  }

  public addBind(messages: Collection<ContextedValue<Message>>, key: string, ...mods: string[]) {
    let bindName = canonizeBind(key, mods);
    let bindIdx = this.findBind(bindName, mods.length);
    if (bindIdx == -1) {
      let handler = createHandler(key, mods);
      this.insertBind(bindName, handler, messages, mods.length);
    } else {
      this.messages[bindIdx].pushAll(messages);
    }
  }

  private insertBind(bindName: string, handler: InputHandler, messages: Collection<ContextedValue<Message>>, mods: number): void {
    this.ensureSortTable(mods);
    let pos = this.sorttable[mods];
    this.binds.splice(pos, 0, bindName);
    this.handlers.splice(pos, 0, handler);
    this.messages.splice(pos, 0, new Deck<ContextedValue<Message>>().pushAll(messages));
    for (let i = this.sorttable.length - 1; i >= mods; i--) {
      this.sorttable[i]++;
    }
  }

  private findBind(bindName: string, mods: number) {
    this.ensureSortTable(mods);
    let start = mods == 0 ? 0 : this.sorttable[mods - 1]
    for (let i = start; i < this.sorttable[mods]; i++) {
      if (this.binds[i] == bindName) return i;
    }
    return -1;
  }

  private ensureSortTable(mods: number) {
    for (let i = mods; i >= 0; i--)
      if (this.sorttable[i] == undefined)
        this.sorttable[i] = this.binds.length;
      else break;
  }
}

export type EventParser = (str: string) => Collection<ContextedValue<Message>>;

export function loadBinds(binds: string, binder: Binder, messageParser: EventParser) {
  let lines = binds.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (line.length == 0) continue;
    let idx = line.indexOf(' ');
    if (idx == -1) {
      warning(`Skipping bind line: ${line}`);
      continue;
    }
    let keys = line.substr(0, idx).toLowerCase();
    if (keys.startsWith('+')) {
      keys = keys.substr(1);
      let keyParts = keys.split('+');
      binder.addStateBind(line.substr(idx + 1).trim(), true, false, ...keyParts);
    } else {
      let str = line.substr(idx + 1).trim();
      let messages = messageParser(str);
      if (messages == null) {
        warning(`'${str}' failed to parse`);
        continue;
      }
      let keyParts = keys.split('+');
      binder.addBind(messages, keyParts.pop(), ...keyParts);
    }
  }
}
