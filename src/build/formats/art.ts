import { struct, bits, Stream, array, ushort, atomic_array, ubyte, byte } from "../../utils/stream";

export class ArtInfo {
  constructor(public w: number, public h: number, public attrs: Attributes, public img: Uint8Array) { }
}

export const NO_ANIMATION = 0;
export const ANIMATE_FORWARD = 2;
export const OSCILLATING_ANIMATION = 1;
export const ANIMATE_BACKWARD = 3;

export class Attributes {
  public frames: number;
  public type: number;
  public xoff: number;
  public yoff: number;
  public speed: number;
  public unk: number;
}

export function animate(frame: number, info: ArtInfo) {
  const max = info.attrs.frames + 1;
  if (info.attrs.type == NO_ANIMATION) return 0;
  else if (info.attrs.type == OSCILLATING_ANIMATION) {
    const x = frame % (max * 2 - 2);
    return x >= max ? max * 2 - 2 - x : x;
  } else if (info.attrs.type == ANIMATE_FORWARD) return frame % max;
  else if (info.attrs.type == ANIMATE_BACKWARD) return max - frame % max;
}

var anumStruct = struct(Attributes)
  .field('frames', bits(6))
  .field('type', bits(2))
  .field('xoff', byte)
  .field('yoff', byte)
  .field('speed', bits(4))
  .field('unk', bits(4));

export class ArtFile {

  public offsets: number[];
  public ws: number[];
  public hs: number[];
  public anums: Attributes[];
  public start: number;
  public end: number;
  public size: number;


  constructor(private stream: Stream) {
    var version = stream.readUInt();
    var numtiles = stream.readUInt();
    var start = stream.readUInt();
    var end = stream.readUInt();
    var size = end - start + 1;
    var hs = array(ushort, size).read(stream);
    var ws = array(ushort, size).read(stream);
    var anums = array(anumStruct, size).read(stream);
    var offsets = new Array<number>(size);
    var offset = stream.mark();
    for (var i = 0; i < size; i++) {
      offsets[i] = offset;
      offset += ws[i] * hs[i];
    }

    this.offsets = offsets;
    this.ws = ws;
    this.hs = hs;
    this.anums = anums;
    this.start = start;
    this.end = end;
    this.size = size;
  }

  public getInfo(id: number): ArtInfo {
    var offset = this.offsets[id];
    this.stream.setOffset(offset);
    var w = this.ws[id];
    var h = this.hs[id];
    var anum = this.anums[id];
    var pixels = atomic_array(ubyte, w * h).read(this.stream);
    return new ArtInfo(h, w, anum, pixels);
  }

  public getStart(): number {
    return this.start;
  }

  public getEnd(): number {
    return this.end;
  }
}

export interface ArtInfoProvider {
  getInfo(picnum: number): ArtInfo;
}

export class ArtFiles implements ArtInfoProvider {

  constructor(private arts: ArtFile[]) { }

  private getArt(id: number) {
    for (var i in this.arts) {
      var art = this.arts[i];
      if (id >= art.getStart() && id <= art.getEnd())
        return art;
    }
    return null;
  }

  public getInfo(id: number): ArtInfo {
    var art = this.getArt(id);
    if (art == null) return null;
    return art.getInfo(id - art.getStart());
  }
}