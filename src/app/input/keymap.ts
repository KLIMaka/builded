import { Collection, Deck, EMPTY_COLLECTION } from "../../utils/collections";
import { InputState } from "../../utils/input";
import { warning } from "../../utils/logger";
import { Message } from "../apis/handler";
import { State } from "../apis/app";

type InputHandler = (state: InputState) => boolean;

export function keyPress(key: string): InputHandler { return (state) => state.keysPress[key.toUpperCase()]; }
export function key(key: string): InputHandler { return (state) => state.keys[key.toUpperCase()]; }
export function notKey(key: string): InputHandler { return (state) => !state.keys[key.toUpperCase()]; }
export function mouseClick(button: number): InputHandler { return (state) => state.mouseClicks[button]; }
export function mouseButton(button: number): InputHandler { return (state) => state.mouseButtons[button]; }
export function combination(lh: InputHandler, rh: InputHandler): InputHandler { return (state) => lh(state) && rh(state) }
export const wheelUp: InputHandler = (state) => state.wheel > 0;
export const wheelDown: InputHandler = (state) => state.wheel < 0;


function parseMod(str: string): InputHandler {
  if (str == 'mouse0') return mouseButton(0);
  if (str == 'mouse1') return mouseButton(1);
  if (str == 'mouse2') return mouseButton(2);
  return key(str);
}

function parseKey(str: string): InputHandler {
  if (str == 'wheelup') return wheelUp;
  if (str == 'wheeldown') return wheelDown;
  if (str == 'mouse0') return mouseClick(0);
  if (str == 'mouse1') return mouseClick(1);
  if (str == 'mouse2') return mouseClick(2);
  return keyPress(str);
}

function canonizeBind(key: string, mods: string[]) {
  mods = mods.map((s) => s.toLowerCase());
  mods.sort();
  return [...mods, key].join('+');
}

function createHandler(k: string, mods: string[]): InputHandler {
  let handler = parseKey(k);
  for (const mod of ['shift', 'ctrl', 'alt'])
    handler = combination(handler, mods.includes(mod) ? key(mod) : notKey(mod));
  return handler;
}

type ContextMatcher = (context: string) => boolean;

export class Binder {


  private binds: string[] = [];
  private handlers: { handler: InputHandler, matcher: ContextMatcher }[] = [];
  private messages: Deck<Message>[] = [];
  private sorttable: number[] = [];

  private stateBinds: string[] = [];
  private stateHandlers: { handler: InputHandler, matcher: ContextMatcher }[] = [];
  private stateValues: [string, any, any][][] = [];

  public poolEvents(state: InputState, context: string): Iterable<Message> {
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      const handler = this.handlers[i];
      if (handler.matcher(context) && handler.handler(state)) return this.messages[i];
    }
    return EMPTY_COLLECTION;
  }

  public updateState(input: InputState, state: State, context: string) {
    for (let i = 0; i < this.stateHandlers.length; i++) {
      const handler = this.stateHandlers[i];
      const values = this.stateValues[i];
      for (const [name, on, off] of values) {
        if (handler.matcher(context) && state.has(name))
          state.set(name, handler.handler(input) ? on : off);
      }
    }
  }

  public addStateBind(matcher: ContextMatcher, name: string, enabled: any, disabled: any, ...keys: string[]) {
    const last = keys.pop();
    const bindName = canonizeBind(last, keys);
    const idx = this.stateBinds.indexOf(bindName);
    if (idx == -1) {
      this.stateBinds.push(bindName);
      let handler = parseMod(last);
      for (const key of keys) handler = combination(handler, parseMod(key));
      this.stateHandlers.push({ handler, matcher });
      this.stateValues.push([[name, enabled, disabled]]);
    } else {
      this.stateValues[idx].push([name, enabled, disabled]);
    }
  }

  public addBind(messages: Collection<Message>, matcher: ContextMatcher, key: string, ...mods: string[]) {
    const bindName = canonizeBind(key, mods);
    const bindIdx = this.findBind(bindName, mods.length);
    if (bindIdx == -1) {
      const handler = createHandler(key, mods);
      this.insertBind(bindName, handler, matcher, messages, mods.length);
    } else {
      this.messages[bindIdx].pushAll(messages);
    }
  }

  private insertBind(bindName: string, handler: InputHandler, matcher: ContextMatcher, messages: Collection<Message>, mods: number): void {
    this.ensureSortTable(mods);
    const pos = this.sorttable[mods];
    this.binds.splice(pos, 0, bindName);
    this.handlers.splice(pos, 0, { handler, matcher });
    this.messages.splice(pos, 0, new Deck<Message>().pushAll(messages));
    for (let i = this.sorttable.length - 1; i >= mods; i--) {
      this.sorttable[i]++;
    }
  }

  private findBind(bindName: string, mods: number) {
    this.ensureSortTable(mods);
    const start = mods == 0 ? 0 : this.sorttable[mods - 1]
    for (let i = start; i < this.sorttable[mods]; i++)
      if (this.binds[i] == bindName) return i;
    return -1;
  }

  private ensureSortTable(mods: number) {
    for (let i = mods; i >= 0; i--)
      if (this.sorttable[i] == undefined)
        this.sorttable[i] = this.binds.length;
      else break;
  }
}

function parseContextMatcher(str: string): ContextMatcher {
  return s => s == str;
}

export type EventParser = (str: string) => Collection<Message>;

export function loadBinds(binds: string, binder: Binder, messageParser: EventParser) {
  const lines = binds.split(/\r?\n/);
  for (let line of lines) {
    line = line.trim();
    if (line.length == 0) continue;
    const parts = line.toLowerCase().split('|');
    if (parts.length != 3) { warning(`Skipping bind line: ${line}`); continue; }
    const context = parseContextMatcher(parts[0].trim());
    const keys = parts[1].trim().split('+');
    const command = parts[2].trim();
    if (keys[0] == '') {
      binder.addStateBind(context, command, true, false, ...keys.slice(1));
    } else {
      const messages = messageParser(command);
      if (messages == null) {
        warning(`'${command}' failed to parse`);
        continue;
      }
      binder.addBind(messages, context, keys.pop(), ...keys);
    }
  }
}
