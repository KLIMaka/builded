import { Board } from "./structs"
import { isValidSectorId } from "./query"

export function vertices(board: Board, sectorId: number, floor: boolean) {
  if (!isValidSectorId(board, sectorId)) return null;

} 