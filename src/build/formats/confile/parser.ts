import Optional from "optional-js";
import { asyncMapOptional, field } from "ts-utils/objects";
import { BiFn, Fn, notUndefined, pair, Supplier } from "ts-utils/types";
import { KeywordCharSet, KeywordId, Keywords, KeywordsMap } from "./constants";

namespace Chars {
  export const NL = '\n'.charCodeAt(0);
  export const TAB = '\t'.charCodeAt(0);
  export const SPACE = ' '.charCodeAt(0);
  export const _R = '\r'.charCodeAt(0);
  export const _1A = 0x1a;
  export const SLASH = '/'.charCodeAt(0);
  export const BACK_SLASH = '\\'.charCodeAt(0);
  export const STAR = '*'.charCodeAt(0);
  export const L_PARENTHESIS = '('.charCodeAt(0);
  export const R_PARENTHESIS = ')'.charCodeAt(0);
  export const L_BRACKET = '['.charCodeAt(0);
  export const R_BRACKET = ']'.charCodeAt(0);
  export const COMMA = ','.charCodeAt(0);
  export const SEMICOLON = ';'.charCodeAt(0);
  export const L_CURL = '{'.charCodeAt(0);
  export const R_CURL = '}'.charCodeAt(0);
  export const MINUS = '-'.charCodeAt(0);
  export const PLUS = '+'.charCodeAt(0);
  export const UNDERSCORE = '_'.charCodeAt(0);
  export const DOT = '.'.charCodeAt(0);
  export const QUESTION_MARK = '?'.charCodeAt(0);
  export const EXCL_MARK = '!'.charCodeAt(0);
  export const AMP = '&'.charCodeAt(0);

  const A = 'A'.charCodeAt(0);
  const Z = 'Z'.charCodeAt(0);
  const a = 'a'.charCodeAt(0);
  const z = 'z'.charCodeAt(0);
  const _0 = '0'.charCodeAt(0);
  const _9 = '9'.charCodeAt(0);


  export function isAlpha(ch: number) { return (ch >= a && ch <= z) || (ch >= A && ch <= Z) }
  export function isNumber(ch: number) { return ch >= _0 && ch <= _9 }
  export function isAlphaNum(ch: number) { return isAlpha(ch) || isNumber(ch) }
  export function isAlphaTok(ch: number) {
    return isAlphaNum(ch) || ch === L_CURL || ch === R_CURL || ch === SLASH || ch === BACK_SLASH || ch === STAR || ch === MINUS || ch === UNDERSCORE || ch === DOT || ch === EXCL_MARK || ch === AMP;
  }
  export function isLabel(c: number, i: number) {
    return isAlphaNum(c) || c === UNDERSCORE || c === STAR || c === QUESTION_MARK || (i > 0 && (c === PLUS || c === MINUS));
  }
}

export type TextRange = { value: string, range: Range }

class Lexer {
  private ptr = 0;
  private line = 1;
  private lineStart = 0;
  private marksStack: { ptr: number, line: number, lineStart: number }[] = [];

  constructor(readonly text: Uint8Array) { }

  current(off = 0): number { return this.text[this.ptr + off] }
  next(off = 1): void { this.ptr += off }
  newLine(): void { this.line++; this.next(); this.lineStart = this.ptr }
  eof(off = 0): boolean { return (this.ptr + off) >= this.text.length }
  position(): Position { return { line: this.line, col: this.ptr - this.lineStart + 1, pos: this.ptr } }
  pushMark() { this.marksStack.push({ ptr: this.ptr, line: this.line, lineStart: this.lineStart }) }
  popMark() { ({ ptr: this.ptr, line: this.line, lineStart: this.lineStart } = notUndefined(this.marksStack.pop())) }
  skipMark() { this.marksStack.pop() }

  tryToRead<T>(reader: Supplier<Optional<T>>): Optional<T> {
    this.pushMark();
    const value = reader();
    value.ifPresentOrElse(_ => this.skipMark(), () => this.popMark());
    return value;
  }

  skipWs() {
    for (; ;) {
      if (this.eof()) return;
      switch (this.current()) {
        case Chars.NL:
          this.newLine();
          break;
        case Chars.SPACE:
        case Chars.TAB:
        case Chars._1A:
        case Chars._R:
        case Chars.L_PARENTHESIS:
        case Chars.R_PARENTHESIS:
        case Chars.COMMA:
        case Chars.SEMICOLON:
          this.next();
          break;
        case Chars.SLASH:
          switch (this.current(1)) {
            case Chars.SLASH:
              this.skipLine();
              continue;
            case Chars.STAR:
              while (!this.eof(3) && (this.current(2) !== Chars.STAR || this.current(3) !== Chars.SLASH)) {
                if (this.current() === Chars.NL) this.newLine();
                else this.next();
              }
              if (this.eof(3)) throw Error();
              this.next(3);
              continue;
            default:
              this.skipLine();
              continue;
          }
        default: return;
      }
    }
  }

  skipLine() {
    while (!this.eof() && this.current() !== Chars.NL && this.current() !== Chars._R)
      this.next();
  }

  nextKeyword(maskedKeywords: Set<string>): Optional<{ keyword: string, keywordId: KeywordId, range: Range }> {
    return this.tryToRead(() => this.read(c => KeywordCharSet.has(c))
      .flatMap(({ value: keyword, range }) => {
        if (maskedKeywords.has(keyword)) return Optional.empty();
        return Optional.ofNullable(KeywordsMap.get(keyword)).map(keywordId => ({ keywordId, range, keyword }))
      }));
  }

  read(predicate: BiFn<number, number, boolean>): Optional<TextRange> {
    return this.tryToRead(() => {
      this.skipWs();
      const chars = [];
      const start = this.position();
      for (; ;) {
        const c = this.current();
        if (this.eof() || !predicate(c, chars.length)) break;
        chars.push(c);
        this.next();
      }
      return chars.length === 0
        ? Optional.empty()
        : Optional.of({ value: String.fromCharCode(...chars), range: { start, end: this.position(), src: this.text } });
    })
  }
}

export function toStringHasRange(hasRange: HasRange | undefined, limit = 40): string {
  return toString(hasRange?.range, limit);
}

export function toString(range: Range | undefined, limit = 40): string {
  if (range === undefined) return "undefined";
  const str = String.fromCharCode(...range.src.subarray(range.start.pos, range.end.pos));
  return str.length > limit ? str.slice(0, limit) + '...' : str;
}

export type Position = { line: number, col: number, pos: number };
export type Range = { start: Position, end: Position, src: Uint8Array };
export type HasRange = { range: Range };
export type Diagnostic = { type: 'error' | 'warning', description: string } & HasRange;

export function mergeRanges(...ranges: Range[]): Range {
  const start = ranges.reduce((l, r) => l.start.pos < r.start.pos ? l : r).start;
  const end = ranges.reduce((l, r) => l.end.pos > r.end.pos ? l : r).end;
  return { start, end, src: ranges[0].src };
}

export function mergeHasRanges(...hasHanges: HasRange[]): Range {
  return mergeRanges(...hasHanges.map(field('range')));
}

export type Const = { type: 'const', value: number } & HasRange;
export type Str = { type: 'string', value: string } & HasRange;
export type Label = { type: 'label', label: string } & HasRange;
export type Index = { type: 'index', index?: Value, field?: Value } & HasRange;
export type Named = { type: 'named', name: string, index?: Index, minus: boolean } & HasRange;
export type Value = Named | Const | Str;
export type Statement = { type: 'statement', keyword: KeywordId, args: Value[] } & HasRange;

type ByType<TUnion extends { type: string }, TType extends TUnion['type']> = Extract<TUnion, { type: TType }>
export function as<TUnion extends { type: string }, TType extends TUnion['type']>(node: TUnion | undefined, type: TType): ByType<TUnion, TType> {
  if (node?.type !== type) {
    throw new Error(`Expected "${type}", got "${node?.type}"`)
  }
  return node as ByType<TUnion, TType>
}

class Parser {
  private maskedKeywords = new Set<string>();
  diagnostics: Diagnostic[] = [];

  constructor(public lexer: Lexer) { }

  diagnostic(diagnostic: Diagnostic): void { this.diagnostics.push(diagnostic) }
  error(range: Range, description: string) { this.diagnostic({ range, description, type: 'error' }) }
  warninng(range: Range, description: string) { this.diagnostic({ range, description, type: 'warning' }) }

  readConstLabel(): Optional<Const | Label> {
    return this.lexer.read(Chars.isAlphaTok)
      .flatMap<Const | Label>(({ value, range }) => {
        if (Chars.isNumber(value.charCodeAt(0)) || value.startsWith('-')) {
          if (value.toLowerCase().startsWith('0x'))
            return Optional.of({ type: 'const', value: Number.parseInt(value, 16), range });
          return Optional.of({ type: 'const', value: Number.parseInt(value), range });
        }
        return Optional.of({ type: 'label', label: value, range });
      });
  }

  readIndex(): Optional<Index> {
    return this.lexer.tryToRead(() => {
      this.lexer.skipWs();
      const start = this.lexer.position();
      const indexValue: Index = { type: 'index', range: { start, end: start, src: this.lexer.text } };
      if (this.lexer.current() === Chars.L_BRACKET) {
        this.lexer.next();
        const start = this.lexer.position();
        this.readValue().ifPresentOrElse(
          index => indexValue.index = index,
          () => indexValue.index = { type: 'named', name: 'this', range: { start, end: this.lexer.position(), src: this.lexer.text }, minus: false }
        );
        this.lexer.skipWs();
        if (this.lexer.current() !== Chars.R_BRACKET)
          this.error({ start, end: this.lexer.position(), src: this.lexer.text }, `expecting ']'`);
        else this.lexer.next();
      }
      const field = this.lexer.tryToRead<Value>(() => {
        this.lexer.skipWs();
        if (this.lexer.current() === Chars.DOT) {
          this.lexer.next();
          return this.readValue();
        }
        return Optional.empty();
      })
      field.ifPresent(field => indexValue.field = field)
      indexValue.range = { start, end: this.lexer.position(), src: this.lexer.text };
      return (indexValue.range.start.pos !== indexValue.range.end.pos)
        ? Optional.of(indexValue)
        : Optional.empty();
    });
  }

  readValue(): Optional<Value> {
    return this.lexer.tryToRead(() => {
      this.lexer.skipWs();
      const start = this.lexer.position();
      const minus = this.lexer.current() === Chars.MINUS;
      if (minus) this.lexer.next();
      return this.readConstLabel()
        .or(() => Optional.of({ type: "label", label: "", range: { start, end: start, src: this.lexer.text } }))
        .flatMap(value => {
          if (value.type === 'label') {
            return this.readIndex()
              .map<Value>(index => ({ type: 'named', range: mergeHasRanges(value, index), index, minus, name: value.label }))
              .or(() => value.label === ''
                ? Optional.empty()
                : Optional.of({ type: 'named', range: value.range, minus, name: value.label }));
          } else return Optional.of(value);
        });
    });
  }

  valuesWhileKeyword(firstKeyword: boolean, limit = 32): Value[] {
    const values: Value[] = [];
    for (let i = 0; i < limit; i++) {
      this.lexer.pushMark();
      const keywordOpt = this.lexer.nextKeyword(this.maskedKeywords);
      if (i === 0 && firstKeyword && keywordOpt.isPresent()) {
        this.lexer.skipMark();
        const { keyword: name, range } = keywordOpt.get();
        values.push({ type: 'named', minus: false, name, range })
      } else {
        if (this.lexer.eof() || keywordOpt.isPresent()) {
          this.lexer.popMark();
          break;
        }
        this.lexer.popMark();
        this.readValue().ifPresent(value => values.push(value));
      }
    }
    return values;
  }

  statement(keyword: KeywordId, start: Position, firstKeyword = false): Optional<Statement> {
    const values = this.valuesWhileKeyword(firstKeyword);
    const range = { start, end: this.lexer.position(), src: this.lexer.text };
    return Optional.of({ keyword, type: 'statement', range, args: values, src: this.lexer.text })
  }

  maskKeyword(keyword: KeywordId, start: Position): Optional<Statement> {
    const value = this.statement(keyword, start, true);
    value.ifPresent(value => {
      const range = value.args[0].range;
      const nameString = toString(range);
      if (KeywordsMap.has(nameString)) {
        this.warninng(range, `variable ${nameString} masks keyword`);
        this.maskedKeywords.add(nameString);
      }
    });
    return value;
  }

  stringArgument(keyword: KeywordId, start: Position, args: number): Optional<Statement> {
    const values = this.valuesWhileKeyword(false, args);
    const stringStart = this.lexer.position();
    this.lexer.skipLine();
    const stringEnd = this.lexer.position();
    const range = { start: stringStart, end: stringEnd, src: this.lexer.text };
    values.push({ type: 'string', value: toString(range), range });
    return Optional.of({ keyword, type: 'statement', range: mergeHasRanges({ range: { start, end: start, src: this.lexer.text } }, ...values), args: values });
  }

  parse(): Statement[] {
    const list: Statement[] = [];
    this.lexer.skipWs();
    while (!this.lexer.eof()) {
      const keyword = this.lexer.nextKeyword(this.maskedKeywords);
      keyword
        .flatMap(({ keywordId: keyword, range }) => {
          const settings = Keywords.get(keyword);
          return settings?.stringArgument
            ? this.stringArgument(keyword, range.start, settings?.stringArgument)
            : settings?.maskKeywords
              ? this.maskKeyword(keyword, range.start)
              : this.statement(keyword, range.start)
        })
        .ifPresentOrElse(
          statement => list.push(statement),
          () => this.readValue()
            .ifPresentOrElse(
              value => this.error(value.range, `expected a statement, found '${toString(value.range)}'`),
              () => {
                const start = this.lexer.position();
                const c = this.lexer.current();
                this.lexer.next();
                const end = this.lexer.position();
                this.error({ start, end, src: this.lexer.text }, `unexpected '${String.fromCharCode(c)}'`);
              }
            )
        );
      this.lexer.skipWs();
    }
    return list;
  }
}

export type ParsedCon = {
  statements: Statement[],
  diagnostics: Diagnostic[],
}

export function parseCon(buf: ArrayBuffer): ParsedCon {
  const parser = new Parser(new Lexer(new Uint8Array(buf)));
  const statements = parser.parse();
  const diagnostics = parser.diagnostics;
  return { statements, diagnostics };
}

export async function parseConHandleIncludes(con: ArrayBuffer, loader: Fn<string, Promise<Optional<ArrayBuffer>>>): Promise<ParsedCon> {
  const { statements, diagnostics } = parseCon(con);
  const includes = statements.filter(s => s.keyword === KeywordId.CON_INCLUDE);
  const loadAndParse = async (fn: string) => asyncMapOptional(await loader(fn), ab => parseConHandleIncludes(ab, loader));
  const loaded = await Promise.all(includes.map(i => loadAndParse(toString(i.args[0].range)).then(o => o.map(con => pair(con, i)))));
  loaded.map(o => o.ifPresent(([con, stat]) => {
    const idx = statements.indexOf(stat);
    statements.splice(idx, 1, ...con.statements);
    con.diagnostics.forEach(d => diagnostics.push(d));
  }));
  return { statements, diagnostics };
}