import { Collection, Deck } from "../../collections";
import { Lexer, LexerRule } from "../../lex/lexer";
import { error } from "../../logger";
import { BuildContext, constCtxValue, ContextedValue } from "./api";
import { EndMove, Flip, Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade, SpriteMode, StartMove, SetSpriteCstat } from "./edit/messages";
import { Message } from "./handlerapi";

class MessageParser {
  private lexer = new Lexer();

  constructor() {
    this.lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
    this.lexer.addRule(new LexerRule(/^[a-zA-Z_][a-zA-Z0-9_]+/, 'ID'));
    this.lexer.addRule(new LexerRule(/^,/, 'COMA'));
    this.lexer.addRule(new LexerRule(/^(false|true)/, 'BOOLEAN', 0, (s) => s == 'true'));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, (s) => parseFloat(s)));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]+/, 'INT', 0, (s) => parseInt(s)));
    this.lexer.addRule(new LexerRule(/^"([^"]*)"/, 'STRING', 1));
    this.lexer.addRule(new LexerRule(/^\{([^\}]*)\}/, 'MACRO', 1));
  }

  public setSource(src: string): void {
    this.lexer.setSource(src);
  }

  public get<T>(expected: string, value: T = null): T {
    for (; this.lexer.next() == 'WS';);
    if (this.lexer.isEoi()) throw new Error();
    let tokenId = this.lexer.rule().name;
    let actual = this.lexer.value();
    if (tokenId != expected || value != null && value != actual) throw new Error();
    return this.lexer.value();
  }

  public tryGet<T>(expected: string, value: T = null): T {
    let mark = this.lexer.mark();
    try {
      return this.get(expected, value);
    } catch (e) {
      this.lexer.reset(mark);
      return null;
    }
  }
}
let parser = new MessageParser();

function createMacro(macro: string): ContextedValue<any> {
  return <ContextedValue<any>>Function('ctx', macro);
}

function parseArgs(...types: string[]) {
  let args = new Deck<ContextedValue<any>>();
  for (let type of types) {
    let macro = parser.tryGet<string>('MACRO');
    if (macro != null) args.push(createMacro(macro))
    else args.push(constCtxValue(parser.get(type)));
  }
  return args;
}

const NOOP_MESSAGE: Message = {};
let factArgs = new Deck<any>();
function createMessage(constr: Function, ...types: string[]) {
  let args = parseArgs(...types);
  return (ctx: BuildContext) => {
    factArgs.clear();
    for (let v of args) factArgs.push(v(ctx));
    try {
      return Reflect.construct(constr, [...factArgs]);
    } catch (e) {
      error(`Invalid message constructor ${constr.name} (${types})`, factArgs);
      return NOOP_MESSAGE;
    }
  }
}

let parsdMessages = new Deck<ContextedValue<Message>>();
function tryParseMessage(): Collection<ContextedValue<Message>> {
  parsdMessages.clear();
  switch (parser.get('ID')) {
    case 'picnum': return parsdMessages.push(createMessage(SetPicnum, 'INT'));
    case 'shade': return parsdMessages.push(createMessage(Shade, 'INT', 'BOOLEAN'));
    case 'panrepeat': return parsdMessages.push(createMessage(PanRepeat, 'INT', 'INT', 'INT', 'INT', 'BOOLEAN'));
    case 'pal': return parsdMessages.push(createMessage(Palette, 'INT', 'INT', 'BOOLEAN'));
    case 'wallcstat': return parsdMessages.push(createMessage(SetWallCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'sectorcstat': return parsdMessages.push(createMessage(SetSectorCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'spritecstat': return parsdMessages.push(createMessage(SetSpriteCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'flip': return parsdMessages.push(constCtxValue(new Flip()));
    case 'sprite_mode': return parsdMessages.push(constCtxValue(new SpriteMode()));
    case 'reset_panrepeat': return parsdMessages.push(constCtxValue(new ResetPanRepeat()));
    case 'move': return parsdMessages
      .push(constCtxValue(new StartMove()))
      .push(createMessage(Move, 'INT', 'INT', 'INT'))
      .push(constCtxValue(new EndMove()));
    default: return parsdMessages;
  }
}

function tryParse(src: string, messages: Deck<ContextedValue<Message>>): Collection<ContextedValue<Message>> {
  try {
    parser.setSource(src);
    parser.get('ID', 'msg');
    let parsedMessages = tryParseMessage();
    while (!parsedMessages.isEmpty()) {
      messages.pushAll(parsedMessages);
      try { parser.get('COMA') } catch (e) { break }
      parsedMessages = tryParseMessage();
    }
    return messages;
  } catch (e) {
    return messages.clear();
  }
}

let messages = new Deck<ContextedValue<Message>>();
export function messageParser(str: string): Collection<ContextedValue<Message>> {
  let result = tryParse(str, messages.clear());
  if (result.length() == 0) return messages.push(constCtxValue(new NamedMessage(str)));
  return result;
}