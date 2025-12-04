import { iter } from "ts-utils/iter";
import { array, atomic_array, bits, byte, Stream, struct, ubyte, uint, ushort } from "ts-utils/stream";

export class ArtInfo {
  constructor(
    readonly w: number,
    readonly h: number,
    readonly attrs: Attributes,
    readonly img: Uint8Array) { }
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

export type Attributes = Readonly<{
  frames: number;
  animType: AnimationType;
  xoff: number;
  yoff: number;
  speed: number;
  type: number;
}>;

export const EMPTY_ATTRS: Attributes = {
  animType: AnimationType.NO_ANIMATION,
  frames: 0,
  xoff: 0,
  yoff: 0,
  speed: 0,
  type: 0
}

export const EMPTY_INFO = new ArtInfo(0, 0, EMPTY_ATTRS, new Uint8Array(0));

export function animate(frame: number, info: ArtInfo): number {
  if (info.attrs.frames === 0) return 0;
  const max = info.attrs.frames + 1;
  if (info.attrs.animType === AnimationType.NO_ANIMATION) return 0;
  else if (info.attrs.animType === AnimationType.OSCILLATING_ANIMATION) {
    const x = frame % (max * 2 - 2);
    return x >= max ? max * 2 - 2 - x : x;
  } else if (info.attrs.animType === AnimationType.ANIMATE_FORWARD) return frame % max;
  else if (info.attrs.animType === AnimationType.ANIMATE_BACKWARD) return - frame % max;
  return 0;
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
  fileSize: number,
}


function checkVersion(stream: Stream) {
  const version = stream.readUInt();
  if (version === 1) {
    stream.setOffset(0);
    return;
  }
  stream.setOffset(0);
  const signature = stream.readByteString(8);
  if (signature === 'BUILDART') return;
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
  const arts = iter(ws).zip2(hs, attrs).map(([w, h, attr]) => new ArtInfo(h, w, attr, atomic_array(ubyte, w * h).read(stream))).collect();
  const fileSize = buffer.byteLength;
  return { header, arts, fileSize }
}