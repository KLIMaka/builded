import { range } from "@utils/collections";
import { Stream, array, atomic_array, bits, byte, struct, ubyte, uint, ushort } from "../../utils/stream";
import { iter } from "@utils/iter";

export class ArtInfo {
  constructor(public w: number, public h: number, public attrs: Attributes, public img: Uint8Array) { }
}

export type Header = {
  version: number;
  numtiles: number;
  start: number;
  end: number;
}

const headerStruct = struct<Header>()
  .field('version', uint)
  .field('numtiles', uint)
  .field('start', uint)
  .field('end', uint);

export enum AnimationType {
  NO_ANIMATION = 0,
  OSCILLATING_ANIMATION = 1,
  ANIMATE_FORWARD = 2,
  ANIMATE_BACKWARD = 3,
}

export class Attributes {
  frames = 0;
  animType = AnimationType.NO_ANIMATION;
  xoff = 0;
  yoff = 0;
  speed = 0;
  type = 0;
}

export const EMPTY_INFO = new ArtInfo(0, 0, new Attributes(), new Uint8Array(0));

export function animate(frame: number, info: ArtInfo) {
  if (info.attrs.frames === 0) return 0;
  const max = info.attrs.frames + 1;
  if (info.attrs.animType === AnimationType.NO_ANIMATION) return 0;
  else if (info.attrs.animType === AnimationType.OSCILLATING_ANIMATION) {
    const x = frame % (max * 2 - 2);
    return x >= max ? max * 2 - 2 - x : x;
  } else if (info.attrs.animType === AnimationType.ANIMATE_FORWARD) return frame % max;
  else if (info.attrs.animType === AnimationType.ANIMATE_BACKWARD) return - frame % max;
}

export const animStruct = struct<Attributes>()
  .field('frames', bits(6))
  .field('animType', bits(2))
  .field('xoff', byte)
  .field('yoff', byte)
  .field('speed', bits(4))
  .field('type', bits(4));

export type ArtFile = {
  header: Header,
  arts: ArtInfo[]
}

function checkVersion(stream: Stream) {
  const version = stream.readUInt();
  if (version === 1) {
    stream.setOffset(0); return;
  } else if (version === 0x4c495542 && stream.readUInt() === 0x54524144) return; // BUILDART
  throw new Error('Invalid Art File');
}

export function readArtFile(buffer: ArrayBuffer): ArtFile {
  const stream = new Stream(buffer);
  checkVersion(stream);
  const header = headerStruct.read(stream);
  const size = header.end - header.start + 1;
  const hs = array(ushort, size).read(stream);
  const ws = array(ushort, size).read(stream);
  const attrs = array(animStruct, size).read(stream);
  const arts = iter(range(0, size)).map(i => {
    const w = ws[i];
    const h = hs[i];
    const attr = attrs[i];
    const pixels = atomic_array(ubyte, w * h).read(stream);
    return new ArtInfo(h, w, attr, pixels);
  }).collect();
  return { header, arts }
}

export interface ArtInfoProvider {
  getInfo(picnum: number): ArtInfo;
}