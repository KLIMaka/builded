import { createScripFile, number, rule, ScriptFile, symbol, token, tuple } from "@utils/scriptfile";
import { BiFn, Fn } from "ts-utils/types";


type Const = { type: 'const', value: number };
type Named = { type: 'name', name: string };
type Indexed = { type: 'indexed', name: string, index: Const | Named };
type Struct = { type: 'struct', object: Named | Indexed, fiedl: string };


type AST = {
  state(name: string): AST;
  var(label: string, initValue: number, flags: number[]): void;
};

const keywords = new Set<string>();

function restTokens<T>(parser: Fn<string, T>) {
  return (sf: ScriptFile, ctx: any): T[] => {
    const tokens: T[] = [];
    for (; ;) {
      const token = sf.getToken();
      if (keywords.has(token)) {
        sf.stepBack();
        return tokens;
      }
      tokens.push(parser(token));
    }
  }
}

const GAMEVAR = rule(['gamevar', 'var'], tuple(token, token, restTokens(Number.parseInt)), async (sf, ast: AST, label, initValue, flags) => ast.var(label, initValue, flags));

const DEFSTATE = rule(['defstate'], tuple(token), async (sf, ast: AST, name) => sf.parseUntil(ast.state(name),))

export function parseCon(buf: ArrayBuffer, file: string) {
  const sf = createScripFile(file, buf);
  sf.parse()
}