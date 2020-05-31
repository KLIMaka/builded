import { Collection, Deck, isEmpty } from "../../utils/collections";
import { Lexer, LexerRule } from "../../utils/lexer";
import { error } from "../../utils/logger";
import { EndMove, Flip, Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade, SpriteMode, StartMove, SetSpriteCstat, Rotate } from "../edit/messages";
import { Message } from "../apis/handler";

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

function parseArgs(...types: string[]) {
  let args = new Deck<any>();
  for (let type of types) {
    args.push(parser.get(type));
  }
  return args;
}

const NOOP_MESSAGE: Message = {};
let factArgs = new Deck<any>();
function createMessage(constr: Function, ...types: string[]) {
  let args = parseArgs(...types);
  factArgs.clear();
  for (let v of args) factArgs.push(v);
  try {
    return Reflect.construct(constr, [...factArgs]);
  } catch (e) {
    error(`Invalid message constructor ${constr.name} (${types})`, factArgs);
    return NOOP_MESSAGE;
  }
}

let parsdMessages = new Deck<Message>();
function tryParseMessage(): Collection<Message> {
  parsdMessages.clear();
  switch (parser.get('ID')) {
    case 'picnum': return parsdMessages.push(createMessage(SetPicnum, 'INT'));
    case 'shade': return parsdMessages.push(createMessage(Shade, 'INT', 'BOOLEAN'));
    case 'panrepeat': return parsdMessages.push(createMessage(PanRepeat, 'INT', 'INT', 'INT', 'INT', 'BOOLEAN'));
    case 'pal': return parsdMessages.push(createMessage(Palette, 'INT', 'INT', 'BOOLEAN'));
    case 'wallcstat': return parsdMessages.push(createMessage(SetWallCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'sectorcstat': return parsdMessages.push(createMessage(SetSectorCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'spritecstat': return parsdMessages.push(createMessage(SetSpriteCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'rotate': return parsdMessages.push(createMessage(Rotate, 'INT'));
    case 'flip': return parsdMessages.push(new Flip());
    case 'sprite_mode': return parsdMessages.push(new SpriteMode());
    case 'reset_panrepeat': return parsdMessages.push(new ResetPanRepeat());
    case 'move': return parsdMessages
      .push(new StartMove())
      .push(createMessage(Move, 'INT', 'INT', 'INT'))
      .push(new EndMove());
    default: return parsdMessages;
  }
}

function tryParse(src: string, messages: Deck<Message>): Collection<Message> {
  try {
    parser.setSource(src);
    parser.get('ID', 'msg');
    let parsedMessages = tryParseMessage();
    while (!isEmpty(parsedMessages)) {
      messages.pushAll(parsedMessages);
      try { parser.get('COMA') } catch (e) { break }
      parsedMessages = tryParseMessage();
    }
    return messages;
  } catch (e) {
    return messages.clear();
  }
}

let messages = new Deck<Message>();
export function messageParser(str: string): Collection<Message> {
  let result = tryParse(str, messages.clear());
  if (result.length() == 0) return messages.push(new NamedMessage(str));
  return result;
}