import { Collection, EMPTY_COLLECTION, getOrCreate } from "../../utils/collections";
import { Logger, State } from "../apis/app";
import { Message } from "../apis/handler";
import { Key } from "../edit/messages";

export class InputConsumer {
  private pressed = new Map<string, boolean>();
  private actions = new Map<number, Map<string, Message[]>>();
  private states = new Map<string, [string, any, any]>();

  constructor() { for (let i = 0; i < 8; i++) this.actions.set(i, new Map<string, Message[]>()) }

  public consume(input: Key, state: State): Iterable<Message> {
    let result: Iterable<Message> = EMPTY_COLLECTION;
    if (input.down) {
      this.keydown(input.key);
      result = this.press(input.key);
    } else {
      this.keyup(input.key);
    }
    const stateChange = this.states.get(input.key);
    if (stateChange != undefined) {
      for (const s of stateChange) {
        if (state.has(s[0])) state.set(s[0], input.down ? s[1] : s[2]);
      }
    }
    return result;
  }

  public reset(state: State) {
    this.pressed.clear();
    for (const [, states] of this.states)
      for (const [name, , off] of states)
        if (state.has(name)) state.set(name, off);
  }


  public addBind(messages: Collection<Message>, key: string, ...mods: string[]) {
    const modState = this.modState(mods.includes('shift'), mods.includes('control'), mods.includes('alt'));
    getOrCreate(this.actions.get(modState), key, () => []).push(...messages);
  }

  public addStateBind(name: string, enabled: any, disabled: any, key: string) {
    getOrCreate(this.states, key, () => []).push([name, enabled, disabled]);
  }

  private keydown(key: string) { this.pressed.set(key, true) }
  private keyup(key: string) { this.pressed.set(key, false) }
  private isPressed(key: string): boolean { return this.pressed.get(key) }
  private modState(shift: boolean, ctrl: boolean, alt: boolean): number { return (shift ? 1 : 0) + (ctrl ? 2 : 0) + (alt ? 4 : 0) }

  private press(key: string): Iterable<Message> {
    const mods = this.modState(this.isPressed('shift'), this.isPressed('control'), this.isPressed('alt'));
    const actions = this.actions.get(mods)?.get(key);
    return actions ? actions : [];
  }
}

export type EventParser = (str: string, logger: Logger) => Collection<Message>;

function parseKey(key: string): string {
  if (key == 'space') return ' ';
  if (key == 'ctrl') return 'control';
  return key;
}

export function loadBinds(binds: string, messageParser: EventParser, logger: Logger): Map<string, InputConsumer> {
  const result = new Map<string, InputConsumer>();
  const lines = binds.split(/\r?\n/);
  for (const line of lines) {
    const trline = line.trim();
    if (trline.length == 0) continue;
    const parts = trline.split('|');
    if (parts.length != 3) { logger('WARN', `Skipping bind line: ${trline}`); continue; }
    const context = parts[0].trim();
    const consumer = getOrCreate(result, context, _ => new InputConsumer());
    const keys = parts[1].trim().toLowerCase().split('+').map(parseKey);
    const command = parts[2].trim();
    if (keys[0] == '') {
      consumer.addStateBind(command, true, false, keys[1]);
    } else {
      const messages = messageParser(command, logger);
      if (messages == null) {
        logger('WARN', `'${command}' failed to parse`);
        continue;
      }
      consumer.addBind(messages, keys.pop(), ...keys);
    }
  }
  return result;
}
