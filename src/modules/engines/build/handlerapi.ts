import { Deck, Collection } from "../../collections";
import { tuple2 } from "../../../libs/mathutils";

export interface Message { }
export interface Context { }
export interface MessageHandler { handle(message: Message, ctx: Context): void; }

let args: [Message, Context] = [null, null];
export function handleReflective(obj: Object, message: Message, ctx: Context) {
  let name = message.constructor.name;
  let handler = obj[name];
  if (handler != undefined) {
    handler.apply(obj, tuple2(args, message, ctx));
    return true;
  }
  return false;
}

export function handleCollection(handlers: Collection<MessageHandler>, message: Message, ctx: Context) {
  for (let i = 0; i < handlers.length(); i++) {
    handlers.get(i).handle(message, ctx);
  }
}

export class MessageHandlerReflective {
  public handle(message: Message, ctx: Context) { if (!handleReflective(this, message, ctx)) this.handleDefault(message, ctx) }
  protected handleDefault(message: Message, ctx: Context) { }
}

export class MessageHandlerList implements MessageHandler {
  constructor(
    private handlers: Deck<MessageHandler> = new Deck<MessageHandler>()
  ) { }

  handle(message: Message, ctx: Context) { handleCollection(this.handlers, message, ctx); }
  list(): Deck<MessageHandler> { return this.handlers; }
  clone(): MessageHandlerList { return new MessageHandlerList(this.handlers.clone()); }
}