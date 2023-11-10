import { List, Node } from "./list";

export class Place {
  static of(offset: number, size: number): Place { return new Place(offset, size); }

  constructor(public offset: number, public size: number, public data: any = null) { }
}


export class Bag {
  private holes: List<Place>;

  constructor(readonly size: number) {
    this.reset();
  }

  private getSuitablePlace(size: number): Node<Place> {
    for (let hole = this.holes.first(); hole != this.holes.terminator(); hole = hole.next)
      if (hole.obj.size >= size) return hole;
    return null;
  }

  private tryMerge(node: Node<Place>): void {
    if (node != this.holes.terminator() && node.next != this.holes.terminator()) {
      if (node.obj.offset + node.obj.size == node.next.obj.offset) {
        node.obj.size += node.next.obj.size;
        this.holes.remove(node.next);
        this.tryMerge(node);
      }
    }
  }

  public put(offset: number, size: number): void {
    let hole = this.holes.first();
    if (hole == this.holes.terminator()) {
      this.holes.insertAfter(Place.of(offset, size));
      return;
    }
    while (hole.next != this.holes.terminator()) {
      const next = hole.next;
      if (next.obj.offset >= size + offset) break;
      hole = next;
    }
    const end = hole.obj.offset + hole.obj.size;
    if (hole.obj.offset > offset) {
      const newHole = this.holes.insertBefore(Place.of(offset, size), hole);
      this.tryMerge(newHole);
    } else if (end == offset) {
      hole.obj.size += size;
      this.tryMerge(hole);
    } else {
      const newHole = this.holes.insertAfter(Place.of(offset, size), hole);
      this.tryMerge(newHole);
    }
  }

  public get(size: number): number {
    const hole = this.getSuitablePlace(size);
    if (hole == null) return null;
    if (hole.obj.size == size) {
      const prev = hole.prev;
      this.holes.remove(hole);
      this.tryMerge(prev);
      return hole.obj.offset;
    } else {
      const off = hole.obj.offset;
      hole.obj.offset += size;
      hole.obj.size -= size;
      return off;
    }
  }

  public reset() {
    this.holes.clear();
    this.holes.insertAfter(Place.of(0, this.size));
  }

  public getHoles() { return [...this.holes] }

  public freeSpace(segments: number) {
    const results = new Array<number>(segments).fill(1);
    const ds = this.size / segments;
    for (const hole of this.holes) {
      const hstart = hole.offset;
      const hend = hstart + hole.size;
      for (let i = (hstart / ds | 0); i <= (hend / ds | 0) && i < segments; i++) {
        const start = i * ds;
        const end = start + ds;
        const dl = Math.max(0, hstart - start);
        const dr = Math.max(0, end - hend);
        results[i] -= 1 - (dl + dr) / ds;
      }
    }
    return results;
  }
}

export class BagController {
  private bag: Bag;
  private places = {};
  private updater: (place: Place, noffset: number) => void;

  constructor(size: number, updater: (place: Place, noffset: number) => void) {
    this.bag = new Bag(size);
    this.updater = updater;
  }

  public get(size: number): Place {
    const offset = this.bag.get(size);
    // if (offset == null) {
    //   this.optimize();
    //   offset = this.bag.get(size);
    // }
    if (offset == null) return null;
    const result = Place.of(offset, size);
    this.places[offset] = result;
    return result;
  }

  public put(place: Place): void {
    this.bag.put(place.offset, place.size);
    delete this.places[place.offset];
  }

  public optimize() {
    const places = this.places;
    const keys = Object.keys(places);
    this.places = {};
    this.bag.reset();
    let offset = 0;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const place = places[key];
      this.places[offset] = place;
      if (place.offset != offset) {
        this.updater(place, offset);
        place.offset = offset;
      }
      offset += place.size;
    }
    this.bag.get(offset);
  }

  public freeSpace(segments: number) {
    return this.bag.freeSpace(segments);
  }
}

export function create(size: number): Bag {
  return new Bag(size);
}

export function createController(size: number, updater: (place: Place, noffset: number) => void): BagController {
  return new BagController(size, updater);
}