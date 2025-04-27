import { Source, Value, ValuesContainer } from "@utils/callbacks";
import { GridController } from "app/apis/engine";
import { clamp, cyclic } from "../../../utils/mathutils";

const GRID_SIZES = [16, 32, 64, 128, 256, 512, 1024];
class GridControllerImpl implements GridController {
  private gridSizeIdx: Value<number>;
  public size: Source<number>;

  constructor(values: ValuesContainer) {
    this.gridSizeIdx = values.value('grid-size-idx', 4);
    this.size = values.transformed('grid-size', this.gridSizeIdx, idx => GRID_SIZES[clamp(idx, 0, GRID_SIZES.length - 1)]);
  }

  setGridSize(size: number) {
    if (size <= GRID_SIZES[0]) this.gridSizeIdx.set(0);
    else if (size >= GRID_SIZES[GRID_SIZES.length - 1]) this.gridSizeIdx.set(GRID_SIZES.length - 1);
    else {
      for (let i = 0; i < GRID_SIZES.length - 2; i++) {
        const i1 = i + 1;
        if (size > GRID_SIZES[i1]) continue;
        this.gridSizeIdx.set((size - GRID_SIZES[i]) < (GRID_SIZES[i1] - size) ? i : i1);
        break;
      }
    }
  }

  private snapGrid(coord: number): number {
    const gridSize = this.size.get();
    return Math.round(coord / gridSize) * gridSize
  }

  incGridSize() { this.gridSizeIdx.mod(i => cyclic(i + 1, GRID_SIZES.length)) }
  decGridSize() { this.gridSizeIdx.mod(i => cyclic(i - 1, GRID_SIZES.length)) }
  snap(x: number, mod = 1) {
    const gridSize = this.size.get() * mod;
    return Math.round(x / gridSize) * gridSize
  }
}

export function DefaultGridController(values: ValuesContainer): GridController {
  return new GridControllerImpl(values);
}