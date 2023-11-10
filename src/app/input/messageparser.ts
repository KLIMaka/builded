import { Collection, Deck, isEmpty } from "../../utils/collections";
import { Lexer, LexerRule } from "../../utils/lexer";
import { EndMove, Flip, Move, NamedMessage, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetSectorCstat, SetWallCstat, Shade, SpriteMode, StartMove, SetSpriteCstat, Rotate } from "../edit/messages";
import { Message } from "../apis/handler";
import { Logger } from "../apis/app";

class MessageParser {
  private lexer = new Lexer();

  constructor() {
    this.lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
    this.lexer.addRule(new LexerRule(/^[a-zA-Z_][a-zA-Z0-9_]+/, 'ID'));
    this.lexer.addRule(new LexerRule(/^,/, 'COMA'));
    this.lexer.addRule(new LexerRule(/^(false|true)/, 'BOOLEAN', 0, s => s == 'true'));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]*(\.[0-9]+)?([eE][\+\-][0-9]+)?/, 'FLOAT', 0, parseFloat));
    this.lexer.addRule(new LexerRule(/^\-?[0-9]+/, 'INT', 0, parseInt));
    this.lexer.addRule(new LexerRule(/^"([^"]*)"/, 'STRING', 1));
    this.lexer.addRule(new LexerRule(/^\{([^\}]*)\}/, 'MACRO', 1));
  }

  public setSource(src: string): void {
    this.lexer.setSource(src);
  }

  public get<T>(expected: string, value: T = null): T {
    for (; this.lexer.next() == 'WS';);
    if (this.lexer.isEoi()) throw new Error();
    const tokenId = this.lexer.rule().name;
    const actual = this.lexer.value();
    if (tokenId != expected || value != null && value != actual) throw new Error();
    return actual;
  }
}
const PARSER = new MessageParser();

const NOOP_MESSAGE: Message = {};
function createMessage(logger: Logger, constr: Function, ...types: string[]) { 
const args = [...types].map(t => PARSER.get(t));
  try {
    return Reflect.construct(constr, args);
  } catch (e) {
    logger('ERROR', `Invalid message constructor ${constr.name} (${types})`, args);
    return NOOP_MESSAGE;
  }
}

const parsdMessages = new Deck<Message>();
function tryParseMessage(logger: Logger): Collection<Message> {
  parsdMessages.clear();
  switch (PARSER.get('ID')) {
    case 'picnum': return parsdMessages.push(createMessage(logger, SetPicnum, 'INT'));
    case 'shade': return parsdMessages.push(createMessage(logger, Shade, 'INT', 'BOOLEAN'));
    case 'panrepeat': return parsdMessages.push(createMessage(logger, PanRepeat, 'INT', 'INT', 'INT', 'INT', 'BOOLEAN'));
    case 'pal': return parsdMessages.push(createMessage(logger, Palette, 'INT', 'INT', 'BOOLEAN'));
    case 'wallcstat': return parsdMessages.push(createMessage(logger, SetWallCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'sectorcstat': return parsdMessages.push(createMessage(logger, SetSectorCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'spritecstat': return parsdMessages.push(createMessage(logger, SetSpriteCstat, 'ID', 'BOOLEAN', 'BOOLEAN'));
    case 'rotate': return parsdMessages.push(createMessage(logger, Rotate, 'INT', 'BOOLEAN'));
    case 'flip': return parsdMessages.push(new Flip());
    case 'sprite_mode': return parsdMessages.push(new SpriteMode());
    case 'reset_panrepeat': return parsdMessages.push(new ResetPanRepeat());
    case 'move': return parsdMessages
      .push(new StartMove())
      .push(createMessage(logger, Move, 'INT', 'INT', 'INT'))
      .push(new EndMove());
    default: return parsdMessages;
  }
}

function tryParse(src: string, messages: Deck<Message>, logger: Logger): Collection<Message> {
  try {
    PARSER.setSource(src);
    PARSER.get('ID', 'msg');
    let parsedMessages = tryParseMessage(logger);
    while (!isEmpty(parsedMessages)) {
      messages.pushAll(parsedMessages);
      try { PARSER.get('COMA') } catch (e) { break }
      parsedMessages = tryParseMessage(logger);
    }
    return messages;
  } catch (e) {
    return messages.clear();
  }
}

const messages = new Deck<Message>();
export function messageParser(str: string, logger: Logger): Collection<Message> {
  const result = tryParse(str, messages.clear(), logger);
  if (result.length() == 0) return messages.push(new NamedMessage(str));
  return result;
}