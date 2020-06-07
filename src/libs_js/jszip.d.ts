export interface ZipFile {
  async(format: string): Promise<ArrayBuffer>;
}

export interface ZipFs {
  readonly files: { [index: string]: ZipFile };
  file(name: string): ZipFile;
}

export interface Zlib {
  loadAsync(data: ArrayBuffer | string): Promise<ZipFs>
}

export declare const JSZip: Zlib;