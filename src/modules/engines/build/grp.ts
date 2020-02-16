import * as data from '../../../libs/stream';

export class GrpFile {

  private data: data.Stream;
  private count: number;
  private files: any = {};

  constructor(buf: ArrayBuffer) {
    this.data = new data.Stream(buf, true);
    this.loadFiles();
  }

  private loadFiles() {
    var d = this.data;
    d.setOffset(12);
    this.count = d.readUInt();
    var offset = this.count * 16 + 16;
    for (var i = 0; i < this.count; i++) {
      var fname = d.readByteString(12);
      var size = d.readUInt();
      this.files[fname] = offset;
      offset += size;
    }
  }

  public get(fname: string): data.Stream {
    var off = this.files[fname];
    if (off != undefined) {
      this.data.setOffset(off);
      return this.data.subView();
    }
    return null;
  }
}

export function create(buf: ArrayBuffer): GrpFile {
  return new GrpFile(buf);
}

export function createPalette(stream: data.Stream): Uint8Array {
  var pal = new Uint8Array(768);
  for (var i = 0; i < 256; i++) {
    pal[i * 3 + 0] = stream.readUByte() * 4;
    pal[i * 3 + 1] = stream.readUByte() * 4;
    pal[i * 3 + 2] = stream.readUByte() * 4;
  }
  return pal;
}