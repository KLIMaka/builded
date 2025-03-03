import Optional from "optional-js";
import { getOrDefaultF } from "./collections";
import { iter } from "./iter";
import { nextpow2 } from "./mathutils";
import { asyncMapOptional } from "./objects";
import { BiConsumer, BiFunction, Consumer, Function, identity, MultiConsumer, MultiFunction } from "./types";
import { NOOP_TASK_HANDLE, TaskHandle } from "app/apis/app1";

const _R = '\r'.charCodeAt(0);
const _N = '\n'.charCodeAt(0);
const _SPACE = ' '.charCodeAt(0);
const _T = '\t'.charCodeAt(0);
const _SLASH = '/'.charCodeAt(0);
const _BACKSLASH = '\\'.charCodeAt(0);
const _STAR = '*'.charCodeAt(0);
const _QUOTE = '"'.charCodeAt(0);
const _LBRACE = '{'.charCodeAt(0);
const _RBRACE = '}'.charCodeAt(0);

function checkNl(tx: Uint8Array, off: number): [number, boolean] {
  if (tx[off] === _R) return tx[off + 1] === _N ? [off + 1, true] : [off, true]
  if (tx[off] === _N) return tx[off + 1] === _R ? [off + 1, true] : [off, true]
  return [off, false]
}

export class ExistedSymbolError extends Error {
}

export function createScripFile(name: string, buf: ArrayBuffer, taskHandle: TaskHandle = NOOP_TASK_HANDLE): ScriptFile {
  const bufCopy = buf.slice(0);
  const inText = new Uint8Array(bufCopy);
  const lineOffs: number[] = [];
  let nflen = 0;
  let cs = 0;
  let ws = false;
  let inquote = false;
  for (let i = 0; i < inText.length; i++) {
    let cr = false;
    [i, cr] = checkNl(inText, i);
    if (cr) {
      lineOffs.push(nflen);
      if (cs === 1) cs = 0;
      ws = true;
      continue; //strip CR/LF
    }

    if ((!inquote) && ((inText[i] === _SPACE) || (inText[i] === _T))) {
      ws = true;
      continue;
    }  // strip Space/Tab
    if ((inText[i] === _SLASH) && (inText[i + 1] === _SLASH) && cs === 0)
      cs = 1;
    if ((inText[i] === _SLASH) && (inText[i + 1] === _STAR) && cs === 0) {
      ws = true;
      cs = 2;
    }
    if ((inText[i] === _STAR) && (inText[i + 1] === _SLASH) && (cs === 2)) {
      cs = 0;
      i++;
      continue;
    }
    if (cs)
      continue;
    if (ws) {
      inText[nflen++] = 0;
      ws = false;
    }
    //quotes inside strings: \"
    if ((inText[i] === _BACKSLASH) && (inText[i + 1] === _QUOTE)) { i++; inText[nflen++] = _QUOTE; continue; }
    if (inText[i] === _QUOTE) { inquote = !inquote; continue; }
    inText[nflen++] = inText[i];
  }
  inText[nflen++] = 0;
  lineOffs.push(nflen);
  inText[nflen++] = 0;

  return new ScriptFile(name, new Uint8Array(bufCopy.slice(0, nflen - 1)), lineOffs, taskHandle);
}

export class ScriptFile {
  private textPtr = 0;
  private decoder = new TextDecoder();

  constructor(
    private name: string,
    private text: Uint8Array,
    private lineOffs: number[],
    readonly taskHandle: TaskHandle = NOOP_TASK_HANDLE
  ) { }

  linenum(off: number): number {
    const lines = this.lineOffs.length;
    let stp = nextpow2(lines) >> 1;
    let i = 0;
    for (i = 0; stp !== 0; stp >>= 1)
      if ((i + stp - 1 < lines) && (this.lineOffs[i + stp - 1] < off)) i += stp;
    return i + 1; //i = index to highest lineoffs which is less than ind; convert to 1-based line numbers
  }

  isEof() {
    return this.textPtr >= this.text.length;
  }

  skipOverWs() {
    if (!this.isEof() && this.text[this.textPtr] === 0)
      this.textPtr++;
  }

  skipOverToken() {
    while (!this.isEof() && this.text[this.textPtr] !== 0) this.textPtr++;
  }

  logPrefix(): string {
    const linenum = this.linenum(this.textPtr);
    return this.name + ':' + linenum;
  }

  getBraces(): number {
    this.skipOverWs();
    if (this.isEof()) throw new Error();
    if (this.text[this.textPtr] !== _LBRACE) throw new Error(`${this.logPrefix()}: Expected '{'`)
    let ptr = ++this.textPtr;
    let bracecnt = 1;
    for (; ;) {
      if (ptr >= this.text.length) throw new Error(`${this.logPrefix()}: Nonbalanced braces starting here`)
      else if (this.text[ptr] === _LBRACE) bracecnt++;
      else if (this.text[ptr] === _RBRACE)
        if (!(--bracecnt)) break;
      ptr++;
    }
    return ptr;
  }

  getToken(): string {
    this.skipOverWs();
    if (this.isEof()) return null;
    const start = this.textPtr;
    this.skipOverToken();
    return this.decoder.decode(this.text.subarray(start, this.textPtr));
  }

  * getTokens(): Generator<string> {
    const end = this.getBraces();
    this.skipOverWs();
    while (this.textPtr < end) {
      yield this.getToken();
      this.skipOverWs();
    }
    if (this.getToken() !== '}') throw new Error();
  }

  async parse<T>(ctx: T, parser: BiFunction<ScriptFile, T, Promise<void>>, braced = false): Promise<T> {
    let start = this.textPtr;
    const end = (braced) ? this.getBraces() : this.text.length;
    this.taskHandle.plan(end - start);
    this.skipOverWs();
    while (this.textPtr < end) {
      await this.taskHandle.waitFor(parser(this, ctx), `Parsing ${this.name}...`, 0);
      this.taskHandle.incProgress(this.textPtr - start);
      start = this.textPtr;
      this.skipOverWs();
    }
    if (braced && this.getToken() !== '}') throw new Error();
    return ctx;
  }

  parseBraced<T>(ctx: T, parser: BiFunction<ScriptFile, T, Promise<void>>) {
    return this.parse(ctx, parser, true);
  }
}

type Parser<C, T extends any[]> = {
  tokenAliases: string[],
  argsParser: BiFunction<ScriptFile, C, T>,
  processor: MultiFunction<[ScriptFile, C, ...T], Promise<void>>
}

export function rule<C, T extends any[]>(
  tokenAliases: string[],
  argsParser: BiFunction<ScriptFile, C, T>,
  processor: MultiFunction<[ScriptFile, C, ...T], Promise<void>>
): Parser<C, T> {
  return { tokenAliases, argsParser, processor }
}

export function simpleRule<C, T extends any[]>(
  tokenAliases: string[],
  argsParser: BiFunction<ScriptFile, C, T>,
  compositor: MultiConsumer<[C, ...T]>
): Parser<C, T> {
  const processor = async (_sf: ScriptFile, ctx: C, ...args: T) => compositor(ctx, ...args);
  return { tokenAliases, argsParser, processor }
}

export function nestedRule<C, NC, T extends any[]>(
  tokenAliases: string[],
  argsParser: BiFunction<ScriptFile, C, T>,
  nestedCtxFactory: MultiFunction<[C, ...T], NC>,
  compositor: MultiConsumer<[C, NC]>,
  nestedParser: BiFunction<ScriptFile, NC, Promise<void>>,
): Parser<C, T> {
  const processor = async (sf: ScriptFile, ctx: C, ...args: T) => compositor(ctx, await sf.parseBraced(nestedCtxFactory(ctx, ...args), nestedParser));
  return { tokenAliases, argsParser, processor }
}

export type HasSymbols = { symbols: Map<string, number> }
function resolve(ctx: HasSymbols, token: string): number {
  return getOrDefaultF(ctx.symbols, token, t => Number.parseInt(t))
}

export function tuple<C, T extends any[]>(...parsers: { [P in keyof T]: BiFunction<ScriptFile, C, T[P]> }): BiFunction<ScriptFile, C, T> {
  return (sf, ctx) => [...parsers.map(p => p(sf, ctx))] as T
}

export function tokens(): Function<ScriptFile, [Iterable<string>]> {
  return sf => [sf.getTokens()];
}

export function symbols<C extends HasSymbols>(): BiFunction<ScriptFile, C, [Iterable<number>]> {
  return (sf, ctx) => [sf.getTokens().map(t => resolve(ctx, t))];
}

export function rules<C>(...rules: Parser<C, any>[]): BiFunction<ScriptFile, C, Promise<void>> {
  return async (sf, ctx) => {
    const token = sf.getToken();
    await iter(rules).first(r => r.tokenAliases.includes(token))
      .map(r => r.processor(sf, ctx, ...r.argsParser(sf, ctx))).orElse(Promise.resolve())
  }
}

export function rulesInclude<C>(includer: Function<string, Promise<Optional<ArrayBuffer>>>, files: Set<String>, ...rules: Parser<C, any>[]): BiFunction<ScriptFile, C, Promise<void>> {
  const includeParser = async (sf: ScriptFile, ctx: C, inc: string) => {
    const handle = sf.taskHandle;
    files.add(inc);
    handle.plan(1);
    const file = await handle.waitFor(includer(inc), `Loading ${inc}...`);
    await asyncMapOptional(file, async f => {
      const sfi = createScripFile(inc, f, sf.taskHandle);
      return await sfi.parse(ctx, parser);
    });
  }
  const newRules = [rule(['include', '#include'], tuple(token), includeParser), ...rules];
  const parser = async (sf: ScriptFile, ctx: C) => {
    const token = sf.getToken();
    await iter(newRules)
      .first(r => r.tokenAliases.includes(token))
      .map(r => r.processor(sf, ctx, ...r.argsParser(sf, ctx)))
      .orElse(Promise.resolve())
  }
  return parser;
}

export function token(sf: ScriptFile, ctx: any) { return sf.getToken() }
export function number(sf: ScriptFile, ctx: any) { return Number.parseFloat(sf.getToken()) }
export function symbol<C extends HasSymbols>(sf: ScriptFile, ctx: C) { return resolve(ctx, sf.getToken()) }

export function compositor<C, D, T, T1>(dst: Function<C, D>, action: BiConsumer<D, T1>, transformer: Function<T, T1>): BiConsumer<C, T> {
  return (ctx, value) => action(dst(ctx), transformer(value));
}

export function setTransformed<C, K extends keyof C, T>(field: K, t: Function<T, C[K]>): BiConsumer<C, T> {
  return (ctx, value) => ctx[field] = t(value);
}

export function set<C, K extends keyof C>(field: K): BiConsumer<C, C[K]> {
  return setTransformed(field, identity())
}

type isBool<T, K> = T extends boolean ? K : never;
type BoolFields<T> = { [K in keyof Required<T>]: isBool<T[K], K> }[keyof T];
export function setBool<C, K extends BoolFields<C>>(field: K): Consumer<C> {
  return ctx => (ctx[field] as boolean) = true;
}

export function pushTransformed<C, D extends Array<T>, T, T1>(dst: Function<C, D>, t: Function<T1, T>): BiConsumer<C, T1> {
  return (ctx, value) => dst(ctx).push(t(value))
}

export function push<C extends Array<T>, T>(): BiConsumer<C, T> {
  return pushTransformed(identity(), identity())
}

export function pushField<C, D extends C[K] & Array<T>, K extends keyof C, T>(field: K): BiConsumer<C, T> {
  return pushTransformed(c => c[field] as D, identity())
}

export function pushFieldTransformed<C, D extends C[K] & Array<T>, K extends keyof C, T, T1>(field: K, t: Function<T1, T>): BiConsumer<C, T1> {
  return pushTransformed(c => c[field] as D, t)
}

export const self = identity;
export function field<C, K extends keyof C>(field: K): Function<C, C[K]> { return ctx => ctx[field] }

export function mapSet<K, V, C extends Map<K, V>>(): MultiConsumer<[C, K, V]> {
  return (ctx, k, v) => ctx.set(k, v)
}

export function mapSetVK<K, V, C extends Map<K, V>>(): MultiConsumer<[C, V, K]> {
  return (ctx, v, k) => ctx.set(k, v)
}

export function defaultDefine<C extends HasSymbols>(): Parser<C, any> {
  return simpleRule(['define', '#define'], tuple(token, number), (ctx, name, value) => ctx.symbols.set(name, value))
}

type isString<T, K> = T extends string ? K : never;
type StringFields<T> = { [K in keyof Required<T>]: isString<T[K], K> }[keyof T];
export function stringRule<C, K extends StringFields<C>>(field: K, ...aliases: string[]): Parser<C, [string]> {
  const processor = async (_sf: ScriptFile, ctx: C, value: string) => { (ctx[field] as string) = value };
  return { tokenAliases: [field.toString(), ...aliases], argsParser: tuple(token), processor }
}

type isNumber<T, K> = T extends number ? K : never;
type NumberFields<T> = { [K in keyof Required<T>]: isNumber<T[K], K> }[keyof T];
export function numberRule<C, K extends NumberFields<C>>(field: K, ...aliases: string[]): Parser<C, [number]> {
  const processor = async (_sf: ScriptFile, ctx: C, value: number) => { (ctx[field] as number) = value };
  return { tokenAliases: [field.toString(), ...aliases], argsParser: tuple(number), processor }
}

export function boolRule<C, K extends BoolFields<C>>(field: K, ...aliases: string[]): Parser<C, []> {
  const processor = async (_sf: ScriptFile, ctx: C) => { (ctx[field] as boolean) = true };
  return { tokenAliases: [field.toString(), ...aliases], argsParser: tuple(), processor }
}