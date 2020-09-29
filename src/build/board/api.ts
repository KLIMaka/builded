import { Board } from "./structs";
import { BOARD, BoardProvider } from "../../app/apis/app";
import { create, Injector } from "../../utils/injector";

let context: Context;
export async function GlobalContextModule(injector: Injector) {
  context = await create(injector, Context, BOARD);
}

class Context {
  constructor(
    readonly board: BoardProvider
  ) { }
}

export function board(): Board {
  return context.board();
}