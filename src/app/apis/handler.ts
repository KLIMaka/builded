import { Deck } from "../../utils/collections";
import { Dependency, Injector, provider } from "../../utils/injector";
import { List } from "../../utils/list";
import { LOGGER } from "./app";

export interface Message { }
export interface Context { }
export interface Handle { }
export interface MessageHandler { handle(message: Message): void; }
export interface MessageBus extends MessageHandler {
  connect(handler: MessageHandler): Handle,
  disconnect(handle: Handle): void,
}
export const BUS = new Dependency<MessageBus>('Message Bus');

export const NULL_MESSAGE_HANDLER: MessageHandler = { handle: (m) => { } };

export const DefaultMessageBusConstructor = provider(async (i: Injector) => {
  const logger = await i.getInstance(LOGGER);
  let lastHandle = 1;
  const handlers = new Map<number, MessageHandler>();
  return <MessageBus>{
    disconnect: h => handlers.delete(<number>h),
    connect: h => {
      handlers.set(lastHandle, h);
      return lastHandle++;
    },
    handle: msg => {
      try {
        handleCollection(handlers.values(), msg);
      } catch (e) {
        logger('ERROR', e);
      }
    }
  }
});

const messageBox: [Message] = [null];
export function handleReflective(obj: Object, message: Message) {
  const name = message.constructor.name;
  const handler = obj[name];
  if (handler != undefined) {
    messageBox[0] = message;
    handler.apply(obj, messageBox);
    return true;
  }
  return false;
}

export function handleCollection(handlers: Iterable<MessageHandler>, message: Message) {
  for (const h of handlers) h.handle(message);
}

export class MessageHandlerReflective {
  public handle(message: Message) { if (!handleReflective(this, message)) this.handleDefault(message) }
  protected handleDefault(message: Message) { }
}

export class MessageHandlerList implements MessageHandler {
  constructor(private handlers: Deck<MessageHandler> = new Deck<MessageHandler>()) { }
  handle(message: Message) { handleCollection(this.handlers, message); }
  list(): Deck<MessageHandler> { return this.handlers; }
  clone(): MessageHandlerList { return new MessageHandlerList(this.handlers.clone()); }
}

export function busDisconnector(bus: MessageBus) {
  return async (v: Handle) => bus.disconnect(v);
}

type MHandler = (data: any) => void;

class Mbus {
  private lastType = 0;
  private messageTypes: Map<string, number> = new Map();
  private handlers: List<MHandler>[] = [];

  public registerNewType(name: string): number {
    if (this.messageTypes.has(name)) throw new Error(`Message Type ${name} already registered`);
    const id = this.lastType++;
    this.messageTypes.set(name, id);
    this.handlers.push(new List());
    return id;
  }

  public connect(type: number, handler: MHandler): () => void {
    if (type < 0 || type >= this.lastType) throw new Error(`Invalid type id ${type}`);
    const handlers = this.handlers[type];
    const node = handlers.push(handler);
    return () => handlers.remove(node);
  }

  public getTypeByName(name: string): number {
    return this.messageTypes.get(name);
  }

  public handle(type: number, data: any) {
    if (type < 0 || type >= this.lastType) throw new Error(`Invalid type id ${type}`);
    const handlers = this.handlers[type];
    for (const h of handlers) h(data);
  }
}