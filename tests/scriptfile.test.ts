import * as fs from 'fs';
import Optional from 'optional-js';
import path from 'path';
import { KeywordId } from '../src/build/formats/con/constants';
import { as, parseCon, parseConHandleIncludes, toStringHasRange } from '../src/build/formats/con/parser';
import { createDefFile } from '../src/utils/deffile';

const gameCon = fs.readFileSync(path.resolve(__dirname, './game.con'), 'utf8');

const encoder: TextEncoder = new TextEncoder();
function parse(text: string) {
  return parseCon(encoder.encode(text).buffer);
}

const TEST1 = encoder.encode(`foo [].baz`).buffer;

test('basic', async () => {
  const tokens = await createDefFile("test1", TEST1).parse<string[]>([], async (sf, ctx) => {
    let token = sf.getToken();
    while (token !== '') {
      ctx.push(token);
      token = sf.getToken();
    }
  });
  expect(tokens).toStrictEqual(['foo', '[].baz']);
});

test('con-basic', () => {
  const res1 = parse('var foo 0 1 2 3');
  expect(as(res1.statements[0].args[0], 'named').name).toBe("foo");
  expect(toStringHasRange(res1.statements[0].args[0])).toBe("foo");
  expect(as(res1.statements[0].args[1], 'const').value).toBe(0);

  const { statements: [def1, def2, def3] } = parse(`
    var foo 0 1 2 3
    var bar; // comment
    /* fdsfsdf */
    var baz
    `);
  expect(as(def1.args[0], 'named').name).toBe("foo");
  expect(def1.range.start).toStrictEqual({ pos: 5, line: 2, col: 5 });
  expect(def1.range.end).toStrictEqual({ pos: 20, line: 2, col: 20 });
  expect(as(def2.args[0], 'named').name).toBe("bar");
  expect(def2.range.start).toStrictEqual({ pos: 25, line: 3, col: 5 });
  expect(def2.range.end).toStrictEqual({ pos: 32, line: 3, col: 12 });
  expect(as(def3.args[0], 'named').name).toBe("baz");
  expect(def3.range.start).toStrictEqual({ pos: 67, line: 5, col: 5 });
  expect(def3.range.end).toStrictEqual({ pos: 74, line: 5, col: 12 });
})

test('con-diagnostics', () => {
  const res = parse(`
    var tmp

    defstate state1
      set tpm 0x11
      set 11
      getsprite[].x tmp
      geta[x].x tmp
      palfrom 1 2 3 4 5
      palfrom 1 2 3 4
      palfrom

      ife temp 1
        ife temp 0
      {
          nullop
      }
      else
      {
          quote 100
      }
    ends
    `);

  expect(toStringHasRange(res.statements[0])).toBe('var tmp');
  expect(toStringHasRange(res.statements[1])).toBe('defstate state1');
  expect(toStringHasRange(res.statements[2])).toBe('set tpm 0x11');
  expect(toStringHasRange(res.statements[3])).toBe('set 11\n      getsprite[].x tmp');
  expect(toStringHasRange(res.statements[4])).toBe('geta[x].x tmp');
  expect(toStringHasRange(res.statements[5])).toBe('palfrom 1 2 3 4 5');
  expect(toStringHasRange(res.statements[6])).toBe('palfrom 1 2 3 4');
  expect(toStringHasRange(res.statements[7])).toBe('palfrom');
  expect(toStringHasRange(res.statements[8])).toBe('ife temp 1');
  expect(toStringHasRange(res.statements[9])).toBe('ife temp 0');
  expect(toStringHasRange(res.statements[10])).toBe('{');
  expect(toStringHasRange(res.statements[11])).toBe('nullop');
  expect(toStringHasRange(res.statements[12])).toBe('}');
  expect(toStringHasRange(res.statements[13])).toBe('else');
  expect(toStringHasRange(res.statements[14])).toBe('{');
  expect(toStringHasRange(res.statements[15])).toBe('quote 100');
  expect(toStringHasRange(res.statements[16])).toBe('}');
  expect(toStringHasRange(res.statements[17])).toBe('ends');
  expect(res.diagnostics.length).toBe(0);
});

test('con-keyword-masking', () => {
  const res = parse(`
    var defstate

    defstate foo
      set tmp 1
      geta[].x x
    ends
    `);

  expect(res.statements.length).toBe(4);
  expect(toStringHasRange(res.statements[0])).toBe('var defstate');
  expect(toStringHasRange(res.statements[1])).toBe('set tmp 1');
  expect(toStringHasRange(res.statements[2])).toBe('geta[].x x');
  expect(toStringHasRange(res.statements[3])).toBe('ends');

  expect(res.diagnostics.length).toBe(3);
  expect(res.diagnostics[0].description).toBe('variable defstate masks keyword');
  expect(res.diagnostics[1].description).toBe(`expected a statement, found 'defstate'`);
  expect(res.diagnostics[2].description).toBe(`expected a statement, found 'foo'`);
});

test('con-named-parsing', () => {
  const { statements, diagnostics } = parse(`
    set foo.bar 1
    set foo[1].foo 1
    set foo.bar.baz[index.x].zzz 1

    set [].x 1
    set .[x] 1
    set x[a + b] 1
    `);

  const name1 = as(statements[0].args[0], 'named');
  const name2 = as(statements[1].args[0], 'named');
  const name3 = as(statements[2].args[0], 'named');
  const name4 = as(statements[3].args[0], 'named');
  const name5 = as(statements[4].args[0], 'named');

  expect(diagnostics.length).toBe(5);
  expect(diagnostics[0].description).toBe(`expecting ']'`);
  expect(diagnostics[1].description).toBe(`unexpected '+'`);
  expect(diagnostics[2].description).toBe(`expected a statement, found 'b'`);
  expect(diagnostics[3].description).toBe(`unexpected ']'`);
  expect(diagnostics[4].description).toBe(`expected a statement, found '1'`);

  expect(toStringHasRange(name1)).toBe('foo.bar');
  expect(toStringHasRange(name2)).toBe('foo[1].foo');
  expect(toStringHasRange(name3)).toBe('foo.bar.baz[index.x].zzz');
  expect(toStringHasRange(name4)).toBe('[].x');
  expect(toStringHasRange(name5)).toBe('.[x]');

  expect(name1.name).toBe('foo.bar');
  expect(name2.name).toBe('foo');
  expect(name3.name).toBe('foo.bar.baz');
  expect(name4.name).toBe('');
  expect(name5.name).toBe('.');
  expect(name1.index).toBeUndefined();
  expect(toStringHasRange(name2.index?.field)).toBe('foo');
  expect(toStringHasRange(name2.index?.index)).toBe('1');
  expect(toStringHasRange(name3.index?.field)).toBe('zzz');
  expect(toStringHasRange(name3.index?.index)).toBe('index.x');
  expect(toStringHasRange(name4.index?.field)).toBe('x');
  expect(toStringHasRange(name4.index?.index)).toBe('');
  expect(name5.index?.field).toBeUndefined();
  expect(toStringHasRange(name5.index?.index)).toBe('x');
})

test('con-string-arguments', () => {
  const { statements, diagnostics } = parse(`
    definequote 1000 foo bar baz [] ? ### /* */ //
    definequote
    definequote fooo/*bar*/baz
    definequote foo?name
    definequote foo[]name 123
    `);

  expect(statements.length).toBe(5);
  expect(diagnostics.length).toBe(0);

  expect(toStringHasRange(statements[0].args[1])).toBe(' foo bar baz [] ? ### /* */ //');
  expect(statements[1].args[1]).toBeUndefined();
  expect(toStringHasRange(statements[2].args[0])).toBe('fooo/*bar*/baz');
  expect(toStringHasRange(statements[2].args[1])).toBe('');
  expect(toStringHasRange(statements[3].args[0])).toBe('foo');
  expect(toStringHasRange(statements[3].args[1])).toBe('?name');
  expect(toStringHasRange(statements[4].args[0])).toBe('foo[]');
  expect(toStringHasRange(statements[4].args[1])).toBe('name 123');
})

test('con-game-con', () => {
  const { statements, diagnostics } = parse(gameCon);

  expect(diagnostics.length).toBe(0);
  expect(statements.length).toBe(7940);

  expect(statements.slice(6000, 6010).map(s => toStringHasRange(s))).toEqual([
    "else",
    "ifwasweapon SHRINKSPARK",
    "{",
    "sound ACTOR_SHRINKING",
    "ai AIBOSS1PALSHRINK",
    "cstat 0",
    "break",
    "}",
    "soundonce BOS1_PAIN",
    "debris SCRAP1 1",
  ]);
})

test('con-include', async () => {
  const { statements, diagnostics } = await parseConHandleIncludes(encoder.encode(gameCon).buffer, async name => Optional.of(encoder.encode(fs.readFileSync(path.resolve(__dirname, `./${name}`), 'utf8')).buffer));

  expect(diagnostics.length).toBe(0);
  expect(statements.length).toBe(9807);

  const definesounds = statements.filter(s => s.keyword === KeywordId.CON_DEFINESOUND);
  expect(definesounds.length).toBe(376);
  expect(definesounds.slice(100, 110).map(d => `${toStringHasRange(d.args[0])} ${toStringHasRange(d.args[1])}`)).toEqual([
    "SHRINKER_FIRE shrinker.voc",
    "ACTOR_SHRINKING shrink.voc",
    "ACTOR_GROWING enlarge.voc",
    "PIPEBOMB_BOUNCE pbombbnc.voc",
    "PIPEBOMB_EXPLODE bombexpl.voc",
    "LASERTRIP_ONWALL lsrbmbpt.voc",
    "LASERTRIP_ARMING lsrbmbwn.voc",
    "LASERTRIP_EXPLODE bombexpl.voc",
    "NITEVISION_ONOFF goggle12.voc",
    "SELECT_WEAPON WPNSEL21.VOC",
  ]);

  const defines = statements.filter(s => s.keyword === KeywordId.CON_DEFINE);
  expect(defines.length).toBe(1315);
  expect(defines.slice(1000, 1010).map(d => toStringHasRange(d.args[0]))).toEqual([
    "DUKE_CRACK2",
    "DUKE_SEARCH",
    "DUKE_GET",
    "DUKE_LONGTERM_PAIN",
    "MONITOR_ACTIVE",
    "NITEVISION_ONOFF",
    "DUKE_HIT_STRIPPER2",
    "DUKE_CRACK_FIRST",
    "DUKE_USEMEDKIT",
    "DUKE_TAKEPILLS",
  ]);
})