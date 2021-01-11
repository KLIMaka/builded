import { buildHull } from "../../build/board/mutations/drawwall";
import { Deck } from "../../utils/collections";
import { Dependency, Injector, InstanceProvider, Plugin, provider } from "../../utils/injector";
import { error } from "../../utils/logger";

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

export function DefaultMessageBus() {
  let lastHandle = 1;
  const handlers = new Map<number, MessageHandler>();
  return {
    connect: h => {
      handlers.set(lastHandle, h);
      return lastHandle++;
    },
    disconnect: h => {
      handlers.delete(<number>h);
    },
    handle: msg => {
      try {
        handleCollection(handlers.values(), msg);
      } catch (e) {
        error(e, e.stack);
      }
    }
  }
}

const messageBox: [Message] = [null];
export function handleReflective(obj: Object, message: Message) {
  let name = message.constructor.name;
  let handler = obj[name];
  if (handler != undefined) {
    messageBox[0] = message;
    handler.apply(obj, messageBox);
    return true;
  }
  return false;
}

export function handleCollection(handlers: Iterable<MessageHandler>, message: Message) {
  for (const h of handlers) {
    h.handle(message);
  }
}

export class MessageHandlerReflective {
  public handle(message: Message) { if (!handleReflective(this, message)) this.handleDefault(message) }
  protected handleDefault(message: Message) { }
}

export class MessageHandlerList implements MessageHandler {
  constructor(
    private handlers: Deck<MessageHandler> = new Deck<MessageHandler>()
  ) { }

  handle(message: Message) { handleCollection(this.handlers, message); }
  list(): Deck<MessageHandler> { return this.handlers; }
  clone(): MessageHandlerList { return new MessageHandlerList(this.handlers.clone()); }
}

export class BusPlugin implements Plugin<void> {
  private handles: Handle[] = [];
  constructor(private provider: (injector: Injector, handleProvider: (handler: MessageHandler) => void) => void, private bus = BUS) { }

  async start(injector: Injector): Promise<void> {
    const bus = await injector.getInstance(this.bus);
    this.provider(injector, (handler: MessageHandler) => this.handles.push(bus.connect(handler)));
  }

  async stop(injector: Injector) {
    const bus = await injector.getInstance(BUS);
    for (const h of this.handles) bus.disconnect(h);
    this.handles = [];
  }
}