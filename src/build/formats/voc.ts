import { int } from "ts-utils/mathutils";
import { atomic_array, bits, builder, byte, short, Stream, string, ubyte, uint, ushort } from "ts-utils/stream";

const HEADER = builder()
  .field('sig', string(19))
  .field('eof', byte)
  .field('off', ushort)
  .field('version', ushort)
  .field('validation', ushort)
  .build();

const HEADER9 = builder()
  .field('bps', ubyte)
  .field('channels', ubyte)
  .field('codec', ushort)
  .field('unk', uint)
  .build();

const U24 = bits(24);

export type Voc8Block = {
  type: '8',
  data: Uint8Array,
  sampleRate: number,
}

export type Voc16Block = {
  type: '16',
  data: Int16Array,
  sampleRate: number,
}

export type VocBlock = Voc8Block | Voc16Block;

function createWriter() {
  let data: Uint8Array | Int16Array | undefined = undefined;
  let sampleRate = 0;

  const write8 = (blockData: Uint8Array) => {
    const ndata = new Uint8Array((data?.length ?? 0) + blockData.length);
    if (data) ndata.set(data, 0);
    ndata.set(blockData, (data?.length ?? 0));
    data = ndata;
  }

  const write16 = (blockData: Int16Array) => {
    const ndata = new Int16Array((data?.length ?? 0) + blockData.length);
    if (data) ndata.set(data, 0);
    ndata.set(blockData, (data?.length ?? 0));
    data = ndata;
  }


  const setSampleRate = (sr: number) => { sampleRate = sr }
  const build = (): VocBlock => {
    if (data instanceof Int16Array) return { type: '16', data, sampleRate }
    if (data instanceof Uint8Array) return { type: '8', data, sampleRate }
    throw new Error('Invalid voc file');
  };
  return { write8, write16, setSampleRate, build };
}


export function readVoc(buff: ArrayBuffer): VocBlock {
  const stream = new Stream(buff);
  const header = HEADER.read(stream);
  stream.setOffset(header.off);

  const writer = createWriter();

  while (!stream.eoi()) {
    const type = ubyte.read(stream);
    if (type === 0) break;
    const blockHeadData = U24.read(stream);
    if (type === 1) {
      writer.setSampleRate(int(1000000 / (256 - ubyte.read(stream))));
      const codec = ubyte.read(stream);
      writer.write8(atomic_array(ubyte, blockHeadData - 2).read(stream));
    } else if (type === 2) {
      writer.write8(atomic_array(ubyte, blockHeadData).read(stream));
    } else if (type === 5) {
      stream.skip(blockHeadData);
    } else if (type === 9) {
      writer.setSampleRate(uint.read(stream));
      const h = HEADER9.read(stream);
      if (h.bps === 8) writer.write8(atomic_array(ubyte, blockHeadData - 12).read(stream));
      else writer.write16(atomic_array(short, (blockHeadData - 12) / 2).read(stream));
    } else throw new Error(`Invalid voc block type: ${type}`);
  }
  return writer.build();
}
