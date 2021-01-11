import { MessageHandlerReflective, BUS, BusPlugin, Handle } from "../../apis/handler";
import { cyclic } from "../../../utils/mathutils";
import { NamedMessage } from "../../edit/messages";
import { Injector } from "../../../utils/injector";

export class GridControllerImpl extends MessageHandlerReflective {
  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 6;

  public setGridSize(size: number) {
    if (size <= this.gridSizes[0]) this.gridSizeIdx = 0;
    else if (size >= this.gridSizes[this.gridSizes.length - 1]) this.gridSizeIdx = this.gridSizes.length - 1;
    else {
      for (let i = 0; i < this.gridSizes.length - 2; i++) {
        const i1 = i + 1;
        if (size > this.gridSizes[i1]) continue;
        this.gridSizeIdx = (size - this.gridSizes[i]) < (this.gridSizes[i1] - size) ? i : i1;
        break;
      }
    }
  }

  private snapGrid(coord: number): number { const gridSize = this.getGridSize(); return Math.round(coord / gridSize) * gridSize }
  public getGridSize(): number { return this.gridSizes[this.gridSizeIdx] }
  public incGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length) }
  public decGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length) }
  public snap(x: number) { return this.snapGrid(x) }

  NamedMessage(msg: NamedMessage) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
    }
  }
}

export const DefaultGridController = (() => {
  let handle: Handle;
  return {
    start: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      const grid = new GridControllerImpl();
      handle = bus.connect(grid);
      return grid;
    },
    stop: async (injector: Injector) => {
      const bus = await injector.getInstance(BUS);
      bus.disconnect(handle);
    },
  }
})();
