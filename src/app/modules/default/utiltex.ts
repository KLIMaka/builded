import { Lexer, LexerRule } from "../../../utils/lexer";
import { getInstances, Injector, provider } from "../../../utils/injector";
import { Texture } from "../../../utils/gl/drawstruct";
import { GL, createIndexedTexture, TextureProvider } from "../buildartprovider";
import { FS } from "../fs/fs";
import { INDEXED_IMG_LIB } from "../../../utils/imglib";
import { loadImageFromBuffer, loadImage } from "../../../utils/imgutils";
import { createTexture } from "../../../utils/gl/textures";

function createLexer(str: string) {
  const lexer = new Lexer();
  lexer.addRule(new LexerRule(/^[ \t\r\v\n]+/, 'WS'));
  lexer.addRule(new LexerRule(/^[a-zA-Z_][a-zA-Z0-9_]+/, 'ID'));
  lexer.addRule(new LexerRule(/^\-?[0-9]+/, 'INT', 0, parseInt));
  lexer.addRule(new LexerRule(/^"([^"]*)"/, 'STRING', 1));
  lexer.addRule(new LexerRule(/^;/, 'SEMICOLON'));
  lexer.setSource(str);

  return {
    get: <T>(expected: string, value: T = null): T => {
      for (; lexer.next() == 'WS';);
      if (lexer.isEoi()) throw new Error();
      let tokenId = lexer.rule().name;
      let actual = lexer.value();
      if (tokenId != expected || value != null && value != actual) throw new Error();
      return lexer.value();
    }
  }
}

async function loadTexture(gl: WebGLRenderingContext, name: string, options: any = {}, format = gl.RGBA, bpp = 4) {
  return loadImage(name).then(img => createTexture(img[0], img[1], gl, options, img[2], format, bpp))
}

export const DefaultAdditionalTextures = provider(async (injector: Injector) => {
  const textures: { [index: number]: Texture } = {};
  const [gl, fs, lib] = await getInstances(injector, GL, FS, INDEXED_IMG_LIB);
  const file = await fs.get('texlist.lst');
  const decoder = new TextDecoder('utf-8');
  const list = decoder.decode(file);
  const lexer = createLexer(list);

  try {
    for (; ;) {
      const id = lexer.get<number>('INT');
      const path = lexer.get<string>('STRING');
      const options = lexer.get<string>('ID');
      lexer.get('SEMICOLON');

      if (options == 'plain') {
        const opts = { filter: WebGLRenderingContext.NEAREST, repeat: WebGLRenderingContext.CLAMP_TO_EDGE };
        textures[id] = await loadTexture(gl, path, opts);
      } else if (options == 'palletize') {
        const texture = await fs.get(path);
        const [w, h, buff] = await loadImageFromBuffer(texture);
        const indexed = lib.palettize(w, h, buff);
        textures[id] = createIndexedTexture(gl, w, h, indexed, true, lib);
      }
    }
  } finally {
    return (id: number) => textures[id];
  }
});