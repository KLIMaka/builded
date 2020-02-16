
export class Tiler {
  private tiles: Map<string, number> = new Map();

  public put(x: number, y: number, tileId: number) {
    this.tiles.set(`${x},${y}`, tileId);
  }

  public get(x: number, y: number) {
    return this.tiles.get(`${x},${y}`);
  }

  public size() {
    return this.tiles.size;
  }

  public tile(cb: (x: number, y: number, tileId: number) => void) {
    for (const [key, tileId] of this.tiles.entries()) {
      const [x, y] = key.split(',').map(Number.parseFloat);
      cb(x, y, tileId);
    }
  }
}