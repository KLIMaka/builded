import { Deck } from "../../utils/collections";
import { Dependency, Injector } from "../../utils/injector";
import { error } from "../../utils/logger";

export interface Message { }
export interface Context { }
export interface MessageHandler { handle(message: Message): void; }
export interface MessageBus extends MessageHandler { connect(handler: MessageHandler): void }
export const BUS = new Dependency<MessageBus>('Message Bus');

export async function DefaultMessageBus(injector: Injector): Promise<MessageBus> {
  const list = new MessageHandlerList();
  return {
    connect: h => list.list().push(h),
    handle: msg => {
      try {
        list.handle(msg)
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